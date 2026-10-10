// Local production package in a cross-origin iframe; not a public hosting check.
async page=>{
  await page.setViewportSize({width:1280,height:720});
  await page.unroute('http://localhost:4175/');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:5174/scripts/fixtures/production-embed.html');
  const game=page.frameLocator('#game');await game.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  await game.getByRole('button',{name:'Accept expedition',exact:true}).click();
  const root=game.locator('#game-root'),pose=()=>root.evaluate(el=>JSON.parse(el.dataset.renderProfile).vesselPosition);
  const before=await pose();await game.locator('[data-cruise]').focus();await page.keyboard.down('w');await page.waitForTimeout(2500);await page.keyboard.up('w');const moved=await pose();
  if(Math.hypot(moved[0]-before[0],moved[2]-before[2])<1)throw Error('Iframe keyboard helm input did not move vessel');
  await game.locator('[data-mode-toggle]').click();await page.waitForTimeout(500);
  if(await root.getAttribute('data-player-mode')!=='swim')throw Error('Iframe dive input failed');
  await game.getByRole('button',{name:'Open inventory',exact:true}).click();
  const frame=await root.getAttribute('data-render-profile');await page.waitForTimeout(1200);if(await root.getAttribute('data-render-profile')!==frame)throw Error('Embedded inventory did not pause simulation');
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
  await game.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await root.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));return {credits:p.credits,stage:p.expedition.stage};});
  const scripts=await root.evaluate(()=>[...document.scripts].map(s=>s.src).filter(s=>/googlesyndication|doubleclick|crazygames-sdk|poki-sdk/.test(s)));
  if(scripts.length||saved.credits!==0)throw Error('Unexpected provider scripts or unearned bank');
  await page.screenshot({path:'output/playwright/production-cross-origin-embed.png'});
  if(errors.length)throw Error(errors.join(';'));
  return {topOrigin:'http://localhost:5174',gameOrigin:'http://localhost:4174',productionPackage:true,localOnly:true,crossOriginSameSite:true,keyboardMovement:true,dive:true,inventoryPause:true,save:saved,adScripts:scripts,errors};
}
