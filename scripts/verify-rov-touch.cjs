// Run after verify-rov-browser.cjs; copies its acquired equipment into an isolated emulated-touch context.
async page=>{
  const seed=await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));if(!p.rov?.owned||p.credits!==200)throw Error('Run the fabrication walkthrough first');p.rov.battery=100;return JSON.stringify(p);});
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),touch=await context.newPage(),errors=[];
  touch.on('pageerror',error=>errors.push(error.message));
  try{
    await touch.addInitScript(value=>localStorage.setItem('ocean-adventure-progress-v1',value),seed);await touch.goto('http://localhost:5174/?profile');await touch.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
    const profile=()=>touch.locator('#game-root').evaluate(el=>JSON.parse(el.dataset.renderProfile));
    await touch.getByRole('button',{name:'More voyage actions',exact:true}).tap();await touch.locator('[data-rov-launch]').tap();await touch.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).mode==='rov');
    const start=await profile();const cdp=await context.newCDPSession(touch),control=await touch.locator('[data-hold="ControlLeft"]').boundingBox();
    if(!control)throw Error('Touch depth control hidden');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:control.x+control.width/2,y:control.y+control.height/2}]});await touch.waitForTimeout(1000);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const moved=await profile();if(moved.position[1]>start.position[1]-1.4)throw Error('Held touch depth did not move ROV');
    const viewports=[];
    for(const size of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
      await touch.setViewportSize(size);const light=touch.locator('[data-rov-light]');await light.scrollIntoViewIfNeeded();const before=(await profile()).rovLights;await light.tap();await touch.waitForFunction(value=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).rovLights!==value,before);await light.tap();
      await touch.locator('[data-rov-pulse]').scrollIntoViewIfNeeded();await touch.waitForFunction(()=>!document.querySelector('[data-rov-pulse]').disabled,{},{timeout:10000});await touch.locator('[data-rov-pulse]').tap();
      const panel=await touch.locator('.rov-tools').boundingBox();if(panel.x<0||panel.y<0||panel.x+panel.width>size.width+1||panel.y+panel.height>size.height+1)throw Error('Touch ROV panel outside viewport');
      await touch.screenshot({path:`output/playwright/rov-touch-${size.width}x${size.height}.png`});viewports.push(size);
    }
    await touch.locator('[data-mode-toggle]').tap();await touch.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).mode==='helm');const saved=await touch.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(saved.credits!==200||!saved.rov.owned)throw Error('Touch recall changed equipment/bank');
    await touch.getByRole('button',{name:'More voyage actions',exact:true}).tap();await touch.locator('[data-rov-launch]').tap();await touch.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).mode==='rov');await touch.locator('[data-pause-toggle]').tap();await touch.locator('[data-rescue]').tap();await touch.waitForFunction(()=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).mode==='helm');const recovered=await profile();if(recovered.rovVisible||recovered.rovCableVisible||recovered.rovLightIntensity)throw Error('Emergency recovery left vehicle rendering');
    if(errors.length)throw Error(errors.join(';'));return{emulatedTouch:true,seededFullBattery:true,heldDepth:true,lights:true,sonar:true,recall:true,emergencyRecovery:true,viewports,errors};
  }finally{await context.close();}
}
