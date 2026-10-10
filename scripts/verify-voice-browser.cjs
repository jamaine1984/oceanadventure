// Disposable profile. Speech-engine mocks prove orchestration, not audible quality.
async page=>{
  await page.addInitScript(()=>{
    window.voiceCalls=[];window.audioTargets=[];
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>['Zira','David','Hazel'].map(name=>({name,lang:'en-US',localService:true})),cancel:()=>{window.voiceCancelled=(window.voiceCancelled||0)+1;},speak:u=>{window.voiceCalls.push(u);queueMicrotask(()=>u.onstart?.());}}});
    const target=AudioParam.prototype.setTargetAtTime;AudioParam.prototype.setTargetAtTime=function(value,...args){window.audioTargets.push(value);return target.call(this,value,...args);};
  });
  await page.goto('http://localhost:5174/?profile');await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  const dialog=page.locator('[data-story-dialog]');await dialog.waitFor({state:'visible'});
  if(await page.evaluate(()=>window.voiceCalls.length))throw Error('Speech bypassed initial gesture');
  await page.locator('[data-story-replay]').click();await page.waitForFunction(()=>document.querySelector('[data-story-dialog]').dataset.voiceState==='speaking');
  if(!(await page.evaluate(()=>window.voiceCalls.at(-1).text)).includes('launch went silent'))throw Error('Wrong opening line');
  await page.getByRole('button',{name:'Ask about the signal',exact:true}).click();
  await page.waitForFunction(()=>window.voiceCalls.at(-1).text.startsWith('Three short pulses'));
  await dialog.getByRole('button',{name:'Close conversation',exact:true}).click();
  await page.getByRole('button',{name:'Music off',exact:true}).click();
  await page.getByRole('button',{name:'Radio',exact:true}).click();await page.locator('[data-story-replay]').click();
  await page.waitForFunction(()=>window.audioTargets.includes(.045));
  const voices=[];
  for(const name of ['Ivo','Selene','Mara']){await dialog.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(100);voices.push(await page.evaluate(()=>({text:window.voiceCalls.at(-1).text,voice:window.voiceCalls.at(-1).voice.name})));}
  await page.locator('[data-story-voice]').click();if(await dialog.getAttribute('data-voice-state')!=='off')throw Error('Mute failed');
  if(await page.getByRole('button',{name:'Music on',exact:true}).count()!==1)throw Error('Voice mute changed music preference');
  if(!await page.evaluate(()=>window.audioTargets.includes(.2)))throw Error('Dialogue did not restore normal music gain');
  await page.locator('[data-story-voice]').click();await page.waitForFunction(()=>document.querySelector('[data-story-dialog]').dataset.voiceState==='speaking');
  // Deliver a late event from a replaced line; the current speaker must stay active.
  await page.evaluate(()=>window.voiceCalls[0].onend?.());if(await dialog.getAttribute('data-voice-state')!=='speaking')throw Error('Stale completion changed current voice');
  const layouts=[];
  for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(size);await page.waitForTimeout(200);
    for(const selector of ['[data-story-voice]','[data-story-replay]']){const b=await page.locator(selector).boundingBox();if(!b||b.width<44||b.height<44||b.x<0||b.y<0||b.x+b.width>size.width+1||b.y+b.height>size.height+1)throw Error('Voice controls clipped '+JSON.stringify({size,b}));}
    await page.screenshot({path:`output/playwright/voice-${size.width}x${size.height}.png`});layouts.push(size);
  }
  await page.keyboard.press('Escape');await page.waitForTimeout(100);if(await dialog.getAttribute('data-voice-state')==='speaking')throw Error('Close did not stop speech');
  await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'Radio',exact:true}).click();await page.locator('[data-story-voice]').click();
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  if(await page.evaluate(()=>localStorage.getItem('ocean-adventure-voice'))!=='off')throw Error('Voice preference lost');
  return {speechEngine:'mock',audibleQualityVerified:false,voices,layouts,musicDucked:true,voicePreferencePersisted:true};
}
