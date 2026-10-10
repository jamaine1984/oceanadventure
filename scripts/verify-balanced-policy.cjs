// Matched preview fixtures, not earned campaign or real-device evidence.
async page=>{
  await page.setViewportSize({width:1280,height:720});
  const results=[];
  for(const policy of ['previous','smooth']){
    await page.unroute('**/src/adaptive-resolution.ts*');
    if(policy==='previous')await page.route('**/src/adaptive-resolution.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export function resolutionStep(scale,fps,maximum,mobile){return {scale:fps<(mobile?32:48)?Math.max(.52,scale-.06):fps>57?Math.min(maximum,scale+.03):scale,healthy:0}}'}));
    await page.evaluate(()=>sessionStorage.clear());
    await page.goto('http://localhost:5174/?qa=reef&profile');await page.locator('[data-loading]').waitFor({state:'hidden',timeout:90000});
    await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Balanced',exact:true}).click();await page.getByRole('button',{name:'Resume voyage',exact:true}).click();
    await page.locator('[data-tool="scanner"]').click();await page.keyboard.press('c');
    await page.waitForTimeout(30000);
    const sample=await page.evaluate(async()=>{
      const values=[],start=performance.now();let last=-1,invalid=0;
      await new Promise(resolve=>{const collect=()=>{
        const root=document.querySelector('#game-root'),f=JSON.parse(root.dataset.renderProfile);
        if(f.mode!=='swim'||!f.diverNdc||f.characterSource!=='supplied'||!root.classList.contains('is-underwater')||document.querySelector('dialog[open]')||document.querySelector('[data-pause-menu]').getAttribute('aria-hidden')==='false')invalid++;
        if(f.frame!==last){values.push([performance.now()-start,f.frameMs,f.updateMs,f.renderMs,f.scale]);last=f.frame;}
        if(performance.now()-start>=120000)resolve();else requestAnimationFrame(collect);
      };requestAnimationFrame(collect);});
      const elapsed=performance.now()-start,q=(a,p)=>a.sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
      const gl=document.querySelector('#canvas-host canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {seconds:elapsed/1000,frames:values.length,fps:values.length*1000/elapsed,p95Ms:q(values.map(f=>f[1]),.95),p99Ms:q(values.map(f=>f[1]),.99),updateP95Ms:q(values.map(f=>f[2]),.95),renderP95Ms:q(values.map(f=>f[3]),.95),scales:[...new Set(values.map(f=>f[4]))],blocks:[0,1,2,3].map(i=>({seconds:30,frames:values.filter(f=>f[0]>=i*30000&&f[0]<(i+1)*30000).length})),hardware:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),invalid};
    });
    if(sample.invalid||sample.frames<120)throw Error('Invalid matched workload '+JSON.stringify(sample));
    await page.screenshot({path:`output/playwright/balanced-policy-${policy}.png`});results.push({policy,fixture:'reef',view:'supplied third-person',viewport:'1280x720',isolatedBackgroundLoad:false,...sample});
  }
  await page.unroute('**/src/adaptive-resolution.ts*');return results;
}
