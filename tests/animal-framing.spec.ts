import { expect, test } from '@playwright/test';
import { verifyScene } from './scene-check';

test('portrait lagoon research exposes wildlife and earns both photographs through touch-sized controls',async({page})=>{
  test.setTimeout(240000);
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>sessionStorage.setItem('ocean-adventure-graphics','performance'));
  await page.goto('/?qa=lagoon');
  await page.locator('[data-loading]').waitFor({state:'hidden',timeout:60000});
  const assist=page.locator('[data-cruise]'),action=page.locator('[data-interact]');
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed','false',{timeout:75000});
  await page.locator('[data-mode-toggle]').click();
  for(let count=1;count<=2;count++) {
    if(await assist.getAttribute('aria-pressed')==='false')await assist.click();
    await expect(action).toBeEnabled({timeout:60000});
    await verifyScene(page);
    await expect(action).toBeEnabled();
    await page.screenshot({path:`output/gameplay-round3/12-mobile-subject-${count}.png`});
    const button=await action.boundingBox();
    expect(button!.x+button!.width).toBeLessThanOrEqual(390);
    expect(button!.height).toBeGreaterThanOrEqual(38);
    await action.click();
    await expect(page.locator('[data-objective]')).toContainText(`${count}/2 species`);
  }
  await page.getByRole('button',{name:'Open inventory',exact:true}).click();
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page.locator('.inventory__photo')).toHaveCount(2);
  await page.locator('.inventory__photo').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/gameplay-round3/13-mobile-earned-collection.png'});
  await page.locator('.inventory__photo').last().scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/gameplay-round3/14-mobile-earned-ray.png'});
  expect(errors).toEqual([]);
});
