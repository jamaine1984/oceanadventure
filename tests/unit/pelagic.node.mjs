import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/pelagic.ts';export * from './src/pelagic-world.ts';export * from './src/expedition-state.ts';export * from './src/progression.ts';export * from './src/voyage-catalog.ts';export {Scene,Vector3,Texture,Quaternion} from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';export {default as RAPIER} from '@dimforge/rapier3d-compat';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const fixture=()=>{const r=api.newContractExpedition('pelagic-record');r.stage='remote';return r;};
const pose=r=>{const t=api.pelagicTarget(r,-20);return{p:{x:t.x,y:t.y,z:t.z},look:{x:t.deviceX-t.x,y:t.deviceY-t.y,z:t.deviceZ-t.z}};};
test('observatory requires the paid freighter and offers no premature payout',()=>{
  const c=api.contractById('pelagic-record');assert(!api.contractAvailable(c,[]));assert(api.contractAvailable(c,['reach-archive']));assert(c.remote);
  const r=fixture();assert.equal(api.expeditionReward(r),0);assert.equal(api.objectiveCount(r),4);assert(!api.recoveryComplete(r));
});
test('three ordered optical records persist without manufacturing samples or mutating the source',()=>{
  let r=fixture();for(let i=0;i<3;i++){const {p,look}=pose(r),before=structuredClone(r),next=api.recordPelagicPort(r,-20,p,look,0);assert.deepEqual(r,before);assert.equal(next.observatoryRecords.length,i+1);assert.equal(next.sold,false);r=api.sanitizeExpedition(next);assert.equal(r.observatoryRecords.length,i+1);}
  assert.equal(r.stage,'return');assert.equal(api.expeditionReward(r),1150);assert(api.recoveryComplete(r));assert.equal(r.waterSample,false);assert.equal(r.sensorRecovered,false);assert.equal(api.completedObjectives(r),3);
  assert.throws(()=>api.recordPelagicPort(r,-20,{x:225,y:-17,z:-186.2},{x:0,y:0,z:-1},0));
});
test('wrong facing, movement, remote positions and nonfinite inputs cannot record a terminal',()=>{
  const r=fixture(),{p,look}=pose(r);assert(api.pelagicReady(r,-20,p,look,0));
  for(const [position,direction,speed]of [[p,{x:-look.x,y:-look.y,z:-look.z},0],[p,look,.21],[{...p,x:p.x+3},look,0],[{...p,y:NaN},look,0],[p,{x:NaN,y:0,z:-1},0],[p,look,NaN]])assert(!api.pelagicReady(r,-20,position,direction,speed));
  assert.deepEqual(api.orderedPelagicRecords([2,1]),[]);assert.deepEqual(api.orderedPelagicRecords([0,2]),[0]);
});
test('exterior approach goes through the front portal rather than a solid side or roof',()=>{
  const r=fixture();assert.deepEqual(api.pelagicApproach(r,-20,{x:225,y:-17,z:-200}),{x:237,y:-17,z:-200});assert.equal(api.pelagicApproach(r,-20,{x:237,y:-17,z:-190}).z,-178);
  assert.deepEqual(api.pelagicApproach(r,-20,{x:225,y:0,z:-178}),{x:225,y:-17,z:-181});
});
test('failed terminal storage leaves the live expedition and bank unchanged',()=>{
  const p=api.defaultProgress();p.saveVersion=3;p.rov={version:1,owned:true,battery:100};p.voyage.completed=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive'];p.expedition=fixture();
  const values=new Map();api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});api.saveProgress(p);const previous=values.get('ocean-adventure-progress-v1'),next=structuredClone(p),{p:position,look}=pose(p.expedition);next.expedition=api.recordPelagicPort(p.expedition,-20,position,look,0);
  api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:()=>{throw Error('quota');}});api.loadProgress();assert.throws(()=>api.saveProgress(next));assert.equal(values.get('ocean-adventure-progress-v1'),previous);assert.deepEqual(p.expedition.observatoryRecords,[]);assert.equal(p.credits,0);
});
test('authored circular station has real native wall, ceiling and floor collision with an open portal',async()=>{
  await api.RAPIER.init();const bytes=await readFile(new URL('../../public/models/pelagic_observatory.glb',import.meta.url));assert(bytes.length<230000);
  const asset=await new api.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const texture=new api.Texture(),world=new api.PelagicWorld(new api.Scene(),-20,texture);world.attach(asset.scene);
  const move=(from,to)=>{const p=new api.Vector3(...to);world.resolve(p,new api.Vector3(...from));return p;};
  try{
    assert(world.loaded);let proxies=0,ports=0,paint=false;asset.scene.traverse(n=>{if(n.userData.physicsCollider){proxies++;assert.equal(n.visible,false);}if(n.material?.name?.startsWith('Observatory port '))ports++;if(n.material?.name==='Observatory enamel'){paint=n.material.map===texture;assert(n.geometry.attributes.uv);}});assert(proxies>=10);assert.equal(ports,3);assert(paint);
    const entered=move([225,-17,-180],[225,-17,-186.2]);assert(entered.z<-185.5,JSON.stringify(entered));
    assert(move([225,-17,-190],[240,-17,-190]).x<231);
    assert(move([225,-17,-190],[225,0,-190]).y<-16);
    assert(move([225,-17,-190],[225,-30,-190]).y>-18);
    const waypoints=[[225,-17,-202],[237,-17,-202],[237,-17,-178],[225,-17,-178],[225,-17,-181],[225,-17,-186.2]];
    for(let i=1;i<waypoints.length;i++)assert(move(waypoints[i-1],waypoints[i]).distanceTo(new api.Vector3(...waypoints[i]))<.05,`Blocked exterior segment ${i}`);
    const diver=new api.Vector3(225,-17,-181);world.resolve(diver,new api.Vector3(225,-17,-190),new api.Quaternion());assert(diver.z>-182,'Diver cannot withdraw through service portal');
    // The circular pressure ceiling must not create an invisible square roof outside the dome.
    assert(move([230.8,-14,-184.2],[230.8,-18,-184.2]).y<-17.5);
  }finally{world.dispose();}
});
