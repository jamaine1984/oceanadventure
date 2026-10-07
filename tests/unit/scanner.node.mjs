import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle=await build({stdin:{contents:"export * from './src/scan-identification.ts'; export * from './src/expedition-state.ts';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const position={x:0,y:-8,z:-85};
const animal=(key,x,y=-8,z=-85,visible=true)=>({key,root:{visible,position:{x,y,z}}});

test('automatic sweeps require underwater scanner, seven-second interval, and active play',()=>{
  const state={swimming:true,selected:true,depth:4,paused:false,acquiring:false,time:7,lastSweep:0};
  assert.equal(api.scannerReady(state),true);
  for(const change of [{swimming:false},{selected:false},{depth:.6},{paused:true},{acquiring:true},{time:6.99}])assert.equal(api.scannerReady({...state,...change}),false);
  assert.equal(api.scannerReady({...state,lastSweep:-Infinity}),true);
});
test('identification preserves real instruments, adds context, and never grants cargo or photos',()=>{
  const record=api.newContractExpedition('bay-water');record.stage='reef';const before=structuredClone(record);
  const contacts=api.identifyScan(record,position,[animal('turtle',8)]);
  assert.equal(contacts[0].id,'water');assert.equal(contacts[0].kind,'Research instrument');assert.match(contacts[0].action,/Sampler/);
  assert.equal(contacts[2].name,'Green sea turtle');assert.equal(contacts[2].distance,8);assert.equal(contacts[2].y,-8);
  assert.match(contacts[2].action,/photograph/);assert.deepEqual(record,before);
});
test('wildlife echoes are range-limited, visible, deduplicated and use the nearest actual position',()=>{
  const record=api.newContractExpedition('bay-portrait');record.stage='reef';
  const contacts=api.identifyScan(record,position,[animal('turtle',20),animal('turtle',8),animal('ray',26),animal('tang',5,-8,-85,false),animal('anthias',NaN)]);
  assert.equal(contacts.length,1);assert.equal(contacts[0].x,8);assert.equal(contacts[0].id,'wildlife-turtle');
});
test('finished research targets disappear and completed missions can still identify wildlife',()=>{
  const record=api.newContractExpedition('bay-water');record.stage='reef';record.waterSample=true;
  assert.deepEqual(api.identifyScan(record,position,[]).map(c=>c.id),['sediment']);
  record.stage='return';assert.deepEqual(api.identifyScan(record,position,[animal('ray',8)]).map(c=>c.id),['wildlife-ray']);
});
test('scanner limits echoes to five while preserving research priority',()=>{
  const record=api.newContractExpedition('bay-water');record.stage='reef';
  const contacts=api.identifyScan(record,position,Object.keys(api.SPECIES).map((key,index)=>animal(key,index+1)));
  assert.equal(contacts.length,5);assert.deepEqual(contacts.slice(0,2).map(c=>c.id),['water','sediment']);
});
