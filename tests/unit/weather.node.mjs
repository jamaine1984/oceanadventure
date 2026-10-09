import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {fileURLToPath} from 'node:url';
const bundle=await build({stdin:{contents:"export * from './src/voyage-weather.ts';export * from './src/progression.ts';export * from './src/salvage.ts';export * from './src/research-rov.ts';export * from './src/voyage-state.ts';export * from './src/voyage-catalog.ts';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const a=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const current=()=>({...a.defaultProgress(),saveVersion:5,weather:a.newVoyageWeather(),rov:a.newRovEquipment(),salvage:a.newSalvage()});
test('front boundaries repeat without ambiguity',()=>{
  const expected=[[0,'bluewater'],[479.99,'bluewater'],[480,'calm'],[840,'bluewater'],[1200,'storm'],[1440,'bluewater'],[1680,'calm'],[2160,'bluewater']];
  for(const [t,key]of expected){assert.equal(a.weatherFront(t).key,key);assert(a.weatherFront(t).remaining>0);}
});
test('clock stops in menus and caps delayed frames; no wall clock or offline advance',()=>{
  const s=a.newVoyageWeather();a.advanceWeather(s,10,true);assert.equal(s.elapsed,0);a.advanceWeather(s,1000);assert.equal(s.elapsed,.05);
  for(const delta of [NaN,Infinity,-1,0])a.advanceWeather(s,delta);assert.equal(s.elapsed,.05);
});
test('manual front expires and forecast resolves the front at expiry across boundaries',()=>{
  const s=a.holdWeather({...a.newVoyageWeather(),elapsed:1150},'calm');assert.equal(a.activeWeather(s),'calm');
  const f=a.weatherForecast(s);assert.equal(f.entries[0].key,'storm');assert.equal(f.entries[0].inSeconds,180);assert.equal(f.entries[1].inSeconds,290);
  s.elapsed=1329.99;a.advanceWeather(s,.05);assert.equal(s.override,null);assert.equal(a.activeWeather(s),'storm');
  assert.equal(a.holdWeather(s,null).until,0);
});
test('day, twilight and night are bounded and readable throughout a cycle',()=>{
  assert.equal(a.voyageLight(0).clock,'09:00');assert.equal(a.voyageLight(1350).clock,'00:00');assert.equal(a.voyageLight(1350).period,'Night');assert.equal(a.voyageLight(2160).clock,'09:00');
  for(let t=0;t<2160;t++){const l=a.voyageLight(t);assert(l.daylight>=0&&l.daylight<=1);assert(Number.isFinite(l.elevation));assert.match(l.clock,/^\d\d:\d\d$/);}
});
test('celestial direction is continuous at midnight and the daily wrap',()=>{
  const direction=t=>{const l=a.voyageLight(t),e=l.elevation*Math.PI/180,z=l.azimuth*Math.PI/180;return [Math.cos(e)*Math.sin(z),Math.sin(e),Math.cos(e)*Math.cos(z)];};
  for(const boundary of [1350,2160]){const before=direction(boundary-.001),after=direction(boundary+.001);assert(Math.hypot(...before.map((v,i)=>v-after[i]))<.00002);}
});
test('safe-harbor rest reaches dawn, clears overrides and refuses open water or daytime',()=>{
  const s=a.holdWeather({...a.newVoyageWeather(),elapsed:1250},'storm'),n=a.restWeather(s,true);assert.equal(a.voyageLight(n.elapsed).clock,'07:00');assert.equal(n.override,null);assert.equal(s.elapsed,1250);assert.throws(()=>a.restWeather(s,false));assert.throws(()=>a.restWeather(a.newVoyageWeather(),true));
  assert.equal(a.voyageLight(a.restWeather({...s,elapsed:1800,override:null,until:0},true).elapsed).clock,'07:00');
});
test('root 5 weather survives archives; legacy balances and earned equipment remain intact',()=>{
  const p=current();p.credits=901;p.weather=a.holdWeather({...p.weather,elapsed:1250},'calm');
  const imported=a.readProgressImport(a.exportProgress(p));assert.deepEqual(imported.weather,p.weather);assert.equal(imported.credits,901);assert.equal(imported.saveVersion,5);
  const legacy=a.defaultProgress();assert.equal(a.normalizeProgress(legacy).saveVersion,2);assert.equal(a.normalizeProgress(legacy).weather,undefined);
  for(const change of [{weather:undefined},{weather:{...p.weather,elapsed:NaN}},{weather:{...p.weather,until:1249}},{weather:{...p.weather,until:1600}},{salvage:undefined},{rov:undefined}])assert.throws(()=>a.normalizeProgress({...p,...change}));
});
test('future root, nested version and named front block archive rollback before missing records',()=>{
  for(const patch of [{saveVersion:7},{weather:{version:2}},{weather:{version:1,override:'cyclone'}}])assert.throws(()=>a.normalizeProgress({...current(),...patch,rov:undefined}),a.ProgressLoadError);
});
test('salvage recovery preserves root 5 weather instead of downgrading an active voyage',()=>{
  const p=current();p.voyage=a.recordContractCompletion(p.voyage,a.contractById('bay-signal'));const c=a.SALVAGE_CACHES[0];
  const n=a.recoverSalvage(p,c.id,{x:c.x,y:-18,z:c.z},-20,0);assert.equal(n.saveVersion,5);assert.deepEqual(n.weather,p.weather);assert.equal(p.salvage.stock.alloy,0);
});
