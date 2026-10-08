// Run after verify-story-browser.cjs in the same dedicated, disposable CLI profile.
async page=>{
  await page.setViewportSize({width:1280,height:720});const errors=[],evidence=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ocean-adventure-progress-v1'));p.credits=0;p.expeditions=4;p.shorePosition=undefined;p.fieldEquipment={scooter:true,charge:100};p.voyage.blueprints=['scooter-drive'];p.voyage.completed=['bay-signal','lagoon-echo','passage-origin','array-repair'];p.voyage.completions=Object.fromEntries(p.voyage.completed.map(id=>[id,1]));p.voyage.activeWaypoint=undefined;p.story.seen=['welcome','recorder','bay-report','lagoon-pulse','lagoon-report','array-report','restoration-report'];p.expedition={version:3,run:5,route:'reef',contractId:'bay-signal',stage:'briefing',photos:[],photoImages:{},transectReadings:[],waterSample:false,sedimentSample:false,cableFreed:false,sensorRecovered:false,sold:false,checkpoint:'harbor',saleCredits:0,grantState:'unclaimed',grantCredits:0};localStorage.setItem('ocean-adventure-progress-v1',JSON.stringify(p));});
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();await page.getByRole('button',{name:'Contracts',exact:true}).click();await page.getByRole('button',{name:'Wreckward Reach',exact:true}).click();await page.locator('[data-accept-contract="reach-archive"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-objective]').textContent==='Sail to Wreckward Reach');
  await page.locator('[data-cruise]').click();await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:180000});
  await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();
  const assist=page.locator('[data-cruise]'),interact=page.locator('[data-interact]'),profile=()=>page.locator('#game-root').evaluate(el=>JSON.parse(el.dataset.renderProfile));
  await assist.click();await interact.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('[data-interact]').disabled===false,{},{timeout:120000});
  await page.screenshot({path:'output/playwright/reach-entry.png'});
  // An unchanged field record must have visible feedback even where transient notices are hidden.
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.failStorySave=true);await interact.click();
  const status=page.locator('[data-freighter-status]');await status.waitFor({state:'visible'});await status.scrollIntoViewIfNeeded();if(!(await status.innerText()).includes('could not be saved'))throw Error('Mobile save failure silent');
  const failed=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(failed.expedition.interiorSteps.length||failed.credits)throw Error('Failed field write mutated receipt');
  await page.screenshot({path:'output/playwright/reach-mobile-save-failure.png'});await page.evaluate(()=>window.failStorySave=false);await interact.click();
  await page.waitForFunction(()=>document.querySelector('[data-objective]').textContent.includes('1/4'));
  await page.setViewportSize({width:1280,height:720});
  await page.locator('[data-scooter-toggle]').click();await page.waitForFunction(()=>document.querySelector('[data-scooter-toggle]').getAttribute('aria-pressed')==='true');
  await page.locator('[data-mode-toggle]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:120000});
  if(await page.locator('[data-credits]').innerText()!=='0')throw Error('Withdrawal paid unearned cargo');
  // Reload a legitimately earned partial record; the vessel checkpoint is outside the freighter.
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
  await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="cutter"]').click();await assist.click();await page.waitForFunction(()=>document.querySelector('[data-interact]').disabled===false,{},{timeout:120000});
  await page.screenshot({path:'output/playwright/reach-recorder-interior.png'});await interact.click();await page.waitForFunction(()=>document.querySelector('[data-objective]').textContent.includes('2/4'));
  await page.locator('[data-tool="scanner"]').click();await page.waitForFunction(()=>document.querySelector('[data-interact]').disabled===false);await page.keyboard.press('f');await page.waitForFunction(()=>document.querySelector('[data-objective]').textContent.includes('3/4'));
  // Try to ascend through the solid overhead deck; native collision must stop the researcher.
  const beforeRoof=await profile();await page.keyboard.down('Space');await page.waitForTimeout(2500);await page.keyboard.up('Space');const roof=await profile();if(roof.position[1]>beforeRoof.position[1]+2)throw Error('Diver passed through freighter deck');
  await assist.click();await page.waitForFunction(()=>document.querySelector('[data-interact]').disabled===false,{},{timeout:90000});
  for(const size of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(size);await interact.scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/reach-${size.width}x${size.height}.png`});
    const pixels=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{const sample=document.createElement('canvas');sample.width=sample.height=24;const ctx=sample.getContext('2d');ctx.drawImage(document.querySelector('#canvas-host canvas'),0,0,24,24);const p=ctx.getImageData(0,0,24,24).data,colors=new Set();let brightness=0;for(let i=0;i<p.length;i+=4){colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);brightness+=p[i]+p[i+1]+p[i+2];}resolve({colors:colors.size,brightness:brightness/1728});})));
    if(pixels.colors<40||pixels.brightness<15)throw Error('Blank freighter scene '+JSON.stringify(pixels));const r=await interact.boundingBox();if(r.x<0||r.y<0||r.x+r.width>size.width+1||r.y+r.height>size.height+1)throw Error('Freighter action outside viewport');evidence.push({size,pixels});
  }
  await interact.click();await page.setViewportSize({width:1280,height:720});if(await page.locator('[data-credits]').innerText()!=='0')throw Error('Cassette paid before return');
  await page.locator('[data-mode-toggle]').click();await page.waitForFunction(()=>document.querySelector('#game-root').dataset.playerMode==='helm',{},{timeout:120000});await assist.click();await page.waitForFunction(()=>document.querySelector('[data-walk]').disabled===false,{},{timeout:180000});
  await page.locator('[data-stand]').click();await page.locator('[data-cash-in]').click();if(await page.locator('[data-harbor-credits]').innerText()!=='1100')throw Error('Incorrect freighter payout');if(await page.locator('[data-cash-in]').isEnabled())throw Error('Duplicate freighter payment');
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));if(saved.credits!==1100||!saved.voyage.completed.includes('reach-archive')||saved.expedition.interiorSteps.length!==4)throw Error('Freighter receipt lost');
  const textures=await page.evaluate(async()=>{const {WreckwardWorld}=await import('/src/wreckward-world.ts');const world=new WreckwardWorld({add:()=>{}},-27);await world.load();const images=new Set();world.root.traverse(node=>{if(node.material?.map){const image=node.material.map.image;if(image.width<384||image.height<384)throw Error('Freighter texture missing');images.add(node.material.map.uuid);}});world.dispose();return images.size;});if(textures!==4)throw Error('Missing baked surface maps');
  if(errors.length)throw Error(errors.join(';'));return{errors,seededPrerequisiteChapters:4,seededDiveDrive:true,earnedFreighter:true,credits:saved.credits,partialResume:true,driveWithdrawal:true,textures,evidence};
}
