import { expect, test } from '@playwright/test';
import { defaultProgress } from '../src/progression';
import { newExpedition } from '../src/expedition-state';
import { verifyScene } from './scene-check';
import { passageClearanceHeight } from '../src/expedition-world';
import { writeFile } from 'node:fs/promises';

for(const [side,vesselZ,fins] of [['south',-137,0],['north',-145,3]] as const) {
  test(`a vessel parked above the ${side} vault side remains boardable after an interior return`,async({page})=>{
    test.setTimeout(240000);
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    // Focused save fixture, not an earned expedition or upgrade playthrough.
    const progress=defaultProgress();progress.expedition=newExpedition(3);progress.upgrades.fins=fins;
    Object.assign(progress.expedition,{stage:'transect',checkpoint:'transect',photos:['turtle','tang'],waterSample:true,sedimentSample:true,transectReadings:[0]});
    await page.addInitScript(saved=>{
      sessionStorage.setItem('ocean-adventure-graphics','performance');
      sessionStorage.setItem('ocean-adventure-preview-passage-ocean-adventure-progress-v1',JSON.stringify(saved));
    },progress);
    await page.goto('/?qa=passage&profile');
    await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
    const root=page.locator('#game-root'),assist=page.locator('[data-cruise]');
    const pose=()=>root.evaluate(node=>JSON.parse((node as HTMLElement).dataset.renderProfile!).position as number[]);
    await expect(page.locator('[data-objective]')).toHaveText('Sail to the limestone passage');
    await page.evaluate(async vesselZ=>{
      const start=performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));
      await new Promise<void>((resolve,reject)=>{
        const sail=()=>{
          const frame=JSON.parse(document.querySelector<HTMLElement>('#game-root')!.dataset.renderProfile!);
          if(frame.position[2]<=vesselZ) {
            window.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW',bubbles:true}));
            document.querySelector('[data-mode-toggle]')!.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
            resolve();
          } else if(performance.now()-start>30000)reject(new Error('Manual sailing did not reach the vault'));
          else requestAnimationFrame(sail);
        };requestAnimationFrame(sail);
      });
    },vesselZ);
    await expect(root).toHaveAttribute('data-player-mode','swim');await page.locator('[data-tool="scanner"]').click();
    const vessel=await root.evaluate(node=>JSON.parse((node as HTMLElement).dataset.renderProfile!).vesselPosition as number[]);
    expect(vessel[2]).toBeGreaterThan(-151);expect(vessel[2]).toBeLessThan(-130);
    expect(side==='north'?vessel[2]<-140:vessel[2]>-140).toBe(true);
    await assist.click();await expect(assist).toHaveAttribute('aria-pressed','false',{timeout:75000});
    await expect(page.locator('[data-interact]')).toBeEnabled();
    const interior=await pose();expect(interior[2]).toBeLessThan(-136);expect(interior[2]).toBeGreaterThan(-144);
    await page.locator('[data-mode-toggle]').click();
    if(fins) {
      await page.waitForTimeout(800);await page.keyboard.down('q');await page.waitForTimeout(180);await page.keyboard.up('q');
      await expect(assist).toHaveAttribute('aria-pressed','false');await expect(root).toHaveAttribute('data-player-mode','swim');
      await page.locator('[data-mode-toggle]').click();
    }
    await expect.poll(async()=>(await pose())[1],{timeout:45000,intervals:[30]}).toBeGreaterThan(-16);
    const look=async(yaw:number)=>{
      const frame=await root.evaluate(node=>JSON.parse((node as HTMLElement).dataset.renderProfile!));
      const delta=Math.atan2(Math.sin(yaw-frame.lookYaw),Math.cos(yaw-frame.lookYaw));
      await page.mouse.move(640,300);await page.mouse.down();
      await page.mouse.move(640+delta/.005,300+frame.lookPitch/.004);await page.mouse.up();
    };
    // Cancel ascent, move outward, then approach the boundary facing inward with momentum.
    await look(side==='north'?0:Math.PI);await expect(assist).toHaveAttribute('aria-pressed','false');
    await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');await page.waitForTimeout(200);
    await look(side==='north'?Math.PI:0);
    // Frame-timed input avoids transport latency carrying the fixture through the boundary.
    const {path,retry,before}=await page.evaluate(async side=>{
      const before=JSON.parse(document.querySelector<HTMLElement>('#game-root')!.dataset.renderProfile!).position as number[];
      const points:number[][]=[],start=performance.now();let last=-1,retry:number[]|null=null;
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));
      await new Promise<void>((resolve,reject)=>{
        const sample=()=>{
          const root=document.querySelector<HTMLElement>('#game-root')!,frame=JSON.parse(root.dataset.renderProfile!);
          if(!retry&&(side==='north'?frame.position[2]>=-151.8:frame.position[2]<=-129.2)) {
            retry=frame.position;
            window.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW',bubbles:true}));
            document.querySelector<HTMLButtonElement>('[data-mode-toggle]')!.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
          }
          if(retry&&frame.frame!==last){points.push(frame.position);last=frame.frame;}
          if(retry&&root.dataset.playerMode==='helm')resolve();
          else if(performance.now()-start>75000)reject(new Error(`Return exceeded its bounded time: ${JSON.stringify({retry,frame,assist:document.querySelector('[data-cruise]')?.getAttribute('aria-pressed')})}`));
          else requestAnimationFrame(sample);
        };requestAnimationFrame(sample);
      });return {path:points,retry:retry!,before};
    },side);
    await page.keyboard.up('w');
    console.log(`Over-vault ${side} inward setup:`,JSON.stringify({before,retry}));
    expect(side==='north'?retry[2]>before[2]:retry[2]<before[2]).toBe(true);
    expect(side==='north'?retry[2]<-151:retry[2]>-130).toBe(true);
    await expect(root).toHaveAttribute('data-player-mode','helm',{timeout:75000});
    await expect(page.locator('[data-notice]')).toContainText('Researcher aboard');
    await expect(page.locator('[data-objective]')).toHaveText('Sail to the limestone passage');
    const boarded=await pose();expect(Math.hypot(boarded[0]-vessel[0],boarded[2]-vessel[2])).toBeLessThan(1);
    const clearance=passageClearanceHeight(),ascent=path.filter(point=>point[1]>-16&&point[1]<clearance-.05);
    expect(ascent.length).toBeGreaterThan(3);
    for(const point of ascent)expect(side==='north'?point[2]<=-151:point[2]>=-130).toBe(true);
    for(const point of path)if(point[2]>-151&&point[2]<-130&&point[1]>-17.5)expect(point[1]).toBeGreaterThanOrEqual(clearance-.1);
    await writeFile(`output/gameplay-round4/11-over-vault-return-${side}.json`,JSON.stringify({fixture:true,vessel,fins,clearance,before,retry,path},null,2));
    await verifyScene(page);await page.screenshot({path:`output/gameplay-round4/11-over-vault-return-${side}.png`});
    console.log(`Over-vault ${side}: boarded through real controls, fins ${fins}, vessel ${vessel}`);
    expect(errors).toEqual([]);
  });
}

test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus)console.log('Over-vault failure:',await page.locator('#game-root').getAttribute('data-render-profile'),await page.locator('[data-cruise]').getAttribute('aria-pressed'));
});
