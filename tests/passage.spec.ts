import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { verifyScene, profileScene } from './scene-check';

test('Limestone Passage earns garden research, swims through the arch and pays once through actual controls',async({page})=>{
  // This complete route includes three profiling windows and both vault-return probes.
  test.setTimeout(900000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    sessionStorage.setItem('ocean-adventure-graphics','performance');
    const save=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value) {
      if((window as any).failCargoSave&&key.endsWith('ocean-adventure-progress-v1'))throw new Error('Storage full');
      save.call(this,key,value);
    };
  });
  await mkdir('output/gameplay-round4',{recursive:true});
  await page.goto('/?qa=passage&profile');
  await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
  const objective=page.locator('[data-objective]'),assist=page.locator('[data-cruise]'),action=page.locator('[data-interact]');
  const mode=page.locator('#game-root');
  const reach=async(timeout=75000)=>{
    if(await assist.getAttribute('aria-pressed')==='false')await assist.click();
    await expect(assist).toHaveAttribute('aria-pressed','false',{timeout});
  };
  const position=()=>mode.evaluate(root=>JSON.parse((root as HTMLElement).dataset.renderProfile!).position as number[]);
  await expect(objective).toHaveText('Sail to the coral garden');
  await reach();
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode','swim');
  for(let count=1;count<=2;count++) {
    if(await assist.getAttribute('aria-pressed')==='false')await assist.click();
    await expect(action).toBeEnabled({timeout:60000});
    await verifyScene(page);await expect(action).toBeEnabled();
    await page.screenshot({path:`output/gameplay-round4/09-garden-subject-${count}.png`});
    await action.click();
    await expect(objective).toContainText(`${count}/2 species`);
    console.log(`Passage: actual photograph ${count}`);
  }
  await page.waitForTimeout(1200);await verifyScene(page);
  const profiles=[await profileScene(page,'coral-garden-wildlife')];
  await page.screenshot({path:'output/gameplay-round4/01-garden-wildlife.png'});
  await page.locator('[data-tool="sampler"]').click();
  for(let count=1;count<=2;count++) {
    await reach();await expect(action).toBeEnabled();await action.click();
    if(count===1)await expect(objective).toContainText('1/2 samples');
  }
  await expect(objective).toContainText('Return to your vessel');
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode','helm',{timeout:75000});
  await expect(objective).toHaveText('Sail to the limestone passage');
  await reach();await page.locator('[data-mode-toggle]').click();
  await page.locator('[data-tool="scanner"]').click();
  const routePositions:number[][]=[];
  for(let count=1;count<=3;count++) {
    await reach();await expect(action).toBeEnabled();
    await expect(page.locator('[data-tool-prompt]')).toContainText(['South entrance','Arch interior','North exit'][count-1]);
    routePositions.push(await position());
    await verifyScene(page);
    await page.screenshot({path:`output/gameplay-round4/0${count+1}-passage-station.png`});
    if(count===2) {
      profiles.push(await profileScene(page,'limestone-arch-interior'));
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);await verifyScene(page);
      await page.screenshot({path:'output/gameplay-round4/05-arch-portrait.png'});
      expect(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth)).toBe(true);
      await page.setViewportSize({width:1280,height:720});
    }
    if(count===1) {
      await action.click();await expect(page.locator('[data-reading-progress]')).toBeVisible();
      await page.keyboard.down('q');await page.waitForTimeout(180);await page.keyboard.up('q');
      await expect(page.locator('[data-reading-progress]')).toBeHidden();await expect(objective).toContainText('0/3 readings');
      await expect(action).toBeEnabled({timeout:10000});
    }
    await action.click();
    if(count<3)await expect(objective).toContainText(`${count}/3 readings`,{timeout:10000});
    else await expect(objective).toContainText('Return to your vessel',{timeout:10000});
    console.log(`Passage: actual ordered reading ${count} at ${routePositions.at(-1)}`);
    if(count===1) {
      await page.mouse.move(680,320);await page.mouse.down();await page.mouse.move(655,280,{steps:8});await page.mouse.up();
      await page.waitForTimeout(2000);await verifyScene(page);
      await page.screenshot({path:'output/gameplay-round4/08-arch-opening.png'});
      await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
      await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();
      await expect(objective).toContainText('1/3 readings');
    }
    if(count===2) {
      await page.locator('[data-mode-toggle]').click();
      await expect(mode).toHaveAttribute('data-player-mode','helm',{timeout:75000});
      await expect(objective).toHaveText('Sail to the limestone passage');
      await page.screenshot({path:'output/gameplay-round4/10-interior-return.png'});
      await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
      await expect(objective).toHaveText('Sail to the limestone passage');
      await page.locator('[data-mode-toggle]').click();await page.locator('[data-tool="scanner"]').click();
      await expect(objective).toContainText('2/3 readings');await expect(page.locator('[data-reading-progress]')).toBeHidden();
    }
  }
  expect(routePositions[0][2]).toBeGreaterThan(-136);
  expect(routePositions[1][2]).toBeLessThan(-136);expect(routePositions[1][2]).toBeGreaterThan(-144);
  expect(routePositions[2][2]).toBeLessThan(-147);
  routePositions.forEach(p=>{expect(Math.abs(p[0]-166)).toBeLessThan(3.5);expect(Math.abs(p[1]+19)).toBeLessThan(3.5);});
  profiles.push(await profileScene(page,'limestone-passage-exit'));
  profiles.forEach(profile=>expect(profile.frames).toBeGreaterThan(20));
  await writeFile('output/gameplay-round4/profile-passage.json',JSON.stringify({profiles,routePositions},null,2));
  console.log('Passage profiles:',JSON.stringify(profiles));
  await page.locator('[data-mode-toggle]').click();
  await expect(mode).toHaveAttribute('data-player-mode','helm',{timeout:75000});
  await reach(120000);
  await expect(page.locator('[data-walk]')).toBeEnabled();
  await page.locator('[data-stand]').click();
  await expect(page.locator('[data-ledger]')).toContainText('Limestone passage');
  await page.evaluate(()=>(window as any).failCargoSave=true);
  await page.locator('[data-cash-in]').click();await expect(page.locator('[data-harbor-credits]')).toHaveText('0');
  await expect(page.locator('[data-cash-in]')).toBeEnabled();await expect(page.locator('[data-notice]')).toContainText('Cargo kept safely aboard');
  await page.evaluate(()=>(window as any).failCargoSave=false);
  await page.locator('[data-cash-in]').click();
  await expect(page.locator('[data-harbor-credits]')).toHaveText('1680');
  await expect(page.locator('[data-cash-in]')).toBeDisabled();
  await page.screenshot({path:'output/gameplay-round4/06-passage-receipt.png'});
  await page.reload();await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
  await expect(page.locator('[data-credits]')).toHaveText('1680');
  await page.locator('[data-stand]').click();await expect(page.locator('[data-cash-in]')).toBeDisabled();
  await expect(page.locator('[data-next-expedition]')).toHaveText('Begin Bluewater Research');
  await page.locator('[data-next-expedition]').click();await expect(objective).toHaveText('Sail to the reef survey site');
  await page.getByRole('button',{name:'Open inventory',exact:true}).click();
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page.locator('.inventory__photo')).toHaveCount(2);
  await page.screenshot({path:'output/gameplay-round4/07-earned-collection.png'});
  expect(errors).toEqual([]);
});

test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus) {
    console.log('Passage failure:',await page.locator('[data-objective]').innerText(),await page.locator('[data-tool-prompt]').innerText(),await page.locator('[data-notice]').innerText(),await page.locator('#game-root').getAttribute('data-render-profile'));
    await page.screenshot({path:'output/gameplay-round4/failure.png'});
  }
});
