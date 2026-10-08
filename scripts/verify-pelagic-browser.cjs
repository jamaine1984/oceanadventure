// Dedicated CLI profile only; prerequisite receipts and ownership are fixture data, not earned campaign proof.
async page=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:720});
  const ready=()=>page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  const profile=()=>page.locator('#game-root').evaluate(el=>JSON.parse(el.dataset.renderProfile));
  await page.evaluate(()=>{
    const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));p.credits=0;p.expeditions=5;p.saveVersion=3;p.rov={version:1,owned:true,battery:100};p.shorePosition=undefined;
    p.voyage.completed=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive'];p.voyage.completions=Object.fromEntries(p.voyage.completed.map(id=>[id,1]));p.voyage.blueprints=[];
    p.story.seen=['welcome','recorder','bay-report','lagoon-pulse','lagoon-report','array-report','restoration-report','freighter-report'];
    Object.assign(p.expedition,{version:3,route:'reach',contractId:'reach-archive',stage:'complete',checkpoint:'harbor',sold:true,interiorSteps:[0,1,2,3],saleCredits:1100});
    localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(p));
  });
  await page.reload();await ready();await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();await page.getByRole('button',{name:'Contracts',exact:true}).click();await page.getByRole('button',{name:'Pelagic Observatory',exact:true}).click();await page.locator('[data-accept-contract="pelagic-record"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-objective]').textContent.includes('Observatory'));await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:240000});
  await page.locator('[data-rov-launch]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='rov');await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).observatoryLoaded,{},{timeout:60000});
  await page.locator('[data-cruise]').click();await page.keyboard.press('KeyC');await page.waitForFunction(()=>!document.querySelector('[data-rov-acquire]').disabled,{},{timeout:180000});
  await page.screenshot({path:'output/playwright/pelagic-clock.png'});
  await page.evaluate(()=>window.failStorySave=true);await page.locator('[data-rov-acquire]').click();await page.waitForFunction(()=>document.querySelector('[data-rov-feedback]').textContent.includes('could not be saved'),{},{timeout:10000});
  if((await saved()).credits!==0||(await saved()).expedition.observatoryRecords.length)throw Error('Failed terminal write changed records or bank');await page.evaluate(()=>window.failStorySave=false);
  await page.locator('[data-rov-acquire]').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).observatoryRecords.length===1);
  // Reload partial progress: re-enter from the real boat checkpoint, never teleport inside the chamber.
  await page.reload();await ready();if((await saved()).expedition.observatoryRecords.length!==1)throw Error('Lost partial terminal');await page.locator('[data-rov-launch]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='rov');await page.locator('[data-cruise]').click();await page.keyboard.press('KeyC');
  for(let index=1;index<3;index++){
    await page.waitForFunction(()=>!document.querySelector('[data-rov-acquire]').disabled,{},{timeout:180000});
    if(index===1){await page.keyboard.down('KeyD');await page.waitForTimeout(1700);await page.keyboard.up('KeyD');if(await page.locator('[data-rov-acquire]').isEnabled())throw Error('Wrong-facing terminal can be read');await page.locator('[data-cruise]').click();await page.waitForFunction(()=>!document.querySelector('[data-rov-acquire]').disabled,{},{timeout:30000});}
    await page.locator('[data-rov-acquire]').click();await page.waitForFunction(n=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).observatoryRecords.length===n,index+1);
    if(index===1)await page.locator('[data-cruise]').click();
  }
  const cargo=await saved();if(cargo.credits!==0||cargo.expedition.sold||cargo.expedition.stage!=='return')throw Error('Remote mission paid before harbor');
  const views=[];for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(size);await page.screenshot({path:`output/playwright/pelagic-${size.width}x${size.height}.png`});const panel=await page.locator('.rov-tools').boundingBox();if(panel.x<0||panel.y<0||panel.x+panel.width>size.width+1||panel.y+panel.height>size.height+1)throw Error('ROV panel outside viewport');
    const pixels=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('#canvas-host canvas'),0,0,24,24);const p=ctx.getImageData(0,0,24,24).data,colors=new Set();let sum=0;for(let i=0;i<p.length;i+=4){colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);sum+=p[i]+p[i+1]+p[i+2];}resolve({colors:colors.size,brightness:sum/1728});})));
    if(pixels.colors<40||pixels.brightness<15)throw Error('Blank underwater viewport');views.push({size,pixels});
  }
  await page.setViewportSize({width:1280,height:720});await page.keyboard.press('KeyE');await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:240000});await page.getByRole('button',{name:'Harbor',exact:true}).click();await page.locator('[data-cash-in]').click();
  const paid=await saved();if(paid.credits!==1150||!paid.voyage.completed.includes('pelagic-record')||!paid.expedition.sold)throw Error('Incorrect observatory payment');if(await page.locator('[data-cash-in]').isEnabled())throw Error('Duplicate payment enabled');
  await page.reload();await ready();if((await saved()).credits!==1150||(await saved()).expedition.observatoryRecords.length!==3)throw Error('Paid receipt did not persist');
  if(errors.length)throw Error(errors.join(';'));return{seededPrerequisiteReceipts:5,seededOwnedRov:true,startingCredits:0,failedWriteProtected:true,partialReload:true,wrongFacingBlocked:true,actualTerminalReads:3,harborPayment:1150,duplicateSaleBlocked:true,views,errors};
}
