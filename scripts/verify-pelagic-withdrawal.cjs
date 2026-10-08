// Disposable post-mission fixture verifies the supplied diver, not normally earned campaign progression.
async page=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));p.voyage.completed=p.voyage.completed.filter(id=>id!=='pelagic-record');delete p.voyage.completions['pelagic-record'];p.story.seen.push('observatory-report');Object.assign(p.expedition,{stage:'remote',checkpoint:'transect',sold:false,observatoryRecords:[]});localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(p));});
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();await page.locator('[data-cruise]').click();
  await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:120000});
  const frame=()=>page.locator('#game-root').evaluate(el=>JSON.parse(el.dataset.renderProfile)),inside=await frame();
  if(inside.characterSource!=='supplied'||Math.hypot(inside.position[0]-225,inside.position[2]+190)>4.8||inside.position[1]>inside.observatoryFloor+3.8)throw Error('Supplied diver did not enter chamber '+JSON.stringify(inside.position));
  await page.keyboard.press('KeyC');await page.waitForTimeout(1500);await page.screenshot({path:'output/playwright/pelagic-diver.png'});await page.locator('[data-mode-toggle]').click();
  const path=[];for(let i=0;i<120;i++){await page.waitForTimeout(500);const p=await frame();path.push({mode:p.mode,position:p.position});if(p.mode==='helm')break;}
  const final=await frame();if(final.mode!=='helm')throw Error('Diver return failed');const last=path.findLast(p=>p.mode==='swim');if(!last||Math.hypot(last.position[0]-final.vesselPosition[0],last.position[2]-final.vesselPosition[2])>7||last.position[1]<-3)throw Error('Boarded away from the actual vessel');
  if(!path.some(p=>p.mode==='swim'&&p.position[2]>-182&&p.position[1]<-20))throw Error('Withdrawal skipped underwater portal');
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(save.expedition.observatoryRecords.length||save.expedition.sold)throw Error('Diver manufactured a remote record');
  if(errors.length)throw Error(errors.join(';'));return{fixtureRemoteChapter:true,suppliedPlayer:true,enteredChamber:true,physicalPortalWithdrawal:true,boardedBesideVessel:true,noRemoteRecords:true,errors};
}
