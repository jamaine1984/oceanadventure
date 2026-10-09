// Dedicated CLI profile after verify-story-browser. Six prior chapter receipts are fixtures.
async page=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:720});
  const ready=async()=>{await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});await page.waitForFunction(()=>!!document.querySelector('#game-root').dataset.renderProfile,{},{timeout:90000});};
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'))),profile=()=>page.locator('#game-root').evaluate(e=>JSON.parse(e.dataset.renderProfile));
  const board=async()=>{await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();await page.locator('[data-atlas-view="voyages"]').click();};
  await board();if(!await page.locator('[data-mastery-start="coast"]').isDisabled())throw Error('Unearned mastery unlocked');await page.keyboard.press('Escape');
  await page.evaluate(async()=>{
    const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')),{newContractExpedition}=await import('/src/expedition-state.ts'),{STORY_SCENES}=await import('/src/story-state.ts');
    const ids=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive','pelagic-record'];p.voyage.completed=ids;p.voyage.completions=Object.fromEntries(ids.map(id=>[id,1]));p.voyage.blueprints=['survey-anchor','scooter-drive','research-rov'];p.voyage.activeWaypoint=undefined;p.story.seen=STORY_SCENES.map(s=>s.id);
    p.expedition=newContractExpedition('pelagic-record',6);Object.assign(p.expedition,{observatoryRecords:[0,1,2],sold:true,stage:'complete',saleCredits:1150});p.expeditions=6;p.credits=500;p.rov={version:1,owned:true,battery:100};p.shorePosition=undefined;delete p.mastery;localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(p));
  });await page.reload();await ready();await board();
  await page.evaluate(()=>window.failStorySave=true);await page.locator('[data-mastery-start="coast"]').click();if(!(await page.locator('.atlas__message').innerText()).includes('Could not save'))throw Error('Missing start failure');if((await saved()).mastery)throw Error('Failed start mutated state');await page.evaluate(()=>window.failStorySave=false);await page.locator('[data-mastery-start="coast"]').click();
  await page.locator('.atlas').waitFor({state:'hidden'});if((await saved()).saveVersion!==6||(await saved()).credits!==500)throw Error('Wrong departure receipt');
  const samples=[];
  for(let leg=0;leg<3;leg++){
    if(await page.locator('[data-cruise]').isDisabled())throw Error('Mastery helm assist unavailable');await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:180000});
    await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();if(await page.locator('[data-cruise]').isDisabled())throw Error('Mastery swim assist unavailable');await page.locator('[data-cruise]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-interact]').disabled,{},{timeout:120000});
    const state=await profile();if(state.characterSource!=='supplied'||state.mode!=='swim')throw Error('Wrong survey player');
    if(leg===0){
      await page.locator('[data-interact]').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).masteryReading>.3);await page.keyboard.down('KeyW');await page.waitForTimeout(120);await page.keyboard.up('KeyW');await page.waitForTimeout(600);if((await saved()).mastery.active.readings.length)throw Error('Moving reading was accepted');
      if(await page.locator('[data-cruise]').getAttribute('aria-pressed')==='false')await page.locator('[data-cruise]').click();await page.waitForFunction(()=>!document.querySelector('[data-interact]').disabled,{},{timeout:90000});
      await page.evaluate(()=>window.failStorySave=true);await page.locator('[data-interact]').click();await page.waitForFunction(()=>document.querySelector('[data-mastery-status]').textContent.includes('could not be saved'),{},{timeout:15000});if((await saved()).mastery.active.readings.length)throw Error('Failed reading changed record');await page.evaluate(()=>window.failStorySave=false);
    }
    await page.locator('[data-interact]').click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')).mastery.active.readings.length===n,leg+1,{timeout:20000});
    const receipt=await saved();if(receipt.credits!==500)throw Error('Mid-voyage payment');samples.push(receipt.mastery.active.readings.at(-1));await page.screenshot({path:`output/playwright/mastery-stop-${leg+1}.png`});
    if(leg===0){
      const anchor=receipt.mastery.active.anchor;await page.reload();await ready();const restored=await profile();if(restored.mastery.active.readings.length!==1||Math.hypot(restored.vesselPosition[0]-anchor.x,restored.vesselPosition[2]-anchor.z)>3)throw Error('Mastery checkpoint lost actual vessel');
    }else{
      await page.locator('[data-mode-toggle]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:120000});
    }
    if(leg===1){await board();await page.locator('[data-atlas-view="contracts"]').click();if(await page.locator('[data-accept-contract]:not(:disabled)').count())throw Error('Normal contract could replace active mastery');await page.keyboard.press('Escape');}
  }
  if(await page.locator('[data-cruise]').isDisabled())throw Error('Return assist unavailable');await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:180000});
  await board();if(await page.locator('[data-mastery-claim]').isDisabled())throw Error('Harbor payout unavailable');await page.evaluate(()=>window.failStorySave=true);await page.locator('[data-mastery-claim]').click();if((await saved()).credits!==500||(await saved()).mastery.active===null)throw Error('Failed payout mutated report');await page.evaluate(()=>window.failStorySave=false);await page.locator('[data-mastery-claim]').click();
  let final=await saved();if(final.credits!==1400||final.mastery.counts.coast!==1||final.mastery.active!==null||final.expeditions!==7)throw Error('Wrong final mastery receipt');if(await page.locator('[data-mastery-claim]').count())throw Error('Paid report still claimable');await page.screenshot({path:'output/playwright/mastery-paid-report.png'});
  for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(size);const b=await page.locator('.atlas').boundingBox();if(b.x<0||b.y<0||b.x+b.width>size.width+1||b.y+b.height>size.height+1)throw Error('Voyages atlas offscreen');
    if(await page.locator('.atlas').evaluate(e=>e.scrollWidth>e.clientWidth))throw Error('Atlas horizontal overflow');await page.screenshot({path:`output/playwright/mastery-board-${size.width}x${size.height}.png`});
  }
  await page.setViewportSize({width:1280,height:720});await page.locator('[data-mastery-start="coast"]').click();final=await saved();if(final.mastery.active.run!==2||(await profile()).masteryStation.id!=='lagoon')throw Error('Repeat route did not rotate');
  await board();await page.locator('[data-mastery-abandon]').click();await page.getByRole('button',{name:'Keep voyage',exact:true}).click();if(!(await saved()).mastery.active)throw Error('Keep voyage discarded records');await page.locator('[data-mastery-abandon]').click();await page.getByRole('button',{name:'Discard field records',exact:true}).click();if((await saved()).credits!==1400||(await saved()).mastery.active)throw Error('Abandon altered earned balance');await page.reload();await ready();if((await saved()).mastery.counts.coast!==1||(await saved()).credits!==1400)throw Error('Paid mastery lost on reload');
  if(errors.length)throw Error(errors.join(';'));return{errors,priorChaptersSeeded:6,startingCredits:500,actualStationRecords:samples,interruptedReading:true,protectedFailures:['start','reading','payment'],actualCheckpointReload:true,actualReturnAndPayment:900,finalCredits:1400,repeatRotation:true,confirmedAbandon:true,viewports:4};
}
