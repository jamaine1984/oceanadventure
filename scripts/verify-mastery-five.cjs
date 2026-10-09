// Continue the actual coastal replay's paid private-profile voyage. No field records are seeded.
async page=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  await page.setViewportSize({width:1280,height:720});const before=await saved();if(before.credits!==1400||before.mastery?.counts.coast!==1||before.mastery.active)throw Error('Run coastal replay first');
  await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();await page.locator('[data-atlas-view="voyages"]').click();await page.locator('[data-mastery-start="waters"]').click();await page.locator('.atlas').waitFor({state:'hidden'});
  const records=[];
  for(let index=0;index<5;index++){
    if(await page.locator('[data-cruise]').isDisabled())throw Error('Five-region assist disabled');await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:180000});
    await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();await page.locator('[data-cruise]').click();await page.waitForFunction(()=>!document.querySelector('[data-interact]').disabled,{},{timeout:120000});
    await page.locator('[data-interact]').click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')).mastery.active.readings.length===n,index+1,{timeout:20000});
    const p=await saved();if(p.credits!==1400)throw Error('Mid-voyage payout');records.push(p.mastery.active.readings.at(-1));await page.screenshot({path:`output/playwright/mastery-five-${index+1}.png`});
    await page.locator('[data-mode-toggle]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:120000});
  }
  await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:180000});
  await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();await page.locator('[data-atlas-view="voyages"]').click();await page.locator('[data-mastery-claim]').click();const paid=await saved();
  if(paid.credits!==2900||paid.mastery.counts.waters!==1||paid.mastery.counts.coast!==1||paid.mastery.active||paid.expeditions!==8)throw Error('Five-region payment incorrect');
  await page.screenshot({path:'output/playwright/mastery-five-archived.png'});await page.keyboard.press('Escape');
  if(errors.length)throw Error(errors.join(';'));return{errors,priorChapterFixtureRetained:true,newFieldRecordsAllActual:true,records,actualHarborPayment:1500,finalCredits:2900};
}
