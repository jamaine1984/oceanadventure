// Final desktop control regression on the paid private-profile voyage.
async page=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:720});
  await page.locator('[data-mode-toggle]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='swim');
  if(await page.locator('.inventory').isVisible())throw Error('Mode activation clicked through to inventory');
  const pixels=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('#canvas-host canvas'),0,0,24,24);const b=ctx.getImageData(0,0,24,24).data;resolve({colors:new Set(Array.from({length:576},(_,i)=>`${b[i*4]},${b[i*4+1]},${b[i*4+2]}`)).size,brightness:b.reduce((n,v,i)=>n+(i%4===3?0:v),0)/1728});})));
  if(pixels.colors<40||pixels.brightness<5)throw Error('Blank desktop dive');await page.keyboard.press('KeyC');await page.waitForTimeout(400);await page.screenshot({path:'output/playwright/mastery-final-diver.png'});
  const p=await page.locator('#game-root').evaluate(e=>JSON.parse(e.dataset.renderProfile));if(p.characterSource!=='supplied'||!p.diverNdc)throw Error('Supplied third-person diver missing');
  await page.locator('[data-mode-toggle]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:120000});
  if(errors.length)throw Error(errors.join(';'));return{errors,nativeEnterModeActivation:true,noInventoryClickThrough:true,actualReturnToHelm:true,suppliedPlayer:true,pixels};
}
