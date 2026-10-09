// Dedicated disposable CLI profile only. Each invocation earns one chapter;
// no mission receipts, equipment, credits, poses or simulation clocks are injected.
async page => {
  page.setDefaultTimeout(15000);
  await page.setViewportSize({width:1280,height:720});
  const errors=[]; const onError=e=>errors.push(e.message); page.on('pageerror',onError);
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  const ready=()=>page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  const radio=async()=>{
    const dialog=page.locator('[data-story-dialog]');
    if(await dialog.isVisible()) {
      const title=await page.locator('#story-radio-title').innerText();
      const buttons=dialog.locator('[data-story-choice]');
      if(await buttons.count())await buttons.last().click();
      else if(await page.getByRole('button',{name:'Accept expedition',exact:true}).isVisible())await page.getByRole('button',{name:'Accept expedition',exact:true}).click();
      else await dialog.getByRole('button').last().click();
      console.log('Campaign conversation:',title);
    }
  };
  const until=async(predicate,label,ms=120000)=>{
    const start=Date.now();
    while(Date.now()-start<ms){await radio();if(await predicate())return;await page.waitForTimeout(250);}
    throw Error(`${label}: ${await page.locator('[data-objective]').innerText()} / ${await page.locator('#game-root').getAttribute('data-render-profile')}`);
  };
  const mode=()=>page.locator('#game-root').getAttribute('data-player-mode');
  const assist=page.locator('[data-cruise]'),interact=page.locator('[data-interact]');
  const cruise=async()=>{if(await assist.getAttribute('aria-pressed')!=='true')await assist.click();};
  const sail=async()=>{await cruise();await until(async()=>await assist.getAttribute('aria-pressed')==='false','Sailing arrival',240000);};
  const board=async()=>{await radio();await page.locator('[data-mode-toggle]').click();await until(async()=>await mode()==='helm','Physical vessel return');};
  await ready(); await radio();
  let p=await save();
  const chapters=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive','pelagic-record'];
  let ledger=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campaign-earned-ledger')||'[]'));
  if(!ledger.length) {
    const r=p.expedition;
    if(p.credits!==0||p.expeditions!==0||p.voyage.completed.length||r.contractId!=='bay-signal'||r.photos.length||r.waterSample||r.sedimentSample||r.cableFreed||r.sensorRecovered||p.rov?.owned||p.fieldEquipment?.scooter)throw Error('A verified untouched fresh campaign is required');
    if(Object.values(p.upgrades).some(n=>n!==0)||p.activeBoat!=='aurora'||JSON.stringify(p.ownedBoats)!=='["aurora"]'||p.achievements.length||p.discoveredSpecies.length||Object.keys(p.collectionPhotos).length||p.voyage.blueprints.length||p.salvage?.recovered.length||Object.values(p.salvage?.stock??{}).some(n=>n!==0)||p.salvage?.capacitor||p.salvage?.pod.built||p.mastery?.active||p.mastery?.last||Object.values(p.mastery?.counts??{}).some(n=>n!==0))throw Error('Fresh campaign has pre-earned inventory or mastery');
  } else if(p.credits!==ledger.at(-1).bank||JSON.stringify(p.voyage.completed)!==JSON.stringify(ledger.map(r=>r.id)))throw Error('Earned campaign continuity lost');
  if(p.expeditions===0&&p.credits===0&&!p.voyage.completed.length) {
    await page.evaluate(()=>localStorage.setItem('ocean-adventure-graphics','performance'));
    await page.reload();await ready();await radio();
  }
  if(p.expedition.sold||p.expedition.stage==='briefing') {
    await page.getByRole('button',{name:'Harbor',exact:true}).click();
    await page.locator('[data-next-expedition]').click();await radio();
  }
  p=await save(); const id=p.expedition.contractId,startingCredits=p.credits,prior=[...p.voyage.completed];
  if(id!==chapters[ledger.length]||prior.length!==ledger.length)throw Error('Chapter order does not match the earned ledger');
  if(prior.includes(id))throw Error('Refusing to replay a paid chapter as fresh campaign evidence');
  await page.evaluate(()=>{
    window.campaignFrames=[];window.campaignStart=performance.now();window.campaignLast=-1;
    const collect=()=>{
      const text=document.querySelector('#game-root').dataset.renderProfile;
      if(text){const f=JSON.parse(text);if(f.frame!==window.campaignLast){window.campaignLast=f.frame;if(window.campaignFrames.length<90000)window.campaignFrames.push([f.frameMs,f.updateMs,f.renderMs,f.calls,f.triangles,f.mode,f.weatherKey]);}}
      window.campaignRaf=requestAnimationFrame(collect);
    };window.campaignRaf=requestAnimationFrame(collect);
  });
  console.log('Campaign chapter:',id,'earned predecessors',prior,'credits',startingCredits);
  const plan={reef:{photos:3,samples:true},lagoon:{photos:2,samples:true},passage:{photos:2,samples:true}};
  let current=await save();const requirements=plan[current.expedition.route];
  await sail();
  if(id==='pelagic-record') {
    await page.locator('[data-rov-launch]').click();await until(async()=>await mode()==='rov','ROV launch');
    await page.keyboard.press('c');
    for(let n=0;n<3;n++) {
      await cruise();await until(()=>page.locator('[data-rov-acquire]').isEnabled(),'Optical terminal arrival',180000);
      await page.locator('[data-rov-acquire]').click();await until(async()=>(await save()).expedition.observatoryRecords.length===n+1,'Terminal dwell');
      await page.screenshot({path:`output/playwright/campaign-${id}-${n+1}.png`});
    }
    await page.keyboard.press('e');await until(async()=>await mode()==='helm','ROV recall');
  } else {
    await page.locator('[data-mode-toggle]').click();await until(async()=>await mode()==='swim','Dive');
    if(['bay-signal','lagoon-echo','passage-origin'].includes(id)) {
      for(let n=0;n<requirements.photos;n++) {
        await page.locator('[data-tool="camera"]').click();await cruise();await until(()=>interact.isEnabled(),'Actual photograph');
        await interact.click();await until(async()=>(await save()).expedition.photos.length===n+1,'Photo record');
      }
      for(let n=0;n<2;n++) {
        await page.locator('[data-tool="sampler"]').click();await cruise();await until(()=>interact.isEnabled(),'Sample approach');
        await interact.click();await until(async()=>{const r=(await save()).expedition;return n?r.waterSample&&r.sedimentSample:r.waterSample||r.sedimentSample;},'Sample record');
      }
      await board();await sail();await page.locator('[data-mode-toggle]').click();await until(async()=>await mode()==='swim','Second dive');
      if(id==='bay-signal') {
        await page.locator('[data-tool="cutter"]').click();await cruise();await until(()=>interact.isEnabled(),'Cable approach');await interact.click();
        await until(async()=>(await save()).expedition.cableFreed,'Cable record');
        await page.locator('[data-tool="scanner"]').click();await cruise();await until(async()=>await assist.getAttribute('aria-pressed')==='false','Sensor approach');await interact.click();
        await until(async()=>(await save()).expedition.sensorRecovered,'Sensor record');
      } else {
        for(let n=0;n<3;n++) {
          await page.locator('[data-tool="scanner"]').click();await cruise();await until(()=>interact.isEnabled(),'Stable station approach');await interact.click();
          await until(async()=>(await save()).expedition.transectReadings.length===n+1,'Actual station dwell');
        }
      }
    } else if(id==='array-repair') {
      await page.locator('[data-tool="scanner"]').click();await cruise();await until(async()=>await interact.innerText()==='Commission array / F','Cabinet approach');await interact.click();
      await page.getByLabel('West source',{exact:true}).selectOption('2');await page.getByLabel('West reversed polarity',{exact:true}).check();
      await page.getByLabel('Center source',{exact:true}).selectOption('0');await page.getByLabel('North source',{exact:true}).selectOption('1');await page.getByLabel('North reversed polarity',{exact:true}).check();
      await page.getByRole('button',{name:'Test isolated circuits',exact:true}).click();await page.locator('[data-commission-array]').click();
      await until(async()=>(await save()).expedition.arrayRestored,'Commissioning record');
    } else if(id==='reach-archive') {
      for(let n=0;n<4;n++) {
        await page.locator(`[data-tool="${n===1?'cutter':'scanner'}"]`).click();await cruise();await until(()=>interact.isEnabled(),'Freighter step',180000);await interact.click();
        await until(async()=>(await save()).expedition.interiorSteps.length===n+1,'Freighter field record');
        await page.screenshot({path:`output/playwright/campaign-${id}-${n+1}.png`});
      }
    } else throw Error('Unexpected campaign contract '+id);
    await page.screenshot({path:`output/playwright/campaign-${id}-field.png`});await board();
  }
  if((await save()).credits!==startingCredits)throw Error('Field work changed bank before sale');
  await sail();await until(()=>page.locator('[data-walk]').isEnabled(),'Mooring');
  await page.getByRole('button',{name:'Harbor',exact:true}).click();await page.locator('[data-cash-in]').click();await radio();
  const paid=await save();if(!paid.voyage.completed.includes(id)||!paid.expedition.sold||await page.locator('[data-cash-in]').isEnabled())throw Error('Missing pay-once receipt');
  if(prior.some(x=>!paid.voyage.completed.includes(x)))throw Error('Earlier earned chapter lost');
  await page.screenshot({path:`output/playwright/campaign-${id}-paid.png`});
  const performance=await page.evaluate(()=>{
    cancelAnimationFrame(window.campaignRaf);
    const quantile=(a,p)=>a.sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
    const groups={};for(const f of window.campaignFrames){if(!groups[f[5]])groups[f[5]]=[];groups[f[5]].push(f);}
    const canvas=document.querySelector('#canvas-host canvas'),gl=canvas.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {wallSeconds:(performance.now()-window.campaignStart)/1000,viewport:[innerWidth,innerHeight],hardware:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),scale:JSON.parse(document.querySelector('#game-root').dataset.renderProfile).scale,graphics:localStorage.getItem('ocean-adventure-graphics'),startup:JSON.parse(document.querySelector('#game-root').dataset.startupProfile),groups:Object.fromEntries(Object.entries(groups).map(([mode,a])=>{const ms=a.reduce((s,f)=>s+f[0],0);return[mode,{frames:a.length,activeSeconds:ms/1000,fps:a.length*1000/ms,p95Ms:quantile(a.map(f=>f[0]),.95),p99Ms:quantile(a.map(f=>f[0]),.99),updateP95Ms:quantile(a.map(f=>f[1]),.95),renderP95Ms:quantile(a.map(f=>f[2]),.95)}];}))};
  });
  await page.keyboard.press('Escape');await radio();
  const expected={ 'bay-signal':1510,'lagoon-echo':1540,'passage-origin':1680,'array-repair':800,'reach-archive':1100,'pelagic-record':1150 }[id];
  if(paid.credits-startingCredits!==expected||paid.expedition.saleCredits!==expected)throw Error('Incorrect chapter payout');
  let spent=0;
  if(id==='bay-signal') {
    await page.getByRole('button',{name:'Open inventory',exact:true}).click();await page.getByRole('button',{name:'Equipment',exact:true}).click();await page.locator('[data-inventory-upgrade="tank"]').click();
    if((await save()).upgrades.tank!==1)throw Error('Earned tank upgrade missing');spent=350;await page.keyboard.press('Escape');
  }
  if(id==='reach-archive') {
    await page.getByRole('button',{name:'Open inventory',exact:true}).click();await page.getByRole('button',{name:'Equipment',exact:true}).click();await page.locator('[data-fabricate-rov]').click();
    await until(async()=>(await save()).rov?.owned,'Earned ROV fabrication');spent=900;await page.keyboard.press('Escape');
  }
  await page.reload();await ready();await radio();const persisted=await save();
  if(!persisted.voyage.completed.includes(id)||persisted.credits!==paid.credits-spent||persisted.upgrades.tank!==1)throw Error('Paid bank/upgrade did not persist');
  if(JSON.stringify(persisted.voyage.completed)!==JSON.stringify([...prior,id]))throw Error('Reload lost the complete earned campaign ledger');
  if(['engine','hull','fins','light'].some(k=>persisted.upgrades[k]!==0)||persisted.activeBoat!=='aurora'||JSON.stringify(persisted.ownedBoats)!=='["aurora"]'||persisted.fieldEquipment?.scooter||persisted.salvage?.recovered.length||Object.values(persisted.salvage?.stock??{}).some(n=>n!==0)||persisted.salvage?.capacitor||persisted.salvage?.pod.built||persisted.mastery?.active)throw Error('Unpurchased campaign advantage detected');
  if(id==='reach-archive'&&(!persisted.rov?.owned||!persisted.voyage.blueprints.includes('research-rov')))throw Error('Paid ROV ownership or earned blueprint lost');
  page.off('pageerror',onError);if(errors.length)throw Error(errors.join(';'));
  const result={id,freshSaveCampaign:true,seededReceipts:0,prior,startingCredits,payment:paid.credits-startingCredits,spent,bank:persisted.credits,completed:persisted.voyage.completed,rovOwned:persisted.rov?.owned,performance,errors};
  ledger.push(result);await page.evaluate(records=>sessionStorage.setItem('campaign-earned-ledger',JSON.stringify(records)),ledger);
  return result;
}
