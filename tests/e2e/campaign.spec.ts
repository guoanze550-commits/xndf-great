import {test,expect,type Page} from "@playwright/test";
import {VIEW_RAY} from "../../src/game/puzzle";
import {writeFile} from "node:fs/promises";
const campaign=async(p:Page)=>JSON.parse(await p.locator("#app").getAttribute("data-campaign")||"{}");
const engine=async(p:Page)=>(await campaign(p)).engine;
const view=async(p:Page)=>JSON.parse(await p.locator("#app").getAttribute("data-adventure-view")||"{}");
const music=async(p:Page)=>JSON.parse(await p.locator("#app").getAttribute("data-music")||"{}");
async function atStage(p:Page,stage:number){await expect.poll(async()=>(await engine(p)).stage,{timeout:35000,intervals:[100]}).toBe(stage);}
async function idle(p:Page){await expect.poll(async()=>(await engine(p)).phase,{timeout:25000,intervals:[100]}).toBe("exploring");}
async function angle(p:Page,value:number){await p.locator("#mechanism-angle").fill(String(value));}
async function operate(p:Page){await expect(p.locator("#operate")).toBeEnabled({timeout:12000});await p.locator("#operate").click();}
async function position(p:Page,s:number){await expect.poll(async()=>(await engine(p)).actor.s,{timeout:30000,intervals:[50]}).toBeGreaterThanOrEqual(s);}
async function move(p:Page,run=true){await p.locator("#world").focus();await p.keyboard.up("KeyW");await p.keyboard.up("Shift");if(run)await p.keyboard.down("Shift");await p.keyboard.down("KeyW");}
async function stop(p:Page){await p.keyboard.up("KeyW");await p.keyboard.up("Shift");await expect.poll(async()=>Math.abs((await engine(p)).actor.velocity),{timeout:5000}).toBeLessThan(.12);}

test("one unbroken adventure: five original crossings, real failures, both new levels and final ending",async({page})=>{
 test.setTimeout(900000);
 const errors:string[]=[],external:string[]=[],milestones:unknown[]=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error"&&/THREE|GLSL|shader/i.test(m.text()))errors.push(m.text());});
 page.on("request",r=>{if(!r.url().startsWith(test.info().project.use.baseURL as string))external.push(r.url());});
 await page.goto("./");await expect(page.locator("#fatal")).toBeHidden();await page.locator("#begin").click();
 for(const [target,mechanism,node] of [[-56,"axis","L"],[34,"stairs","B"],[52,"axis","U"],[-38,"crown","B2"],[-22,"axis","C"]] as const){
  const config=JSON.parse((await page.locator("#app").getAttribute("data-configuration"))!);
  const delta=(target-config[mechanism])/.3;
  await page.mouse.move(850,620);await page.mouse.down();await page.mouse.move(850+delta,620,{steps:8});await page.mouse.up();
  await expect(page.locator("#confirm")).toBeEnabled({timeout:25000});await page.locator("#confirm").click();
  await expect(page.locator("#app")).toHaveAttribute("data-platform",node,{timeout:45000});
 }
 await expect(page.locator("#app")).toHaveAttribute("data-chapter","2",{timeout:25000});
 await expect(page.locator("#app")).toHaveAttribute("data-campaign-state","playing",{timeout:25000});
 await expect(page.locator("#ending")).toBeHidden();await expect(page.locator("#begin")).toBeHidden();
 milestones.push(await campaign(page));expect((await music(page)).starts).toBe(1);
 await page.screenshot({path:"test-results/v3-02-entry.png"});
 // Deliberately miss the first gap. Collision/gravity, not a scripted fail, restores the start.
 await angle(page,30);await operate(page);await idle(page);await move(page);
 await expect.poll(async()=>(await engine(page)).retries,{timeout:25000,intervals:[100]}).toBe(1);
 await idle(page);expect((await engine(page)).stage).toBe(0);expect((await engine(page)).actor.s).toBeLessThan(-12);
 await angle(page,30);await operate(page);await idle(page);
 await page.keyboard.up("KeyW");await page.keyboard.up("Shift");
 const jumpButton=await page.locator("#jump").boundingBox();if(!jumpButton)throw new Error("Jump control missing");
 await page.locator("#move-run").click();
 await position(page,-10);await page.mouse.click(jumpButton.x+jumpButton.width/2,jumpButton.y+jumpButton.height/2);await atStage(page,1);
 expect((await engine(page)).actor.jumps).toBeGreaterThanOrEqual(1);expect((await music(page)).starts).toBe(1);
 // Actually stand on the temporary bridge until it dissolves, then use its checkpoint.
 await operate(page);await idle(page);await move(page,false);await position(page,-1.8);await stop(page);
 await expect.poll(async()=>(await engine(page)).retries,{timeout:60000,intervals:[200]}).toBe(2);
 await idle(page);expect((await engine(page)).stage).toBe(1);expect((await engine(page)).actor.s).toBeLessThan(-4);
 await operate(page);await idle(page);await move(page);await atStage(page,2);
 await move(page,false);await position(page,5.1);await stop(page);
 await expect.poll(async()=>(await engine(page)).actor.groundId).toBe("lift");
 const beforeLift=await engine(page);await angle(page,42);await operate(page);
 await expect.poll(async()=>(await view(page)).cameraZoom,{timeout:8000}).toBeGreaterThan(1.05);
 await expect.poll(async()=>(await engine(page)).liftDocked,{timeout:15000}).toBe(true);
 expect((await engine(page)).actor.y).toBeGreaterThan(beforeLift.actor.y+2.5);
 await page.screenshot({path:"test-results/v3-02-upper-bridge.png"});
 const departure=await page.evaluateHandle(()=>{
  const app=document.getElementById("app")!;const seen:any[]=[];
  const observer=new MutationObserver(()=>{const c=JSON.parse(app.dataset.campaign||"{}");if(c.chapter===2&&c.state==="leaving")seen.push(c.engine);});
  observer.observe(app,{attributes:true,attributeFilter:["data-campaign"]});return {seen,observer};
 });
 await move(page);await position(page,9);await page.keyboard.press("Space");
 await expect(page.locator("#app")).toHaveAttribute("data-chapter","3",{timeout:40000});
 await expect(page.locator("#app")).toHaveAttribute("data-campaign-state","playing",{timeout:25000});
 await expect(page.locator("#ending")).toBeHidden();milestones.push(await campaign(page));
 const exitMotion=await departure.evaluate(m=>m.seen);await departure.evaluate(m=>m.observer.disconnect());await departure.dispose();
 expect(exitMotion.some(e=>e.departure===1&&e.actor.y>6.3&&e.actor.s>14)).toBe(true);
 expect((await music(page)).starts).toBe(1);expect((await campaign(page)).entries).toEqual([1,2,3]);
 await page.screenshot({path:"test-results/v3-03-entry.png"});
 await angle(page,-25);await expect(page.locator("#operate")).toBeDisabled();
 await page.locator("#view-toggle").click();
 await expect.poll(async()=>(await engine(page)).projectionReady,{timeout:15000}).toBe(true);
 await operate(page);await idle(page);await move(page);await atStage(page,1);
 await move(page,false);await position(page,-3.25);await stop(page);
 await expect.poll(async()=>(await engine(page)).actor.groundId).toBe("lift");
 await angle(page,35);await operate(page);
 await expect.poll(async()=>(await engine(page)).liftDocked,{timeout:15000}).toBe(true);
 await move(page);await atStage(page,2);
 await angle(page,60);await expect(page.locator("#operate")).toBeDisabled();
 await angle(page,-45);await operate(page);expect((await engine(page)).counterweight).toBe(true);
 await angle(page,60);await operate(page);
 await expect.poll(async()=>(await engine(page)).phase,{timeout:15000}).toBe("orbit");
 await expect(page.locator("#move-run")).toBeDisabled();
 const directionDistance=async()=>{const d=(await view(page)).cameraDirection;return Math.hypot(d[0]-VIEW_RAY.x,d[1]-VIEW_RAY.y,d[2]-VIEW_RAY.z);};
 await expect.poll(directionDistance,{timeout:5000,intervals:[50]}).toBeGreaterThan(.08);
 await page.screenshot({path:"test-results/v3-03-ring-orbit.png"});
 await idle(page);expect(await directionDistance()).toBeLessThan(.015);expect((await engine(page)).finalRoad).toBe(true);expect((await engine(page)).projectionReady).toBe(true);
 await move(page);await position(page,1.7);await page.keyboard.press("Space");
 await expect(page.locator("#app")).toHaveAttribute("data-campaign-state","complete",{timeout:30000});
 await expect(page.locator("#ending")).toBeVisible({timeout:15000});
 const final=await campaign(page);milestones.push(final);
 expect(final.completed).toEqual([1,2,3]);expect(final.entries).toEqual([1,2,3]);expect(final.transitionFailures).toBe(0);
 expect(final.engine.actor.jumps).toBeGreaterThanOrEqual(1);expect((await music(page)).starts).toBe(1);
 await expect.poll(async()=>(await music(page)).state,{timeout:10000}).toBe("ended");
 expect(JSON.parse((await page.locator("#app").getAttribute("data-adventure-view"))!).visibleScenes).toEqual([3]);
 expect(errors).toEqual([]);expect(external).toEqual([]);
 await page.screenshot({path:"test-results/v3-04-final.png"});
 await writeFile(test.info().outputPath("continuous-adventure.json"),JSON.stringify({milestones,music:await music(page),errors,external,inputs:"real canvas drags, sliders, mouse run/jump controls, movement keys and Space; no state writes, skips or teleports",result:"passed"},null,2));
 await page.locator("#again").click();await expect(page.locator("#app")).toHaveAttribute("data-chapter","1");
 await expect(page.locator("#app")).toHaveAttribute("data-platform","A");
 await expect.poll(async()=>(await music(page)).starts).toBe(2);
 expect(JSON.parse((await page.locator("#app").getAttribute("data-adventure-view"))!).cachedScenes).toBe(2);
});
