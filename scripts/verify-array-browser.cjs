// Run after verify-story-browser.cjs in the same isolated CLI profile.
async page=>{
  await page.setViewportSize({width:1280,height:720});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));p.credits=0;p.expeditions=3;p.voyage.completed=['bay-signal','lagoon-echo','passage-origin'];p.voyage.completions={'bay-signal':1,'lagoon-echo':1,'passage-origin':1};p.voyage.activeWaypoint=undefined;p.story.seen=['welcome','recorder','bay-report','lagoon-pulse','lagoon-report','array-report'];p.expedition={version:2,run:4,route:'reef',contractId:'bay-signal',stage:'briefing',photos:[],photoImages:{},transectReadings:[],waterSample:false,sedimentSample:false,cableFreed:false,sensorRecovered:false,sold:false,checkpoint:'harbor',saleCredits:0,grantState:'unclaimed',grantCredits:0};localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(p));});
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();await page.getByRole('button',{name:'Contracts',exact:true}).click();await page.getByRole('button',{name:'Limestone Passage',exact:true}).click();
  await page.locator('[data-accept-contract="array-repair"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-objective]').textContent==='Sail to the array service station');
  await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:150000});
  await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();await page.locator('[data-cruise]').click();
  await page.waitForFunction(()=>document.querySelector('[data-interact]').textContent==='Commission array / F',{},{timeout:90000});
  await page.evaluate(()=>{window.withdrawalTrace=[];window.withdrawalTimer=setInterval(()=>{const p=JSON.parse(document.querySelector('#game-root').dataset.renderProfile);if(p.mode==='swim')window.withdrawalTrace.push(p);},100);});
  await page.locator('[data-mode-toggle]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:90000});
  const trace=await page.evaluate(()=>{clearInterval(window.withdrawalTimer);return window.withdrawalTrace;});const last=trace.at(-1);
  if(trace.length<10||!last||last.position[1]<last.vesselPosition[1]-1.6||Math.hypot(last.position[0]-last.vesselPosition[0],last.position[2]-last.vesselPosition[2])>10)throw Error('Withdrawal skipped real ascent or boarded away from vessel');
  await page.locator('[data-mode-toggle]').click();await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-interact]').textContent==='Commission array / F',{},{timeout:90000});
  await page.screenshot({path:'output/playwright/array-arrival.png'});
  await page.keyboard.press('f');const dialog=page.locator('[data-array-service]');await dialog.waitFor({state:'visible'});
  if(await page.locator('[data-commission-array]').isEnabled())throw Error('Untested feed enabled');
  await page.getByRole('button',{name:'Test isolated circuits',exact:true}).click();if(await page.locator('[data-commission-array]').isEnabled())throw Error('Wrong circuits enabled');
  await page.getByLabel('West source',{exact:true}).selectOption('2');await page.getByLabel('West reversed polarity',{exact:true}).check();await page.getByLabel('Center source',{exact:true}).selectOption('0');await page.getByLabel('North source',{exact:true}).selectOption('1');await page.getByLabel('North reversed polarity',{exact:true}).check();
  await page.getByRole('button',{name:'Test isolated circuits',exact:true}).click();
  if(!await page.locator('[data-commission-array]').isEnabled())throw Error('Correct circuit rejected');
  for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){await page.setViewportSize(size);const r=await dialog.boundingBox();if(r.x<0||r.y<0||r.x+r.width>size.width+1||r.y+r.height>size.height+1)throw Error('Service panel offscreen');await page.screenshot({path:`output/playwright/array-${size.width}x${size.height}.png`});}
  await page.evaluate(()=>window.failStorySave=true);await page.locator('[data-commission-array]').click();if(!(await dialog.innerText()).includes('could not be saved'))throw Error('No save failure');
  if(JSON.parse(await page.evaluate(()=>localStorage.getItem('ocean-adventure-progress-v1'))).expedition.arrayRestored)throw Error('Failed write committed');
  await page.evaluate(()=>window.failStorySave=false);await page.locator('[data-commission-array]').click();await dialog.waitFor({state:'hidden'});await page.setViewportSize({width:1280,height:720});
  if(await page.locator('[data-credits]').innerText()!=='0')throw Error('Repair granted premature payout');
  await page.locator('[data-mode-toggle]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:90000});
  await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-walk]').disabled===false,{},{timeout:180000});
  await page.locator('[data-stand]').click();await page.locator('[data-cash-in]').click();if(await page.locator('[data-harbor-credits]').innerText()!=='800')throw Error('Wrong payout');if(await page.locator('[data-cash-in]').isEnabled())throw Error('Double pay possible');
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(save.credits!==800||!save.expedition.sold||!save.voyage.completed.includes('array-repair'))throw Error('Receipt lost');
  if(errors.length)throw Error(errors.join(';'));return{errors,seededPrerequisiteChapters:3,restorationEarnedThroughControls:true,credits:save.credits,viewportCount:4};
}
