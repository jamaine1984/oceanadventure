import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { Quaternion } from 'three';

const runtime='public/models/ocean-player-character.glb';
const backup='assets/characters/ocean-human-land-runtime.glb';
if(!existsSync(backup))copyFileSync(runtime,backup);
function read(path){
  const b=readFileSync(path),length=b.readUInt32LE(12);
  if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2)throw new Error('Expected GLB 2');
  return {json:JSON.parse(b.subarray(20,20+length).toString()),bin:b.subarray(28+length)};
}
const land=read(backup),swim=read('assets/characters/ocean-player-diver-legacy-runtime.glb');
const result=structuredClone(land.json),chunks=[land.bin.subarray(0,land.json.buffers[0].byteLength)];
let length=chunks[0].length;
function append(data){
  const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}
  const offset=length;chunks.push(data);length+=data.length;return offset;
}
const nodes=new Map(result.nodes.map((n,i)=>[n.name,i])),inputs=new Map();
function accessor(index,nodeIndex,path){
  const original=swim.json.accessors[index],view=swim.json.bufferViews[original.bufferView];
  if(original.sparse)throw new Error('Sparse motion is unsupported');
  const start=view.byteOffset??0,data=Buffer.from(swim.bin.subarray(start,start+view.byteLength));
  const accessor=structuredClone(original),newView=structuredClone(view);
  if(nodeIndex!==undefined&&path==='rotation'){
    const sourceNode=swim.json.nodes[nodeIndex],targetNode=result.nodes[nodes.get(sourceNode.name)];
    const correction=new Quaternion().fromArray(targetNode.rotation??[0,0,0,1]).multiply(new Quaternion().fromArray(sourceNode.rotation??[0,0,0,1]).invert());
    if(accessor.componentType!==5126||accessor.type!=='VEC4')throw new Error('Expected quaternion motion');
    for(let i=0;i<accessor.count;i++){
      const offset=(accessor.byteOffset??0)+i*(view.byteStride??16);
      const q=new Quaternion(...[0,1,2,3].map(k=>data.readFloatLE(offset+k*4))).premultiply(correction).normalize();
      q.toArray().forEach((value,k)=>data.writeFloatLE(value,offset+k*4));
    }
    delete accessor.min;delete accessor.max;
  }else if(nodeIndex!==undefined&&path==='translation'){
    const source=swim.json.nodes[nodeIndex],target=result.nodes[nodes.get(source.name)];
    if(!source.name.endsWith('Hips')||accessor.componentType!==5126||accessor.type!=='VEC3')throw new Error('Unexpected translating joint');
    const ratio=target.translation[1]/source.translation[1],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<accessor.count;i++)for(let k=0;k<3;k++){
      const offset=(accessor.byteOffset??0)+i*(view.byteStride??12)+k*4;
      const value=target.translation[k]+(data.readFloatLE(offset)-source.translation[k])*ratio;
      data.writeFloatLE(value,offset);min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);
    }
    accessor.min=min;accessor.max=max;
  }
  newView.buffer=0;newView.byteOffset=append(data);
  accessor.bufferView=result.bufferViews.length;result.bufferViews.push(newView);
  const next=result.accessors.length;result.accessors.push(accessor);return next;
}
for(const name of ['Swim','SwimIdle']){
  const original=swim.json.animations.find(a=>a.name==='Swim');
  if(!original)throw new Error('Prone swim clip missing');
  const clip={name,samplers:[],channels:[]};
  for(const channel of original.channels){
    const name=swim.json.nodes[channel.target.node].name,target=nodes.get(name);
    if(target===undefined)throw new Error('Missing shared bone: '+name);
    const sampler=original.samplers[channel.sampler];
    if(sampler.interpolation==='CUBICSPLINE')throw new Error('Expected linear motion');
    if(!inputs.has(sampler.input))inputs.set(sampler.input,accessor(sampler.input));
    clip.channels.push({sampler:clip.samplers.length,target:{node:target,path:channel.target.path}});
    clip.samplers.push({...sampler,input:inputs.get(sampler.input),output:accessor(sampler.output,channel.target.node,channel.target.path)});
  }
  result.animations.push(clip);
}
result.asset.extras={...result.asset.extras,playerIdentity:'Shared supplied shore researcher',swimMotion:'Retargeted prone Swim with slow idle cycle; original shore geometry, texture and bind rig retained'};
result.buffers=[{byteLength:length}];
let json=Buffer.from(JSON.stringify(result));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
writeFileSync(runtime,Buffer.concat([header,json,binHeader,bin]));
console.log(JSON.stringify({bytes:28+json.length+bin.length,clips:result.animations.map(a=>a.name),preservedLandBackup:backup}));
