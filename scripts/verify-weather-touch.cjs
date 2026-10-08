// Private browser context with copied earned opening receipt and accelerated clock only.
async page=>{
  const receipt=await page.evaluate(()=>localStorage.getItem('ocean-adventure-progress-v1'));
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const touch=await context.newPage(),errors=[];touch.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(p=>{localStorage.setItem('ocean-adventure-progress-v1',p);localStorage.setItem('ocean-adventure-graphics','performance');},receipt);
  try{
    await touch.goto('http://localhost:5174/?profile');await touch.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});await touch.waitForFunction(()=>!!document.querySelector('#game-root').dataset.renderProfile,{},{timeout:90000});
    const sizes=[];
    for(const size of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
      await touch.setViewportSize(size);await touch.getByRole('button',{name:'More voyage actions',exact:true}).tap();await touch.getByRole('button',{name:'Forecast',exact:true}).tap();
      const dialog=touch.locator('[data-forecast]');await dialog.getByRole('button',{name:'Storm',exact:true}).tap();
      if(await dialog.locator('[data-weather="storm"]').getAttribute('aria-pressed')!=='true')throw Error('Touch storm override failed');
      const stored=await touch.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(stored.weather.override!=='storm')throw Error('Touch weather not saved');
      await dialog.getByRole('button',{name:'Scheduled weather',exact:true}).tap();
      for(const button of await dialog.locator('button').all()){await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();if(b.height<44||b.x<0||b.y<0||b.x+b.width>size.width+1||b.y+b.height>size.height+1)throw Error('Touch target clipped or small: '+JSON.stringify({size,text:await button.textContent(),box:b}));}
      await touch.screenshot({path:`output/playwright/weather-touch-${size.width}x${size.height}.png`});
      await dialog.getByRole('button',{name:'Close forecast',exact:true}).tap();await dialog.waitFor({state:'hidden'});
      const frame=await touch.locator('#game-root').evaluate(e=>JSON.parse(e.dataset.renderProfile).frame);await touch.waitForFunction(n=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).frame>n,frame);
      sizes.push(size);
    }
    if(errors.length)throw Error(errors.join(';'));return{errors,emulatedTouch:true,openingReceiptCopied:true,viewports:sizes,actualWeatherTaps:true};
  }finally{await context.close();}
}
