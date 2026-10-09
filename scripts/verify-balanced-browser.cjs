// Continue after the earned campaign and sustained reef Scanner check.
async page=>{
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Balanced',exact:true}).click();
  await page.getByRole('button',{name:'Resume voyage',exact:true}).click();
  await page.waitForTimeout(15000);
  const result=await page.evaluate(async()=>{
    const samples=[],start=performance.now();let last=-1,invalidFrames=0;
    await new Promise(resolve=>{
      const collect=()=>{
        const root=document.querySelector('#game-root'),f=JSON.parse(root.dataset.renderProfile);
        if(f.mode!=='swim'||!root.classList.contains('is-underwater')||document.querySelector('[data-tool="scanner"]').getAttribute('aria-pressed')!=='true'||document.querySelector('dialog[open]')||document.querySelector('[data-pause-menu]').getAttribute('aria-hidden')==='false')invalidFrames++;
        if(f.frame!==last){samples.push([f.frameMs,f.updateMs,f.renderMs,f.scale]);last=f.frame;}
        if(performance.now()-start>=120000)resolve();else requestAnimationFrame(collect);
      };requestAnimationFrame(collect);
    });
    const elapsed=performance.now()-start,p=(a,n)=>a.sort((x,y)=>x-y)[Math.floor((a.length-1)*n)];
    const gl=document.querySelector('#canvas-host canvas').getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {sampleSeconds:elapsed/1000,frames:samples.length,fps:samples.length*1000/elapsed,p95Ms:p(samples.map(f=>f[0]),.95),p99Ms:p(samples.map(f=>f[0]),.99),updateP95Ms:p(samples.map(f=>f[1]),.95),renderP95Ms:p(samples.map(f=>f[2]),.95),scales:[...new Set(samples.map(f=>f[3]))],graphics:localStorage.getItem('ocean-adventure-graphics'),hardware:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),invalidFrames};
  });
  if(result.invalidFrames||result.frames<120||result.graphics!=='balanced')throw Error('Balanced workload invalid '+JSON.stringify(result));
  await page.screenshot({path:'output/playwright/sustained-balanced-scanner.png'});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ocean-adventure-progress-v1')));
  if(after.credits!==before.credits||JSON.stringify(after.voyage.completed)!==JSON.stringify(before.voyage.completed))throw Error('Sampling changed campaign receipts');
  return {viewport:'1280x720',averageFpsTarget:60,isolatedBackgroundLoad:false,...result,bank:after.credits};
}
