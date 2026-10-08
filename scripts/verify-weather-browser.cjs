// Dedicated CLI profile only. Clock fixtures skip waiting a real 36-minute day.
async page=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const profile=async()=>{await page.waitForFunction(()=>!!document.querySelector('#game-root').dataset.renderProfile,{},{timeout:60000});return page.locator('#game-root').evaluate(el=>JSON.parse(el.dataset.renderProfile));};
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  await page.setViewportSize({width:1280,height:720});
  await page.goto('http://localhost:5174/?profile');await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
  await page.waitForTimeout(400);
  if((await profile()).weather.version!==1)throw Error('No live clock');
  await page.getByRole('button',{name:'Forecast',exact:true}).click();
  const dialog=page.locator('[data-forecast]');await dialog.waitFor({state:'visible'});
  const before=await profile();await page.waitForTimeout(1200);const frozen=await profile();if(frozen.frame!==before.frame)throw Error('Forecast clock not paused');
  await page.evaluate(()=>window.failStorySave=true);
  const receipt=await save();await dialog.getByRole('button',{name:'Storm',exact:true}).click();
  if(!(await dialog.innerText()).includes('could not be saved'))throw Error('Invisible failure');
  if(JSON.stringify((await save()).weather)!==JSON.stringify(receipt.weather))throw Error('Failed setting changed save');
  await page.evaluate(()=>window.failStorySave=false);await dialog.getByRole('button',{name:'Storm',exact:true}).click();
  if((await save()).weather.override!=='storm'||(await save()).saveVersion!==5)throw Error('Manual setting not saved');
  await page.keyboard.press('Escape');if(await page.locator('[data-pause-menu]').isVisible())throw Error('Escape also paused');
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(500);
  if((await profile()).weatherKey!=='storm')throw Error('Override not resumed');
  await page.getByRole('button',{name:'Forecast',exact:true}).click();await dialog.getByRole('button',{name:'Scheduled weather',exact:true}).click();
  if((await save()).weather.override!==null)throw Error('Schedule not restored');
  for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(size);const b=await dialog.boundingBox();if(b.x<0||b.y<0||b.x+b.width>size.width+1||b.y+b.height>size.height+1)throw Error('Forecast offscreen');
    if(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth))throw Error('Forecast overflow');
    await page.screenshot({path:`output/playwright/weather-forecast-${size.width}x${size.height}.png`});
  }
  await page.keyboard.press('Escape');await page.setViewportSize({width:1280,height:720});
  const samples=[];
  for(const [name,elapsed]of [['day',300],['dusk',800],['night',1080],['storm',1250],['dawn',1900],['expiry',479.99]]){
    await page.evaluate(t=>{const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));p.weather={version:1,elapsed:t,override:null,until:0};localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(p));},elapsed);
    await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});await page.waitForTimeout(1800);
    const p=await profile();if(!Number.isFinite(p.daylight)||p.daylight<0||p.daylight>1)throw Error('Invalid daylight');
    await page.screenshot({path:`output/playwright/weather-${name}.png`});
    const pixels=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('#canvas-host canvas'),0,0,24,24);const b=ctx.getImageData(0,0,24,24).data;resolve({unique:new Set(Array.from({length:24*24},(_,i)=>`${b[i*4]},${b[i*4+1]},${b[i*4+2]}`)).size,light:b.reduce((n,v,i)=>n+(i%4===3?0:v),0)/(24*24*3)});}))); 
    if(pixels.unique<40||pixels.light<5)throw Error(`${name} blank canvas`);
    if(name==='expiry'&&p.weatherKey!=='calm')throw Error('Scheduled front failed to cross boundary');
    samples.push({name,clock:p.weather.elapsed,daylight:p.daylight,key:p.weatherKey,pixels,frameMs:p.frameMs,calls:p.calls});
    if(name==='night'){
      const pos=p.vesselPosition;await page.keyboard.down('ArrowUp');await page.waitForTimeout(1000);await page.keyboard.up('ArrowUp');const moved=await profile();if(Math.hypot(moved.vesselPosition[0]-pos[0],moved.vesselPosition[2]-pos[2])<.03)throw Error('Night navigation inactive');
      await page.getByRole('button',{name:'Dive',exact:true}).click();await page.waitForTimeout(1200);if((await profile()).mode!=='swim')throw Error('Night dive failed');await page.keyboard.press('KeyC');await page.waitForTimeout(500);const diver=await profile();if(diver.characterSource!=='supplied'||!diver.diverNdc)throw Error('Night supplied diver missing');await page.screenshot({path:'output/playwright/weather-night-diver.png'});
      await page.getByRole('button',{name:'Forecast',exact:true}).click();if(!await page.locator('[data-weather-rest]').isDisabled())throw Error('Rest allowed while diving');await page.keyboard.press('Escape');
    }
    if(name==='storm'){
      await page.getByRole('button',{name:'Forecast',exact:true}).click();const r=await save();await page.evaluate(()=>window.failStorySave=true);await dialog.locator('[data-weather-rest]').click();if(JSON.stringify((await save()).weather)!==JSON.stringify(r.weather))throw Error('Failed rest changed clock');
      await page.evaluate(()=>window.failStorySave=false);await dialog.locator('[data-weather-rest]').click();const rested=await save();if(!rested.weather||Math.abs(rested.weather.elapsed-1980)>.01||rested.credits!==r.credits||JSON.stringify(rested.fieldEquipment)!==JSON.stringify(r.fieldEquipment)||JSON.stringify(rested.expedition)!==JSON.stringify(r.expedition))throw Error('Rest changed inventory/cargo or missed dawn');await page.screenshot({path:'output/playwright/weather-rest-dawn.png'});await page.keyboard.press('Escape');
    }
  }
  if(errors.length)throw Error(errors.join(';'));return {errors,clockFixtures:true,forecastPause:true,saveFailure:true,overrideReload:true,viewports:4,samples};
}
