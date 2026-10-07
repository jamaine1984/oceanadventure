// Run only in a dedicated Playwright CLI profile: this resets that profile's voyage.
async page=>{
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!sessionStorage.getItem('story-isolated-start')){localStorage.clear();sessionStorage.clear();sessionStorage.setItem('story-isolated-start','1');}localStorage.setItem('ocean-adventure-graphics','performance');const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.failStorySave&&key==='ocean-adventure-progress-v1')throw Error('quota');return write.call(this,key,value);};});
  await page.goto('http://localhost:5174/?profile');
  await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
  const dialog=page.locator('[data-story-dialog]');await dialog.waitFor({state:'visible'});
  if(await page.locator('#story-radio-title').innerText()!=='The Lost Signal')throw Error('Opening missing');
  await page.getByRole('button',{name:'Ask about the signal',exact:true}).click();
  if(!(await dialog.innerText()).includes('Three short pulses'))throw Error('Question branch missing');
  await page.screenshot({path:'output/playwright/story-question-desktop.png'});
  await page.evaluate(()=>window.failStorySave=true);
  await page.getByRole('button',{name:'Accept expedition',exact:true}).click();
  await page.waitForTimeout(250);if(!(await dialog.innerText()).includes('could not be saved'))throw Error('Missing save failure');
  if(await page.locator('[data-objective]').innerText()!=='Begin your research expedition')throw Error('Failed departure mutated live state');
  if(!(await page.getByRole('button',{name:'Accept expedition',exact:true}).evaluate(el=>el===document.activeElement)))throw Error('Failure lost focus');
  await page.evaluate(()=>window.failStorySave=false);
  await page.getByRole('button',{name:'Accept expedition',exact:true}).click();await dialog.waitFor({state:'hidden'});
  let save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  if(save.expedition.stage!=='reef'||!save.story.seen.includes('welcome')||save.credits||save.expedition.photos.length)throw Error('Opening receipt invalid');
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(500);
  if(await dialog.isVisible())throw Error('Completed opening replayed');
  await page.getByRole('button',{name:'Radio',exact:true}).click();
  for(const name of ['Ivo','Selene','Mara']){await page.getByRole('button',{name,exact:true}).click();const image=dialog.locator('img');await image.evaluate(img=>img.decode());if(!(await image.evaluate(img=>img.naturalWidth>0)))throw Error('Portrait failed');}
  const frame=()=>page.locator('#game-root').evaluate(el=>JSON.parse(el.dataset.renderProfile));
  const before=await frame();await page.waitForTimeout(2000);const after=await frame();if(after.frame!==before.frame)throw Error('Conversation did not pause simulation');
  for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){await page.setViewportSize(size);await page.waitForTimeout(300);const r=await dialog.boundingBox();if(r.x<0||r.y<0||r.x+r.width>size.width+1||r.y+r.height>size.height+1)throw Error('Dialog offscreen');await page.screenshot({path:`output/playwright/story-${size.width}x${size.height}.png`});}
  await page.keyboard.press('Escape');await page.waitForTimeout(700);if(await dialog.isVisible())throw Error('Escape immediately reopened radio');
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('button',{name:'Open inventory',exact:true}).click();await page.keyboard.press('Escape');
  save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  if(save.credits||save.expedition.photos.length||save.expedition.waterSample||save.expedition.sensorRecovered)throw Error('Radio granted research');
  if(errors.length)throw Error(errors.join('; '));return {errors,openingSaved:true,departure:'reef',savedCredits:save.credits,portraitNames:['Mara','Ivo','Selene'],viewports:4};
}
