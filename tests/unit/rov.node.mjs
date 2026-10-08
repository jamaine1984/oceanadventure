import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/research-rov.ts';export * from './src/rov-world.ts';export * from './src/rov-collision.ts';export * from './src/wreckward-world.ts';export * from './src/progression.ts';export * from './src/voyage-state.ts';export * from './src/voyage-catalog.ts';export {Scene,Vector3,Quaternion} from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';export {default as RAPIER} from '@dimforge/rapier3d-compat';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const unlocked=()=>{const p=api.defaultProgress();p.credits=1100;p.voyage.completed=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive'];p.voyage.blueprints=['research-rov'];return p;};
test('ROV fabrication requires paid campaign receipt, blueprint and funds without mutating the input',()=>{
  const p=unlocked();for(const changed of [{credits:899},{credits:NaN},{voyage:{...p.voyage,completed:[]}},{voyage:{...p.voyage,blueprints:[]}}])assert.throws(()=>api.fabricateRov({...p,...changed}));
  const next=api.fabricateRov(p);assert.equal(next.credits,200);assert.deepEqual(next.rov,{version:1,owned:true,battery:100});assert.equal(p.credits,1100);assert.equal(p.rov,undefined);assert.throws(()=>api.fabricateRov(next));
});
test('paid freighter completions grant the blueprint and old receipts migrate without free ownership',()=>{
  const p=unlocked();p.voyage.blueprints=[];const migrated=api.normalizeProgress(p);assert(migrated.voyage.blueprints.includes('research-rov'));assert.equal(migrated.rov.owned,false);
  const before={...p.voyage,completed:p.voyage.completed.filter(id=>id!=='reach-archive')};const earned=api.recordContractCompletion(before,api.contractById('reach-archive'));assert(earned.blueprints.includes('research-rov'));
});
test('owned ROV saves use an explicit new schema while legacy equipment migrates safely',()=>{
  const p=api.fabricateRov(unlocked());assert.equal(p.saveVersion,3);assert.equal(api.readProgressImport(api.exportProgress(p)).saveVersion,3);
  const legacy=unlocked();assert.equal(api.normalizeProgress(legacy).saveVersion,2);legacy.rov={version:1,owned:true,battery:60};assert.equal(api.normalizeProgress(legacy).saveVersion,3);
  assert.throws(()=>api.normalizeProgress({...p,saveVersion:6}),api.ProgressLoadError);
  const incomplete={...p};delete incomplete.rov;assert.throws(()=>api.normalizeProgress(incomplete));
});
test('missing equipment cannot hide explicit future nested schemas or routes behind recovery',()=>{
  for(const future of ['story','voyage','expedition','route']){
    const p=api.fabricateRov(unlocked()),values=new Map();api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});api.saveProgress(p);
    const damaged=structuredClone(p);delete damaged.rov;if(future==='route')damaged.expedition.route='unreleased';else damaged[future].version=future==='expedition'?4:2;
    const raw=JSON.stringify(damaged);values.set('ocean-adventure-progress-v1',raw);assert.throws(()=>api.loadProgress(),api.ProgressLoadError);assert.equal(values.get('ocean-adventure-progress-v1'),raw);
  }
});
test('ROV ownership requires the freighter receipt and battery values are bounded',()=>{
  assert.equal(api.sanitizeRov({version:1,owned:true,battery:40},[]).owned,false);
  for(const [value,expected] of [[-20,0],[130,100],[NaN,100],[41,41]])assert.equal(api.sanitizeRov({version:1,owned:true,battery:value},['reach-archive']).battery,expected);
});
test('unsupported ROV records block downgrade; incomplete records can recover a compatible backup',()=>{
  const p=unlocked();assert.throws(()=>api.normalizeProgress({...p,rov:{version:2,owned:true,battery:100}}),api.ProgressLoadError);
  const values=new Map();api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});p.rov={version:1,owned:true,battery:45};api.saveProgress(p);
  values.set('ocean-adventure-progress-v1',JSON.stringify({...p,rov:{owned:true,battery:30}}));assert.equal(api.loadProgress().rov.battery,45);
});
test('ROV export and failed fabrication writes preserve equipment and the old bank',()=>{
  const p=unlocked(),values=new Map();api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});api.saveProgress(p);const old=values.get('ocean-adventure-progress-v1');
  api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:()=>{throw Error('quota');}});api.loadProgress();assert.throws(()=>api.saveProgress(api.fabricateRov(p)));assert.equal(values.get('ocean-adventure-progress-v1'),old);
  const owned=api.fabricateRov(p);owned.rov.battery=62;assert.equal(api.readProgressImport(api.exportProgress(owned)).rov.battery,62);
});
test('present incomplete ROV records recover paid ownership instead of silently removing equipment',()=>{
  for(const missing of [null,false,0,'',[],{version:1,battery:45},{version:1,owned:true},{version:1,owned:1,battery:45}]){
    const p=unlocked(),values=new Map();p.rov={version:1,owned:true,battery:45};p.credits=200;
    api.setProgressStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});api.saveProgress(p);
    values.set('ocean-adventure-progress-v1',JSON.stringify({...p,rov:missing}));const recovered=api.loadProgress();assert(recovered.rov.owned);assert.equal(recovered.credits,200);assert.equal(recovered.rov.battery,45);
  }
});
test('expanded legacy wreck sweep stops sides, ends, roof and large-delta tunneling',()=>{
  const min={x:-3.1,y:-.4,z:-10},max={x:3.1,y:3.3,z:10},r=api.RESEARCH_ROV.radius;
  for(const [start,end] of [[{x:-8,y:1,z:0},{x:8,y:1,z:0}],[{x:0,y:1,z:-16},{x:0,y:1,z:16}],[{x:0,y:8,z:0},{x:0,y:-8,z:0}]]){
    const t=api.sweepExpandedBox(start,end,min,max,r);assert(t>0&&t<1);const p={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,z:start.z+(end.z-start.z)*t};assert(p.x<min.x-r||p.y>max.y+r||p.z<min.z-r);
  }
  assert.equal(api.sweepExpandedBox({x:-8,y:9,z:0},{x:8,y:9,z:0},min,max,r),1);
});
test('battery drains only deployed, includes lamps and propulsion, and recharges only aboard',()=>{
  const state={owned:true,active:true,aboard:false,moving:false,lights:false};const idle=api.rovBatteryStep(50,.1,state),thrust=api.rovBatteryStep(50,.1,{...state,moving:true}),lamp=api.rovBatteryStep(50,.1,{...state,lights:true});assert(thrust<idle&&lamp<idle);
  assert.equal(api.rovBatteryStep(50,10,state),idle);assert.equal(api.rovBatteryStep(50,NaN,state),50);assert.equal(api.rovBatteryStep(0,.1,state),0);
  assert.equal(api.rovBatteryStep(50,.1,{...state,active:false}),50);assert(api.rovBatteryStep(50,.1,{...state,active:false,aboard:true})>50);
});
test('tether limits three-dimensional travel and rejects malformed coordinates',()=>{
  const anchor={x:3,y:0,z:2};const p=api.constrainRovTether({x:303,y:-300,z:302},anchor);assert(Math.abs(Math.hypot(p.x-3,p.y,p.z-2)-120)<1e-8);assert(p.limited);assert.throws(()=>api.constrainRovTether({x:NaN,y:0,z:0},anchor));assert.throws(()=>api.constrainRovTether(anchor,anchor,0));
});
test('ROV depth bounds retain whole-body clearance and reject shoals and invalid depths',()=>{
  const b=api.rovDepthBounds(-12,1);assert.equal(b.min,-12+api.RESEARCH_ROV.radius);assert.equal(b.max,1-api.RESEARCH_ROV.radius);assert.equal(api.rovDepthBounds(-1,0),undefined);assert.equal(api.rovDepthBounds(NaN,0),undefined);
});
await api.RAPIER.init();
const bytes=await readFile(new URL('../../public/models/sentry_research_rov.glb',import.meta.url));
const asset=()=>new api.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('Blender ROV has six independent rotors, camera/tether anchors and bounded geometry',async()=>{
  const gltf=await asset();gltf.scene.updateMatrixWorld(true);assert(gltf.scene.getObjectByName('Sentry_anchor_camera'));assert(gltf.scene.getObjectByName('Sentry_anchor_tether'));let rotors=0,batches=0,vertices=0;
  gltf.scene.traverse(node=>{if(node.userData.rovRotor)rotors++;if(node.isMesh){batches++;const p=node.geometry.attributes.position;vertices+=p.count;for(let i=0;i<p.count;i++){const point=new api.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);assert(point.length()<api.RESEARCH_ROV.radius);}}});assert.equal(rotors,6);assert(batches<=14);assert(vertices<15_000);assert(bytes.length<500_000);
});
test('native vehicle controller blocks solid walls without changing the requested previous position',()=>{
  const physics=new api.RAPIER.World({x:0,y:0,z:0});physics.createCollider(api.RAPIER.ColliderDesc.cuboid(.1,5,5));physics.step();const world=new api.RovWorld(new api.Scene(),physics),before=new api.Vector3(-3,0,0),end=new api.Vector3(3,0,0);world.resolve(end,before);assert(end.x<-api.RESEARCH_ROV.radius);assert.equal(before.x,-3);physics.free();
});
test('vehicle recovery hides the rendered body, cable and light',()=>{
  const physics=new api.RAPIER.World({x:0,y:0,z:0}),world=new api.RovWorld(new api.Scene(),physics);world.root.visible=world.tether.visible=true;world.lamp.intensity=6;world.recover();assert.equal(world.root.visible,false);assert.equal(world.tether.visible,false);assert.equal(world.lamp.intensity,0);physics.free();
});
test('the full ROV collision sphere fits freighter breaches and cannot cross its walls or deck',async()=>{
  const data=await readFile(new URL('../../public/models/wreckward_freighter.glb',import.meta.url));
  const gltf=await new api.GLTFLoader().register(()=>({name:'GeometryOnlyImages',loadTexture:()=>Promise.resolve(null)})).parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const world=new api.WreckwardWorld(new api.Scene(),-27);world.attach(gltf.scene);
  const move=(a,b)=>{const previous=new api.Vector3(...a),position=new api.Vector3(...b);world.resolveRov(position,previous);return position;};
  try{
    assert(move([-293,-24.3,-170],[-300,-24.3,-170]).x>-295);
    assert(Math.abs(move([-293,-24.3,-166],[-297.6,-24.3,-166]).x+297.6)<.05);
    assert(Math.abs(move([-300,-24.3,-174],[-307,-24.3,-174]).x+307)<.05);
    assert(move([-300,-24.3,-170],[-300,0,-170]).y<-23.2);
  }finally{world.dispose();}
});
