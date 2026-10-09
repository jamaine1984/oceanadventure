import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {fileURLToPath} from 'node:url';
const bundle=await build({stdin:{contents:"export * from './src/mastery-voyage.ts';export * from './src/progression.ts';export * from './src/voyage-state.ts';export * from './src/voyage-catalog.ts';export * from './src/expedition-state.ts';export * from './src/salvage.ts';export * from './src/research-rov.ts';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const a=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const anchor={x:0,z:20,yaw:0},floor=()=>-20;
function earned(){const p=a.defaultProgress();for(const id of a.CAMPAIGN_RECEIPTS)p.voyage=a.recordContractCompletion(p.voyage,a.contractById(id));p.expedition=a.newContractExpedition('pelagic-record',6);Object.assign(p.expedition,{observatoryRecords:[0,1,2],sold:true,stage:'complete',saleCredits:1150});p.credits=100;p.expeditions=6;return p;}
const start=(id='coast')=>a.beginMastery(earned(),id,true,anchor);
function read(p){const s=a.masteryStation(p.mastery,floor);p.weather.elapsed+=5;return a.recordMastery(p,s,floor,0,17,'bluewater',15,{x:s.x,z:s.z+28,yaw:.4});}
function finished(id='coast'){let p=start(id);while(a.masteryStation(p.mastery,floor))p=read(p);return p;}
function storage(){const values=new Map();a.setProgressStorage({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});return values;}
test('both itineraries use unique authored clear moorings and every repeat remains ordered',()=>{
  assert.equal(a.MASTERY_PLANS.length,2);for(const plan of a.MASTERY_PLANS)for(let run=1;run<16;run++){const order=a.masteryStops(plan.id,run);assert.equal(new Set(order).size,plan.stops.length);assert(order.every(id=>a.FIELD_POSTS.some(p=>p.id===id)));}assert.notDeepEqual(a.masteryStops('coast',1),a.masteryStops('coast',2));
});
test('unearned campaign, open water, active cargo and simultaneous voyages cannot start',()=>{
  assert.throws(()=>a.beginMastery(a.defaultProgress(),'coast',true,anchor));assert.throws(()=>a.beginMastery(earned(),'coast',false,anchor));const p=earned();p.expedition.sold=false;p.expedition.stage='return';assert.throws(()=>a.beginMastery(p,'coast',true,anchor));assert.throws(()=>a.beginMastery(start(),'waters',true,anchor));
});
test('begin clones existing economics, paid contract and equipment and initializes a protected root 6 record',()=>{
  const p=earned(),before=structuredClone(p),n=a.beginMastery(p,'coast',true,anchor);assert.deepEqual(p,before);assert.equal(n.saveVersion,6);assert.equal(n.credits,100);assert.equal(n.expeditions,6);assert.deepEqual(n.expedition,p.expedition);assert.equal(n.mastery.active.readings.length,0);assert.equal(a.normalizeProgress(n).saveVersion,6);
});
test('surface, drift, wrong depth and wrong stop cannot grant a reading',()=>{
  const p=start(),s=a.masteryStation(p.mastery,floor);for(const [pose,speed,depth]of [[{...s,y:0},0,0],[s,.21,17],[{...s,y:s.y+1.6},0,15],[{...s,x:s.x+4},0,17],[s,NaN,17],[s,0,.6]])assert(!a.masteryReady(p.mastery,pose,floor,speed,depth));assert(a.masteryReady(p.mastery,s,floor,0,17));
});
test('ordered readings keep the actual environment and never pay mid-voyage',()=>{
  const p=start(),first=a.masteryStation(p.mastery,floor),n=read(p);assert.equal(p.mastery.active.readings.length,0);assert.equal(n.credits,100);assert.equal(n.mastery.active.readings[0].weather,'bluewater');assert.equal(n.mastery.active.readings[0].wind,15);assert(!a.masteryReady(n.mastery,first,floor,0,17));assert.throws(()=>a.claimMastery(n,true));assert.equal(n.expedition.sold,true);
});
test('whole three and five region reports pay only at harbor and cannot be claimed twice',()=>{
  for(const id of ['coast','waters']){const p=finished(id);assert.throws(()=>a.claimMastery(p,false));const n=a.claimMastery(p,true);assert.equal(n.credits,100+a.masteryReward(id,1));assert.equal(n.mastery.counts[id],1);assert.equal(n.expeditions,7);assert.equal(n.voyage.reputation.selene,p.voyage.reputation.selene+15);assert.equal(n.mastery.active,null);assert.deepEqual(n.expedition,p.expedition);assert.throws(()=>a.claimMastery(n,true));assert.equal(a.normalizeProgress(n).mastery.last.reward,a.masteryReward(id,1));}
});
test('repeat voyages rotate order and do not award the first-completion bonus again',()=>{
  let p=a.claimMastery(finished(),true);p=a.beginMastery(p,'coast',true,anchor);assert.equal(p.mastery.active.run,2);assert.notEqual(a.masteryStation(p.mastery,floor).id,'bay');while(a.masteryStation(p.mastery,floor))p=read(p);const n=a.claimMastery(p,true);assert.equal(n.mastery.last.reward,650);assert.equal(n.mastery.counts.coast,2);
});
test('abandoning requires harbor, pays nothing and leaves earned records unchanged',()=>{
  const p=read(start());assert.throws(()=>a.abandonMastery(p,false));const n=a.abandonMastery(p,true);assert.equal(n.credits,p.credits);assert.equal(n.mastery.active,null);assert.equal(n.expeditions,p.expeditions);assert.deepEqual(n.expedition,p.expedition);assert.equal(p.mastery.active.readings.length,1);
});
test('root 6 export/import retains the actual vessel checkpoint, readings and paid ledger',()=>{
  const p=read(start()),v=storage();a.saveProgress(p);const loaded=a.loadProgress();assert.deepEqual(loaded.mastery,p.mastery);assert.deepEqual(a.readProgressImport(a.exportProgress(p)).mastery,p.mastery);assert(v.has('ocean-adventure-progress-v1'));assert.equal(a.normalizeProgress(earned()).saveVersion,2);
});
test('current corruption refuses incomplete, skipped, duplicated and overstated records',()=>{
  const p=read(start());for(const patch of [{mastery:undefined},{weather:undefined},{rov:undefined},{salvage:undefined},{mastery:{...p.mastery,counts:{coast:1,waters:0}}},{mastery:{...p.mastery,active:{...p.mastery.active,readings:[...p.mastery.active.readings,...p.mastery.active.readings]}}},{mastery:{...p.mastery,active:{...p.mastery.active,anchor:{x:NaN,z:20,yaw:0}}}}])assert.throws(()=>a.normalizeProgress({...p,...patch}));
  const n=a.claimMastery(finished(),true);assert.throws(()=>a.normalizeProgress({...n,mastery:{...n.mastery,last:{...n.mastery.last,reward:9999}}}));
});
test('future version, itinerary, station and sea state preflight before missing current equipment',()=>{
  const p=read(start());for(const patch of [{saveVersion:7},{mastery:{...p.mastery,version:2}},{mastery:{...p.mastery,active:{...p.mastery.active,id:'abyss'}}},{mastery:{...p.mastery,active:{...p.mastery.active,readings:[{...p.mastery.active.readings[0],stop:'abyss'}]}}},{mastery:{...p.mastery,active:{...p.mastery.active,readings:[{...p.mastery.active.readings[0],weather:'cyclone'}]}}},{mastery:{...p.mastery,counts:{...p.mastery.counts,abyss:1}}}])assert.throws(()=>a.normalizeProgress({...p,...patch,weather:undefined,rov:undefined}),a.ProgressLoadError);
});
test('salvage and ROV fabrication preserve active mastery records and the higher version',()=>{
  const p=start();p.credits=2000;const n=a.fabricateRov(p);assert.equal(n.saveVersion,6);assert.deepEqual(n.mastery,p.mastery);const c=a.SALVAGE_CACHES[0],m=a.recoverSalvage(p,c.id,{x:c.x,y:-18,z:c.z},-20,0);assert.equal(m.saveVersion,6);assert.deepEqual(m.mastery,p.mastery);
});
