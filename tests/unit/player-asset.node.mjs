import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Quaternion } from 'three';
function glb(path){const b=readFileSync(path),n=b.readUInt32LE(12);return {json:JSON.parse(b.subarray(20,20+n).toString()),bin:b.subarray(28+n),bytes:b.length};}
const source=glb('assets/characters/ocean-human-land-runtime.glb'),shared=glb('public/models/ocean-player-character.glb');
test('shared player retains original shore mesh, texture, rig and land clips exactly',()=>{
  for(const key of ['nodes','meshes','skins','images','textures','materials'])assert.deepEqual(shared.json[key],source.json[key]);
  assert.deepEqual(shared.json.animations.slice(0,3),source.json.animations);
  assert.ok(shared.bin.subarray(0,source.json.buffers[0].byteLength).equals(source.bin.subarray(0,source.json.buffers[0].byteLength)));
});
test('shared GLB contains all walking and swimming clips on valid canonical bones',()=>{
  assert.deepEqual(shared.json.animations.map(a=>a.name).sort(),['Idle','Run','Swim','SwimIdle','Walk']);
  for(const clip of shared.json.animations)for(const channel of clip.channels){
    assert.ok(shared.json.nodes[channel.target.node].name.startsWith('mixamorig:'));
    const sampler=clip.samplers[channel.sampler];
    for(const index of [sampler.input,sampler.output]){
      const accessor=shared.json.accessors[index],view=shared.json.bufferViews[accessor.bufferView];
      assert.ok(view.byteOffset+view.byteLength<=shared.json.buffers[0].byteLength);
    }
  }
});
test('retargeted swimming rotations remain finite unit quaternions',()=>{
  for(const clip of shared.json.animations.filter(a=>a.name.startsWith('Swim')))for(const channel of clip.channels){
    if(channel.target.path!=='rotation')continue;
    const a=shared.json.accessors[clip.samplers[channel.sampler].output],v=shared.json.bufferViews[a.bufferView];
    for(let i=0;i<a.count;i++){
      const offset=v.byteOffset+(a.byteOffset??0)+i*(v.byteStride??16);
      const q=[0,1,2,3].map(k=>shared.bin.readFloatLE(offset+k*4));
      assert.ok(q.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...q)-1)<.000001);
    }
  }
});
test('both underwater clips start prone instead of upright T-pose idle',()=>{
  for(const clip of shared.json.animations.filter(a=>a.name.startsWith('Swim'))){
    const c=clip.channels.find(c=>shared.json.nodes[c.target.node].name.endsWith('Hips')&&c.target.path==='rotation');
    const a=shared.json.accessors[clip.samplers[c.sampler].output],v=shared.json.bufferViews[a.bufferView];
    const offset=v.byteOffset+(a.byteOffset??0),q=new Quaternion(...[0,1,2,3].map(k=>shared.bin.readFloatLE(offset+k*4)));
    assert.ok(q.angleTo(new Quaternion().fromArray(shared.json.nodes[c.target.node].rotation))>1.2);
  }
});
