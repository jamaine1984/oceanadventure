// Paid coastal receipt copied to a private touch context; vessel position near the first stop is a fixture.
async page=>{
  const receipt=await page.evaluate(()=>localStorage.getItem('ocean-adventure-progress-v1'));
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),touch=await context.newPage(),errors=[];touch.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(p=>{localStorage.setItem('ocean-adventure-progress-v1',p);localStorage.setItem('ocean-adventure-graphics','performance');},receipt);
  try{
    await touch.goto('http://localhost:5174/?profile');await touch.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});await touch.waitForFunction(()=>!!document.querySelector('#game-root').dataset.renderProfile,{},{timeout:90000});
    const views=[];
    for(const size of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
      await touch.setViewportSize(size);await touch.getByRole('button',{name:'More voyage actions',exact:true}).tap();await touch.getByRole('button',{name:'Open voyage atlas',exact:true}).tap();await touch.locator('[data-atlas-view="voyages"]').tap();
      const atlas=touch.locator('.atlas');if(await atlas.evaluate(e=>e.scrollWidth>e.clientWidth))throw Error('Touch atlas overflow');
      for(const tab of await touch.locator('[data-atlas-view]').all()){const b=await tab.boundingBox();if(b.height<44||b.x<0||b.x+b.width>size.width+1)throw Error('Voyage tabs too small or clipped');}
      const start=touch.locator('[data-mastery-start="waters"]');await start.scrollIntoViewIfNeeded();const b=await start.boundingBox();if(b.height<44||b.y<0||b.y+b.height>size.height+1)throw Error('Touch start inaccessible');await touch.screenshot({path:`output/playwright/mastery-touch-board-${size.width}x${size.height}.png`});await touch.getByRole('button',{name:'Close voyage atlas',exact:true}).tap();
      const pixels=await touch.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('#canvas-host canvas'),0,0,24,24);const b=ctx.getImageData(0,0,24,24).data;resolve({colors:new Set(Array.from({length:576},(_,i)=>`${b[i*4]},${b[i*4+1]},${b[i*4+2]}`)).size,brightness:b.reduce((n,v,i)=>n+(i%4===3?0:v),0)/1728});})));
      if(pixels.colors<40||pixels.brightness<5)throw Error('Blank touch scene');views.push({size,pixels});
    }
    await touch.setViewportSize({width:390,height:844});
    await touch.evaluate(async()=>{
      const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')),{beginMastery,masteryStation}=await import('/src/mastery-voyage.ts');const n=beginMastery(p,'waters',true,{x:70,z:-55,yaw:0}),s=masteryStation(n.mastery,()=>0);n.mastery.active.anchor={x:s.x,z:s.z+28,yaw:0};localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(n));
    });
    // This reload uses the declared checkpoint fixture, not a normally sailed touch journey.
    const seed=await touch.evaluate(()=>localStorage.getItem('ocean-adventure-progress-v1'));await context.addInitScript(p=>localStorage.setItem('ocean-adventure-progress-v1',p),seed);
    await touch.reload();await touch.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});await touch.waitForFunction(()=>!!document.querySelector('#game-root').dataset.renderProfile,{},{timeout:90000});
    await touch.locator('[data-mode-toggle]').tap();await touch.locator('[data-tool="scanner"]').tap();await touch.locator('[data-cruise]').tap();await touch.waitForFunction(()=>!document.querySelector('[data-interact]').disabled,{},{timeout:120000});
    await touch.locator('[data-interact]').tap();await touch.waitForFunction(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')).mastery.active.readings.length===1,{},{timeout:20000});
    await touch.locator('[data-mastery-status]').scrollIntoViewIfNeeded();await touch.screenshot({path:'output/playwright/mastery-touch-reading.png'});
    const controls=await touch.locator('[data-interact]').boundingBox(),status=await touch.locator('[data-mastery-status]').boundingBox();if(controls.height<44||controls.y<0||controls.y+controls.height>844||status.y<0||status.y+status.height>844)throw Error('Touch reading feedback or action inaccessible');
    if(errors.length)throw Error(errors.join(';'));return{errors,emulatedTouch:true,paidReceiptCopied:true,vesselCheckpointSeeded:true,actualTouchReading:true,views};
  }finally{await context.close();}
}
