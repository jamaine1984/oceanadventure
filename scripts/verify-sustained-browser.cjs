// Run after all six chapters in the same earned, disposable CLI profile.
async page=>{
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  const before=await save(),ids=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive','pelagic-record'];
  const ledger=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('campaign-earned-ledger')||'[]'));
  if(JSON.stringify(before.voyage.completed)!==JSON.stringify(ids)||JSON.stringify(ledger.map(r=>r.id))!==JSON.stringify(ids)||before.credits!==ledger.at(-1)?.bank)throw Error('Earn the exact campaign continuously before this performance run');
  await page.setViewportSize({width:1280,height:720});
  const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  await page.getByRole('button',{name:'Open voyage atlas',exact:true}).click();
  await page.locator('[data-chart-marker="reef"]').click();await page.keyboard.press('Escape');
  await page.locator('[data-cruise]').click();
  await page.waitForFunction(()=>document.querySelector('[data-cruise]').getAttribute('aria-pressed')==='false',{},{timeout:180000});
  const sample=async label=>{
    await page.waitForTimeout(5000);
    const result=await page.evaluate(async label=>{
      const frames=[],start=performance.now();let last=-1,invalidFrames=0;
      await new Promise(resolve=>{
        const collect=()=>{
          const f=JSON.parse(document.querySelector('#game-root').dataset.renderProfile);
          const root=document.querySelector('#game-root'),menu=!!document.querySelector('dialog[open]')||document.querySelector('[data-pause-menu]')?.getAttribute('aria-hidden')==='false'||document.querySelector('[data-harbor]')?.classList.contains('is-open')||document.querySelector('[data-journal]')?.classList.contains('is-open');
          const valid=!menu&&(label==='storm-helm'?f.mode==='helm'&&f.weatherKey==='storm':f.mode==='swim'&&root.classList.contains('is-underwater')&&f.position[1]<-.6&&document.querySelector('[data-tool="scanner"]').getAttribute('aria-pressed')==='true');
          if(!valid)invalidFrames++;
          if(f.frame!==last){frames.push([f.frameMs,f.updateMs,f.renderMs,f.calls,f.triangles,f.mode,f.scale,f.weatherKey]);last=f.frame;}
          if(performance.now()-start>=120000)resolve();else requestAnimationFrame(collect);
        };requestAnimationFrame(collect);
      });
      const elapsed=performance.now()-start,quantile=(a,p)=>a.sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
      const gl=document.querySelector('#canvas-host canvas').getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
      return {wallSeconds:elapsed/1000,frames:frames.length,invalidFrames,graphics:localStorage.getItem('ocean-adventure-graphics'),fps:frames.length*1000/elapsed,p95Ms:quantile(frames.map(f=>f[0]),.95),p99Ms:quantile(frames.map(f=>f[0]),.99),updateP95Ms:quantile(frames.map(f=>f[1]),.95),renderP95Ms:quantile(frames.map(f=>f[2]),.95),modes:[...new Set(frames.map(f=>f[5]))],scales:[...new Set(frames.map(f=>f[6]))],weather:[...new Set(frames.map(f=>f[7]))],hardware:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),position:JSON.parse(document.querySelector('#game-root').dataset.renderProfile).position};
    },label);
    if(result.frames<120)throw Error('Frozen or severely stalled rendering');
    if(result.invalidFrames)throw Error('Labeled workload changed during sampling '+JSON.stringify(result));
    await page.screenshot({path:`output/playwright/sustained-${label}.png`});
    return {label,viewport:'1280x720',isolatedBackgroundLoad:false,averageFpsTarget:60,...result};
  };
  await page.getByRole('button',{name:'Storm',exact:true}).click();
  const storm=await sample('storm-helm');
  await page.getByRole('button',{name:'Bluewater',exact:true}).click();
  await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();
  await page.keyboard.down('Control');await page.waitForTimeout(3500);await page.keyboard.up('Control');
  const underwater=await sample('reef-scanner');
  await page.keyboard.press('c');await page.screenshot({path:'output/playwright/sustained-supplied-diver.png'});
  const after=await save();
  if(after.credits!==before.credits||JSON.stringify(after.voyage.completed)!==JSON.stringify(before.voyage.completed)||JSON.stringify(after.upgrades)!==JSON.stringify(before.upgrades)||after.expedition.saleCredits!==before.expedition.saleCredits)throw Error('Performance sampling changed earned progression');
  page.off('pageerror',onError);if(errors.length)throw Error(errors.join(';'));
  return {campaignEarned:true,sampleSeconds:120,storm,underwater,bank:after.credits,errors};
}
