import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle=await build({stdin:{contents:["export * from './src/voyage-catalog.ts';","export * from './src/voyage-state.ts';","export * from './src/save-archive.ts';","export * from './src/progression.ts';","export * from './src/expedition-state.ts';","export * from './src/chart-markers.ts';","export * from './src/field-equipment.ts';"].join('\n'),resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const storage=()=>{const values=new Map();const adapter={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};api.setProgressStorage(adapter);return {values,adapter};};
const complete=id=>{const record=api.newContractExpedition(id),plan=api.expeditionPlan(record);record.photos=[...(plan.requiredSpecies.length?plan.requiredSpecies:['turtle','ray','tang'].slice(0,plan.photoGoal))];record.waterSample=plan.samplesRequired;record.sedimentSample=plan.samplesRequired;record.transectReadings=plan.stations.map((_,index)=>index);record.cableFreed=plan.recoveryRequired&&!plan.stations.length;record.sensorRecovered=record.cableFreed;if(plan.repairRequired)record.arrayRestored=true;if(plan.interiorRequired)record.interiorSteps=[0,1,2,3];if(plan.remoteRequired)record.observatoryRecords=[0,1,2];return record;};

test('catalog has eighteen distinct contracts, five districts and one connected campaign',()=>{
  assert.equal(api.CONTRACTS.length,18);assert.equal(new Set(api.CONTRACTS.map(item=>item.id)).size,18);assert.equal(api.DISTRICTS.length,5);assert.equal(new Set(api.CONTRACTS.map(item=>item.family)).size,6);
  const chapters=api.CONTRACTS.filter(item=>item.story);assert.deepEqual(chapters.map(item=>item.story).sort(),[1,2,3,4,5,6]);
  for(const contract of api.CONTRACTS){assert(api.DISTRICTS.some(item=>item.id===contract.district));for(const dependency of contract.prerequisites)assert(api.contractById(dependency));}
});
for(const contract of api.CONTRACTS)test(`contract ${contract.id} is completable with only its declared objectives`,()=>{
  const record=complete(contract.id),plan=api.expeditionPlan(record);
  assert(api.reefComplete(record));assert(api.recoveryComplete(record));assert(api.expeditionReward(record)>0);
  record.sold=true;record.stage='complete';record.saleCredits=api.expeditionReward(record);
  assert.equal(api.completedObjectives(record),api.objectiveCount(record));
  const restored=api.sanitizeExpedition(record);assert.equal(restored.contractId,contract.id);assert.equal(restored.stage,'complete');assert.equal(restored.saleCredits,record.saleCredits);
  if(!plan.samplesRequired){assert.equal(record.waterSample,false);assert.equal(api.nearestSample(record,{x:0,y:0,z:0}),undefined);}
  if(!plan.recoveryRequired)assert.equal(record.sensorRecovered,false);
});
test('original three expedition rewards and objectives remain unchanged',()=>{
  for(const [run,reward]of [[1,1510],[2,1540],[3,1680]]){const record=api.newExpedition(run),plan=api.expeditionPlan(record);record.photos=plan.requiredSpecies.length?[...plan.requiredSpecies]:['turtle','ray','tang'];record.waterSample=record.sedimentSample=record.cableFreed=record.sensorRecovered=true;record.transectReadings=[0,1,2];assert.equal(api.expeditionReward(record),reward);assert.equal(api.objectiveCount(record),8);}
});
test('campaign unlocks districts only through prerequisite contracts and persists earned rewards',()=>{
  let voyage=api.newVoyage();assert.equal(api.districtUnlocked('lagoon',voyage.completed),false);
  assert.throws(()=>api.recordContractCompletion(voyage,api.contractById('passage-origin')));
  for(const id of ['bay-signal','lagoon-echo','passage-origin']){assert.equal(api.nextStoryContract(voyage.completed).id,id);voyage=api.recordContractCompletion(voyage,api.contractById(id));}
  assert.equal(api.nextStoryContract(voyage.completed).id,'array-repair');assert(api.districtUnlocked('passage',voyage.completed));assert.deepEqual(voyage.blueprints,['survey-anchor','scooter-drive']);assert.equal(voyage.reputation.mara,65);assert.equal(voyage.reputation.ivo,30);
  voyage=api.recordContractCompletion(voyage,api.contractById('bay-signal'));assert.equal(voyage.completed.length,3);assert.equal(voyage.completions['bay-signal'],2);assert.equal(voyage.reputation.mara,75);
});
test('chart discoveries require proximity, do not duplicate, and validate course and pins',()=>{
  const voyage=api.newVoyage();assert.equal(api.discoverNearby(voyage,{x:200,z:200}).length,0);assert.equal(api.discoverNearby(voyage,{x:0,z:-86})[0].id,'reef');assert.equal(api.discoverNearby(voyage,{x:0,z:-86}).length,0);
  const safe=api.sanitizeVoyage({...voyage,activeWaypoint:'vault',pins:[{id:'pin-test',name:'<script>point',x:0,z:0},{id:'pin-bad',name:'bad',x:1e9,z:0}],completed:['fake'],blueprints:['fake']});assert.equal(safe.activeWaypoint,undefined);assert.equal(safe.pins.length,1);assert(!safe.pins[0].name.includes('<'));assert.deepEqual(safe.completed,[]);
});
test('legacy save migration retains credits, boats, upgrades and ongoing expedition',()=>{
  const legacy=api.defaultProgress();delete legacy.saveVersion;delete legacy.voyage;legacy.credits=2400;legacy.ownedBoats.push('voyager');legacy.activeBoat='voyager';legacy.upgrades.tank=2;legacy.expedition=api.newExpedition(3);legacy.expedition.waterSample=true;
  const {values}=storage();values.set('ocean-adventure-progress-v1',JSON.stringify(legacy));const loaded=api.loadProgress();assert.equal(loaded.credits,2400);assert.equal(loaded.activeBoat,'voyager');assert.equal(loaded.upgrades.tank,2);assert.equal(loaded.expedition.route,'passage');assert.equal(loaded.expedition.waterSample,true);assert.equal(loaded.saveVersion,2);assert.deepEqual(loaded.voyage.completed,[]);
});
test('pre-expedition legacy records migrate without erasing fleet or balance',()=>{const result=api.normalizeProgress({credits:900,ownedBoats:['aurora','voyager'],activeBoat:'voyager'});assert.equal(result.credits,900);assert.equal(result.activeBoat,'voyager');assert.equal(result.expedition.stage,'briefing');});
test('rolling checkpoints are bounded and recover the latest valid saved state',()=>{
  const {values}=storage();let progress=api.loadProgress();for(let i=1;i<=5;i++){progress.credits=i*100;api.saveProgress(progress);}assert.equal(api.recoveryArchives().length,3);values.set('ocean-adventure-progress-v1','corrupt');const loaded=api.loadProgress();assert.equal(loaded.credits,500);assert.equal(api.progressLoadStatus,'recovered');api.saveProgress(loaded);assert.equal(JSON.parse(values.get('ocean-adventure-progress-v1')).credits,500);
});
test('future and unrecoverable saves block loading instead of becoming a new voyage',()=>{
  const {values}=storage();values.set('ocean-adventure-progress-v1','corrupt');assert.throws(()=>api.loadProgress(),api.ProgressLoadError);assert.equal(values.get('ocean-adventure-progress-v1'),'corrupt');values.set('ocean-adventure-progress-v1',JSON.stringify({...api.defaultProgress(),saveVersion:8}));assert.throws(()=>api.loadProgress(),api.ProgressLoadError);
});
test('recovery never silently downgrades an unsupported newest checkpoint to an older voyage',()=>{
  const {values}=storage(),older=api.defaultProgress();older.credits=100;
  const newer={...older,saveVersion:4,credits:1800};
  values.set('ocean-adventure-recovery-v1',JSON.stringify([api.createArchive(JSON.stringify(newer)),api.createArchive(JSON.stringify(older))]));values.set('ocean-adventure-progress-v1','corrupt');
  assert.throws(()=>api.loadProgress(),api.ProgressLoadError);assert.equal(values.get('ocean-adventure-progress-v1'),'corrupt');assert.equal(JSON.parse(api.recoveryArchives()[0].payload).credits,1800);
});
test('unsupported nested expedition versions block both primary and recovery rollback',()=>{
  const {values}=storage(),older=api.defaultProgress();older.credits=100;
  const newer={...older,credits:1800,expedition:{...older.expedition,version:4}};
  values.set('ocean-adventure-recovery-v1',JSON.stringify([api.createArchive(JSON.stringify(newer)),api.createArchive(JSON.stringify(older))]));values.set('ocean-adventure-progress-v1','corrupt');
  assert.throws(()=>api.loadProgress(),api.ProgressLoadError);assert.equal(values.get('ocean-adventure-progress-v1'),'corrupt');
  values.set('ocean-adventure-progress-v1',JSON.stringify(newer));assert.throws(()=>api.loadProgress(),api.ProgressLoadError);assert.equal(JSON.parse(values.get('ocean-adventure-progress-v1')).credits,1800);
});
test('missing nested version data is recoverable corruption, not a future-version downgrade',()=>{
  const {values}=storage(),progress=api.loadProgress();progress.credits=930;api.saveProgress(progress);
  const incomplete={...progress,expedition:{...progress.expedition}};delete incomplete.expedition.version;values.set('ocean-adventure-progress-v1',JSON.stringify(incomplete));assert.equal(api.loadProgress().credits,930);assert.equal(api.progressLoadStatus,'recovered');
  const incompleteVoyage={...progress,voyage:{...progress.voyage}};delete incompleteVoyage.voyage.version;values.set('ocean-adventure-progress-v1',JSON.stringify(incompleteVoyage));assert.equal(api.loadProgress().credits,930);assert.equal(api.progressLoadStatus,'recovered');
});
test('verified export round trips and rejects altered or oversized archives',()=>{
  const progress=api.defaultProgress();progress.credits=800;const exported=api.exportProgress(progress);assert.equal(api.readProgressImport(exported).credits,800);const altered=JSON.parse(exported);altered.payload=altered.payload.replace('800','900');assert.throws(()=>api.readProgressImport(JSON.stringify(altered)));assert.throws(()=>api.parseArchive('a'.repeat(2_000_001)));
});
test('import retains previous voyage, and failed primary saves do not replace it',()=>{
  const {values,adapter}=storage();let old=api.loadProgress();old.credits=400;api.saveProgress(old);const next=api.defaultProgress();next.credits=900;api.importProgress(next);assert.equal(JSON.parse(values.get('ocean-adventure-progress-v1')).credits,900);assert.equal(JSON.parse(api.recoveryArchives()[0].payload).credits,900);assert(api.recoveryArchives().some(item=>JSON.parse(item.payload).credits===400));
  api.setProgressStorage({...adapter,setItem:(key,value)=>{if(key==='ocean-adventure-progress-v1')throw new Error('Quota exceeded');adapter.setItem(key,value);}});api.loadProgress();assert.throws(()=>api.saveProgress(old));assert.equal(JSON.parse(values.get('ocean-adventure-progress-v1')).credits,900);
});
test('a competing session cannot overwrite progress',()=>{const {values}=storage();const progress=api.loadProgress();api.saveProgress(progress);values.set('ocean-adventure-progress-v1',JSON.stringify({...progress,credits:300}));assert.throws(()=>api.saveProgress(progress),/another session/);assert.throws(()=>api.importProgress(progress),/another session/);});
test('reputation discounts have an earned threshold, preserve legacy prices and stop at twelve percent',()=>{const progress=api.defaultProgress();assert.equal(api.researchDiscount(progress),0);assert.equal(api.upgradeCost('tank',0),350);progress.voyage.reputation.mara=49;assert.equal(api.researchDiscount(progress),0);progress.voyage.reputation.ivo=1;assert.equal(api.researchDiscount(progress),.02);assert.equal(api.upgradeCost('tank',0,api.researchDiscount(progress)),343);progress.voyage.reputation.mara=10000;assert.equal(api.researchDiscount(progress),.12);assert.equal(api.upgradeCost('tank',0,1),308);});
test('a syntactically valid but incomplete current primary uses verified recovery instead of resetting the bank',()=>{
  const {values}=storage(),progress=api.loadProgress();progress.credits=1250;progress.ownedBoats.push('voyager');progress.activeBoat='voyager';progress.upgrades.tank=2;api.saveProgress(progress);
  values.set('ocean-adventure-progress-v1',JSON.stringify({saveVersion:2,expedition:{version:2}}));
  const recovered=api.loadProgress();assert.equal(recovered.credits,1250);assert.equal(recovered.activeBoat,'voyager');assert.equal(recovered.upgrades.tank,2);assert.equal(api.progressLoadStatus,'recovered');
  const incomplete={...progress};delete incomplete.credits;assert.throws(()=>api.normalizeProgress(incomplete));
});
test('the shared reputation quote matches first and repeat awards and the earned discount tier',()=>{
  const contract=api.contractById('bay-water');assert.equal(api.contractReputationReward(contract,[]),10);assert.equal(api.contractReputationReward(contract,['bay-water']),4);
  let voyage=api.newVoyage();voyage=api.recordContractCompletion(voyage,api.contractById('bay-signal'));voyage=api.recordContractCompletion(voyage,api.contractById('lagoon-echo'));
  const quoted=api.contractReputationReward(api.contractById('bay-signal'),voyage.completed),before=voyage.reputation.mara;
  voyage=api.recordContractCompletion(voyage,api.contractById('bay-signal'));assert.equal(voyage.reputation.mara-before,quoted);assert.equal(api.researchDiscount({voyage}),.02);
});
for(const [width,height]of [[320,288],[264,238]])test(`twenty collocated chart targets stay separate and bounded at ${width}x${height}`,()=>{
  const points=Array.from({length:20},(_,index)=>({id:String(index),x:width/2,y:height/2}));const original=structuredClone(points),placed=api.layoutChartMarkers(points,width,height);
  assert.deepEqual(points,original);assert.equal(placed.length,20);
  for(const point of placed){assert(point.x>=22&&point.x<=width-22);assert(point.y>=22&&point.y<=height-22);}
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)assert(Math.abs(placed[i].x-placed[j].x)>=48||Math.abs(placed[i].y-placed[j].y)>=48);
});
test('chart layout rejects a surface too small for usable controls',()=>assert.throws(()=>api.layoutChartMarkers([{id:'one',x:0,y:0}],30,40)));

test('dive drive fabrication requires the earned blueprint and credits, without mutating the source',()=>{
  const progress=api.defaultProgress();progress.credits=2000;assert.throws(()=>api.fabricateScooter(progress),/blueprint/);
  progress.voyage.blueprints.push('scooter-drive');progress.credits=649;assert.throws(()=>api.fabricateScooter(progress),/credits/);progress.credits=650;
  const next=api.fabricateScooter(progress);assert.equal(next.credits,0);assert.deepEqual(next.fieldEquipment,{scooter:true,charge:100});assert.equal(progress.credits,650);assert.equal(progress.fieldEquipment.scooter,false);assert.throws(()=>api.fabricateScooter(next),/already built/);
});
test('old archives retain progress and migrate with no fabricated equipment',()=>{
  const progress=api.defaultProgress();delete progress.fieldEquipment;progress.credits=850;const restored=api.readProgressImport(api.exportProgress(progress));assert.equal(restored.credits,850);assert.deepEqual(restored.fieldEquipment,{scooter:false,charge:100});
});
test('fabricated drive, battery and blueprint survive save/export/reload; failed commit spends nothing',()=>{
  const {values,adapter}=storage();const progress=api.loadProgress();progress.credits=900;progress.voyage.blueprints.push('scooter-drive');api.saveProgress(progress);
  const next=api.fabricateScooter(progress);next.fieldEquipment.charge=31.5;
  api.setProgressStorage({...adapter,setItem:(key,value)=>{if(key==='ocean-adventure-progress-v1')throw new Error('Quota');adapter.setItem(key,value);}});api.loadProgress();assert.throws(()=>api.saveProgress(next));assert.equal(JSON.parse(values.get('ocean-adventure-progress-v1')).credits,900);
  api.setProgressStorage(adapter);api.loadProgress();api.saveProgress(next);const loaded=api.loadProgress();assert.equal(loaded.credits,250);assert.deepEqual(loaded.fieldEquipment,{scooter:true,charge:31.5});assert.deepEqual(api.readProgressImport(api.exportProgress(loaded)).fieldEquipment,loaded.fieldEquipment);
});
test('battery state is bounded, refuses blueprint-less equipment and does not poison movement',()=>{
  assert.deepEqual(api.sanitizeFieldEquipment({scooter:true,charge:-4},['scooter-drive']),{scooter:true,charge:0});assert.deepEqual(api.sanitizeFieldEquipment({scooter:true,charge:Infinity},[]),{scooter:false,charge:100});assert.equal(api.sanitizeFieldEquipment({scooter:true,charge:300},['scooter-drive']).charge,100);
});
test('scooter power is forward-only, underwater, manual, consumes charge and never replaces normal swim',()=>{
  const equipment={scooter:true,charge:100},state={aboard:false,enabled:true,forward:1,boost:false,depth:8,assisting:false};
  const step=api.scooterStep(equipment,.1,state);assert(step.powered);assert.equal(step.multiplier,1.65);assert(step.charge<100);assert.equal(equipment.charge,100);
  for(const changes of [{enabled:false},{forward:-1},{forward:0},{depth:.3},{assisting:true}]){const result=api.scooterStep(equipment,.1,{...state,...changes});assert.equal(result.multiplier,1);assert.equal(result.charge,100);}
  assert.equal(api.scooterStep({scooter:true,charge:.001},.1,state).multiplier,1);assert.equal(api.scooterStep({scooter:false,charge:100},.1,state).multiplier,1);
  assert.equal(api.scooterStep(equipment,NaN,state).charge,100);
});
test('only aboard recharges the battery, pause deltas do not charge it and charge caps at full',()=>{
  const equipment={scooter:true,charge:20},state={aboard:true,enabled:false,forward:0,boost:false,depth:0,assisting:false};assert.equal(api.scooterStep(equipment,.1,state).charge,20.125);assert.equal(api.scooterStep(equipment,0,state).charge,20);assert.equal(api.scooterStep(equipment,.1,{...state,aboard:false}).charge,20);assert.equal(api.scooterStep({scooter:true,charge:99.99},.1,state).charge,100);
});
test('sonar uses real pending objective positions within range and grants no progress',()=>{
  const record=api.newContractExpedition('bay-water');record.stage='reef';const original=structuredClone(record),contacts=api.sonarContacts(record,{x:0,y:-8,z:-85});assert.equal(contacts.length,2);assert.equal(contacts[0].id,'water');assert(contacts[0].distance<6);assert.deepEqual(record,original);
  record.waterSample=true;assert.deepEqual(api.sonarContacts(record,{x:0,y:-8,z:-85}).map(item=>item.id),['sediment']);assert.equal(api.sonarContacts(record,{x:200,y:-8,z:200}).length,0);
  const photography=api.newContractExpedition('bay-portrait');photography.stage='reef';assert.equal(api.sonarContacts(photography,{x:0,y:-8,z:-85}).length,0);
});
test('sonar reading contacts never bypass passage order or cable release objectives',()=>{
  const passage=api.newContractExpedition('passage-traverse');passage.stage='transect';passage.transectReadings=[0];const contacts=api.sonarContacts(passage,{x:166,y:-19,z:-140});assert.deepEqual(contacts.map(item=>item.id),['station-1','station-2']);assert.deepEqual(passage.transectReadings,[0]);
  const wreck=api.newExpedition();wreck.stage='wreck';assert.deepEqual(api.sonarContacts(wreck,{x:85,y:-25,z:-164}).map(item=>item.id),['sensor','cable']);assert.equal(wreck.sensorRecovered,false);wreck.cableFreed=true;assert.equal(api.sonarContacts(wreck,{x:85,y:-25,z:-164}).length,1);wreck.stage='return';assert.equal(api.sonarContacts(wreck,{x:85,y:-25,z:-164}).length,0);
});
