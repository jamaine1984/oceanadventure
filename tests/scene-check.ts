import { expect, type Page } from '@playwright/test';

export async function verifyScene(page: Page) {
  const canvas = page.locator('#canvas-host canvas');
  const first = await canvas.screenshot();
  const pixels = await page.evaluate(async base64 => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const sample = document.createElement('canvas'); sample.width = sample.height = 24;
    const context = sample.getContext('2d')!; context.drawImage(bitmap, 0, 0, 24, 24);
    const data = context.getImageData(0, 0, 24, 24).data;
    const colors = new Set<string>(); let brightness = 0;
    for (let i = 0; i < data.length; i += 4) { colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); brightness += data[i] + data[i + 1] + data[i + 2]; }
    return { colors: colors.size, brightness: brightness / (24 * 24 * 3) };
  }, first.toString('base64'));
  expect(pixels.colors).toBeGreaterThan(40); expect(pixels.brightness).toBeGreaterThan(15);
  await page.waitForTimeout(1100);
  expect((await canvas.screenshot()).equals(first)).toBe(false);
}

export async function profileScene(page: Page, scene: string) {
  return page.evaluate(async sceneName=>{
    const frames:Array<{frame:number;frameMs:number;triangles:number;calls:number;scale:number}>=[];
    const start=performance.now();let last=0;
    await new Promise<void>(resolve=>{
      const collect=()=>{
        const text=document.querySelector<HTMLElement>('#game-root')!.dataset.renderProfile;
        if(text){const frame=JSON.parse(text);if(frame.frame!==last){frames.push(frame);last=frame.frame;}}
        if(performance.now()-start>=12000)resolve();else requestAnimationFrame(collect);
      };requestAnimationFrame(collect);
    });
    const times=frames.map(f=>f.frameMs).sort((a,b)=>a-b);
    const gl=document.querySelector<HTMLCanvasElement>('#canvas-host canvas')!.getContext('webgl2')!,debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {scene:sceneName,sampleSeconds:12,viewport:`${innerWidth}x${innerHeight}`,graphics:'performance',hardware:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),frames:frames.length,fps:Number((frames.length*1000/(performance.now()-start)).toFixed(1)),p95Ms:times[Math.floor(times.length*.95)],final:frames.at(-1),isolatedBackgroundLoad:false};
  },scene);
}
