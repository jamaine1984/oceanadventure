// Isolated terminal fixtures, not a normally earned campaign or physical-device benchmark.
async page=>{
  const seed=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'))),results=[],errors=[];
  for(const [index,size]of [{width:390,height:844},{width:844,height:390},{width:320,height:568}].entries()){
    const context=await page.context().browser().newContext({viewport:size,hasTouch:true,isMobile:true}),touch=await context.newPage();touch.on('pageerror',e=>errors.push(e.message));
    const fixture=structuredClone(seed);fixture.credits=0;fixture.rov={version:1,owned:true,battery:100};fixture.voyage.completed=fixture.voyage.completed.filter(id=>id!=='pelagic-record');delete fixture.voyage.completions['pelagic-record'];fixture.story.seen.push('observatory-report');
    Object.assign(fixture.expedition,{version:3,route:'pelagic',contractId:'pelagic-record',stage:'remote',checkpoint:'transect',sold:false,observatoryRecords:Array.from({length:index},(_,i)=>i)});
    try{
      await touch.addInitScript(value=>{localStorage.setItem('ocean-adventure-progress-v1',value);localStorage.setItem('ocean-adventure-graphics','performance');},JSON.stringify(fixture));await touch.goto('http://localhost:5174/?profile');await touch.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
      await touch.getByRole('button',{name:'More voyage actions',exact:true}).tap();await touch.locator('[data-rov-launch]').tap();await touch.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='rov');await touch.locator('[data-cruise]').tap();
      await touch.getByRole('button',{name:'More voyage actions',exact:true}).tap();await touch.locator('[data-camera-toggle]').tap();
      await touch.waitForFunction(()=>!document.querySelector('[data-rov-acquire]').disabled,{},{timeout:180000});const acquire=touch.locator('[data-rov-acquire]');await acquire.scrollIntoViewIfNeeded();
      const panel=await touch.locator('.rov-tools').boundingBox(),button=await acquire.boundingBox(),dock=await touch.locator('.action-dock').boundingBox();if(panel.x<0||panel.y<0||panel.x+panel.width>size.width+1||panel.y+panel.height>size.height+1||button.height<44)throw Error('Terminal touch panel clipped '+JSON.stringify({size,panel,button,dock}));
      if(panel.x<dock.x+dock.width&&panel.x+panel.width>dock.x&&panel.y<dock.y+dock.height&&panel.y+panel.height>dock.y)throw Error('Action dock overlaps terminal panel');
      await touch.screenshot({path:`output/playwright/pelagic-touch-${size.width}x${size.height}.png`});
      if(index===0){
        await acquire.tap();const cdp=await context.newCDPSession(touch),control=await touch.locator('[data-hold="Space"]').boundingBox();if(!control)throw Error('Depth touch control missing');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:control.x+control.width/2,y:control.y+control.height/2}]});await touch.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(2000);
        if((await touch.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')))).expedition.observatoryRecords.length!==0)throw Error('Moving touch acquisition still recorded');await touch.locator('[data-cruise]').tap();await touch.waitForFunction(()=>!document.querySelector('[data-rov-acquire]').disabled,{},{timeout:30000});
      }
      await acquire.scrollIntoViewIfNeeded();await acquire.tap();await touch.waitForFunction(n=>JSON.parse(document.querySelector('#game-root').dataset.renderProfile).observatoryRecords.length===n,index+1);
      const saved=await touch.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(saved.credits!==0||saved.expedition.sold||saved.expedition.observatoryRecords.length!==index+1)throw Error('Touch read granted payment or lost record');results.push({size,read:index+1,buttonHeight:button.height});
    }finally{await context.close();}
  }
  if(errors.length)throw Error(errors.join(';'));return{emulatedTouch:true,fixturePrerequisites:true,fixtureOwnedRov:true,movingAcquisitionInterrupted:true,terminalTaps:results,errors};
}
