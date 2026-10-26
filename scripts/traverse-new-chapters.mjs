// Shared real-input driver for browser and packaged Electron acceptance.
// No evaluation writes, hidden controls, level skips or physics/time overrides.
import {expect} from '@playwright/test';
const campaign=async(page)=>JSON.parse(await page.locator('#app').getAttribute('data-campaign')||'{}');
const engine=async(page)=>(await campaign(page)).engine;
const stage=async(page,n)=>expect.poll(async()=>(await engine(page)).stage,{timeout:35000,intervals:[100]}).toBe(n);
const idle=async(page)=>expect.poll(async()=>(await engine(page)).phase,{timeout:25000,intervals:[100]}).toBe('exploring');
const position=async(page,s)=>expect.poll(async()=>(await engine(page)).actor.s,{timeout:30000,intervals:[50]}).toBeGreaterThanOrEqual(s);
async function angle(page,value){await page.locator('#mechanism-angle').fill(String(value));}
async function operate(page){await expect(page.locator('#operate')).toBeEnabled({timeout:12000});await page.locator('#operate').click();}
async function move(page,run=true){await page.locator('#world').focus();await page.keyboard.up('KeyW');await page.keyboard.up('Shift');if(run)await page.keyboard.down('Shift');await page.keyboard.down('KeyW');}
async function stop(page){await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await expect.poll(async()=>Math.abs((await engine(page)).actor.velocity),{timeout:5000}).toBeLessThan(.12);}
export async function traverseNewChapters(page){
 await expect(page.locator('#app')).toHaveAttribute('data-chapter','2',{timeout:25000});
 await expect(page.locator('#app')).toHaveAttribute('data-campaign-state','playing',{timeout:25000});
 await angle(page,30);await operate(page);await idle(page);await move(page);await position(page,-10);await page.keyboard.press('Space');await stage(page,1);
 await operate(page);await idle(page);await move(page);await stage(page,2);
 await move(page,false);await position(page,5.1);await stop(page);await angle(page,42);await operate(page);
 await expect.poll(async()=>(await engine(page)).liftDocked,{timeout:15000}).toBe(true);
 await move(page);await position(page,9);await page.keyboard.press('Space');
 await expect(page.locator('#app')).toHaveAttribute('data-chapter','3',{timeout:40000});
 await expect(page.locator('#app')).toHaveAttribute('data-campaign-state','playing',{timeout:25000});
 await angle(page,-25);await expect(page.locator('#operate')).toBeDisabled();await page.locator('#view-toggle').click();await operate(page);await idle(page);
 await move(page);await stage(page,1);await move(page,false);await position(page,-3.25);await stop(page);
 await angle(page,35);await operate(page);await expect.poll(async()=>(await engine(page)).liftDocked,{timeout:15000}).toBe(true);
 await move(page);await stage(page,2);await angle(page,60);await expect(page.locator('#operate')).toBeDisabled();
 await angle(page,-45);await operate(page);await angle(page,60);await operate(page);await idle(page);
 await move(page);await position(page,1.7);await page.keyboard.press('Space');
 await expect(page.locator('#app')).toHaveAttribute('data-campaign-state','complete',{timeout:35000});
 await expect(page.locator('#ending')).toBeVisible({timeout:20000});
 const final=await campaign(page);expect(final.completed).toEqual([1,2,3]);expect(final.entries).toEqual([1,2,3]);
 return final;
}
