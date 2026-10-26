import { describe,it,expect } from "vitest";
import * as T from "three";
import { AdventureRules } from "../src/game/adventure";
import { Locomotion } from "../src/game/locomotion";
import { Campaign } from "../src/game/campaign";
import { WorldRules } from "../src/game/rules";
import { createPuzzleCamera, VIEW_RAY } from "../src/game/puzzle";
const tick=(r:AdventureRules,seconds:number)=>{for(let i=0;i<seconds*120;i++)r.update(1/120);};
function runTo(r:AdventureRules,until:()=>boolean,jumpAt:number[]=[]){
  const used=new Set<number>();
  for(let i=0;i<120*25&&!until();i++){
    r.input={forward:1,side:0,run:true};
    for(const at of jumpAt)if(r.actor.s>=at&&!used.has(at)){r.requestJump();used.add(at);}
    r.update(1/120);
  }
  expect(until(),JSON.stringify(r.snapshot())).toBe(true);
  r.input={forward:0,side:0,run:false};tick(r,.2);
}
function setup2(){const r=new AdventureRules(2);r.rotate(30);expect(r.confirm()).toBe(true);tick(r,.8);return r;}
function complete2(){
 const r=setup2();runTo(r,()=>r.stage===1,[-9.3]);
 expect(r.actor.jumps).toBe(1);expect(r.power).toBe(true);
 expect(r.confirm()).toBe(true);tick(r,.8);runTo(r,()=>r.stage===2);
 runTo(r,()=>r.actor.s>=5.5);r.rotate(42);expect(r.confirm()).toBe(true);tick(r,3.6);
 expect(r.liftDocked).toBe(true);expect(r.actor.y).toBeCloseTo(4.2);
 runTo(r,()=>r.completed,[9.3]);return r;
}
describe("real shared movement and mechanisms",()=>{
 it("solves all three second-level challenges with actual accelerated movement, jumping, plate and carrier",()=>{
  const r=complete2();expect(r.retries).toBe(0);expect(r.actor.jumps).toBe(2);expect(r.actor.landings).toBeGreaterThanOrEqual(2);expect(r.actor.s).toBeGreaterThan(13.4);
 });
 it("raises the second exit with its rider, then walks into the higher doorway",()=>{
  const r=complete2(),s=r.actor.s,y=r.actor.y;
  for(let i=0;i<150;i++)r.raiseDeparture(1/120);
  expect(r.departure).toBe(1);expect(r.actor.s).toBe(s);expect(r.actor.y).toBeCloseTo(y+2.2);
  expect(r.surfaces().find(p=>p.id==="exit")!.height).toBeCloseTo(r.actor.y);
  let reached=false;for(let i=0;i<300&&!reached;i++)reached=r.approachDoor(1/120);
  expect(reached).toBe(true);expect(r.actor.s).toBeGreaterThan(14.3);
 });
 it("cannot conjure bridges or use the lift before matching the real prerequisites",()=>{
  const r=new AdventureRules(2);expect(r.confirm()).toBe(false);expect(r.surfaces().some(s=>s.kind==="bridge")).toBe(false);
  r.rotate(-30);expect(r.confirm()).toBe(false);
  r.rotate(30);expect(r.confirm()).toBe(true);expect(r.confirm()).toBe(false);
 });
 it("a missed running jump falls and restores the nearest checkpoint, not the whole level",()=>{
  const r=setup2();r.input={forward:1,side:0,run:true};
  for(let i=0;i<120*8&&r.retries===0;i++)r.update(1/120);
  expect(r.retries).toBe(1);tick(r,.8);expect(r.stage).toBe(0);expect(r.actor.s).toBeCloseTo(-13);expect(r.actor.grounded).toBe(true);
 });
 it("timed ice really loses collision and restores the second checkpoint",()=>{
  const r=setup2();runTo(r,()=>r.stage===1,[-9.3]);r.confirm();tick(r,.8);
  runTo(r,()=>r.actor.s>-1);r.input={forward:0,side:0,run:false};tick(r,16);
  expect(r.retries).toBe(1);expect(r.stage).toBe(1);expect(r.actor.s).toBeCloseTo(r.checkpoint.s);expect(r.surfaces().some(s=>s.id==="timed-ice")).toBe(false);
 });
 it("buffers a near-edge jump but never permits an unlimited airborne double jump",()=>{
  const a=new Locomotion();a.reset(-.2,0);a.velocity=3.5;
  const surfaces=[{id:"ledge",from:-3,to:0,height:0,width:2,kind:"stone" as const}];
  for(let i=0;i<12;i++)a.step(1/120,{forward:1,side:0,run:true},surfaces);
  expect(a.grounded).toBe(false);a.jump();
  for(let i=0;i<12;i++)a.step(1/120,{forward:1,side:0,run:true},surfaces);
  expect(a.jumps).toBe(1);expect(a.verticalVelocity).toBeGreaterThan(0);
  for(let i=0;i<40;i++)a.step(1/120,{forward:1,side:0,run:true},surfaces);
  a.jump();for(let i=0;i<25;i++)a.step(1/120,{forward:1,side:0,run:true},surfaces);
  expect(a.jumps).toBe(1);
 });
 it("walk/jump cannot cover the running gap and gravity/landing obey the configured trajectory",()=>{
  const a=new Locomotion();a.reset(0,0);a.jump();let max=0;
  for(let i=0;i<150;i++){a.step(1/120,{forward:1,side:0,run:false},[{id:"floor",from:-2,to:20,height:0,width:2,kind:"stone"}]);max=Math.max(max,a.y);}
  expect(max).toBeGreaterThan(1.2);expect(max).toBeLessThan(1.3);expect(a.landings).toBe(1);expect(a.grounded).toBe(true);
 });
});
describe("inverted court and actual projection",()=>{
 it("allows the link only under the current real camera, independent of zoom and pan",()=>{
  const r=new AdventureRules(3),cam=createPuzzleCamera();r.rotate(-25);r.measureProjection(cam);expect(r.canConfirm).toBe(true);
  cam.zoom=1.8;cam.position.add(new T.Vector3(2,3,0));cam.updateProjectionMatrix();cam.updateMatrixWorld(true);r.measureProjection(cam);expect(r.canConfirm).toBe(true);
  const target=new T.Vector3(0,.5,-.5);cam.position.copy(target).addScaledVector(VIEW_RAY.clone().applyAxisAngle(new T.Vector3(0,1,0),-.28),40);cam.lookAt(target);cam.updateMatrixWorld(true);r.measureProjection(cam);expect(r.canConfirm).toBe(false);
 });
 it("solves lift, ordered counterweight, camera restoration and final running gap without state teleportation",()=>{
  const r=new AdventureRules(3);r.view=1;r.measureProjection(createPuzzleCamera());r.rotate(-25);expect(r.confirm()).toBe(true);tick(r,.8);
  runTo(r,()=>r.stage===1);runTo(r,()=>r.actor.s>=-2.95);r.rotate(35);expect(r.confirm()).toBe(true);tick(r,3.6);
  expect(r.actor.y).toBeCloseTo(5.2);expect(r.liftDocked).toBe(true);runTo(r,()=>r.stage===2);
  r.rotate(60);expect(r.confirm()).toBe(false);r.rotate(-45);expect(r.confirm()).toBe(true);expect(r.counterweight).toBe(true);
  r.rotate(60);expect(r.confirm()).toBe(true);tick(r,3.3);expect(r.phase).toBe("orbit");
  r.cameraSettled=false;tick(r,5);expect(r.phase).toBe("orbit");r.cameraSettled=true;tick(r,.1);expect(r.phase).toBe("exploring");
  runTo(r,()=>r.completed,[2.1]);expect(r.actor.jumps).toBe(1);expect(r.retries).toBe(0);
 });
});
describe("campaign event transitions",()=>{
 it("never advances from elapsed time alone and never ends at chapter one",()=>{
  const legacy=new WorldRules(),c=new Campaign(()=>{},()=>{});
  for(let i=0;i<10000;i++)c.update(.05,legacy);expect(c.chapter).toBe(1);expect(c.state).toBe("playing");
 });
 it("rejects duplicate legacy completion and safely restores a failed chapter activation",()=>{
  const legacy=new WorldRules();
  let fail=true;const c=new Campaign((chapter)=>{if(chapter===2&&fail)throw new Error("scene allocation failed");},()=>{fail=false;});
  legacy.platform="B2";legacy.config={axis:52,stairs:34,crown:-38};legacy.traversed=["AL","LB","BU","UB2"];c.update(.05,legacy);
  legacy.platform="C";legacy.traversed.push("B2C");legacy.phase="ending";
  c.update(.05,legacy);expect(c.completed).toEqual([1]);legacy.phase="complete";legacy.endTime=5;
  c.update(.05,legacy);expect(c.transitionFailures).toBe(1);expect(c.chapter).toBe(1);expect(legacy.phase).toBe("idle");
  expect(legacy.platform).toBe("B2");expect(legacy.traversed).toEqual(["AL","LB","BU","UB2"]);expect(legacy.config.axis).toBe(52);
  expect(c.entries).toEqual([1]);
 });
});
