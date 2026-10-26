import * as T from "three";
import { VIEW_RAY } from "./puzzle";
import { LEVELS, type AdventureChapter, type Surface, type MotionInput } from "./levels";
import { Locomotion } from "./locomotion";
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export type AdventurePhase="exploring"|"sealing"|"lifting"|"assembling"|"orbit"|"recovering"|"complete";
export type AdventureEvent="checkpoint"|"plate"|"seal"|"lift"|"assembly"|"land"|"fail"|"complete";
interface Checkpoint {stage:number;s:number;y:number;angle:number;power:boolean;counterweight:boolean;liftS:number;liftHeight:number;liftDocked:boolean;}
export class AdventureRules {
  readonly definition;
  actor=new Locomotion();stage=0;angle=0;phase:AdventurePhase="exploring";
  power=false;counterweight=false;bridgeLocked=false;liftDocked=false;finalRoad=false;
  projectionReady=false;cameraSettled=true;view:0|1=0;
  timer=0;timerDuration=14;elapsed=0;phaseTime=0;retries=0;
  liftS=5.6;liftHeight=1.5;bridgeRotation=-65;assembly=0;orbitTime=0;
  departure=0;
  completed=false;events:{type:AdventureEvent;stage:number}[]=[];
  checkpoint:Checkpoint;
  private afterSeal:AdventurePhase="exploring";
  input:MotionInput={forward:0,side:0,run:false};
  constructor(public chapter:AdventureChapter) {
    this.definition=LEVELS[chapter];this.actor.reset(-13,this.definition.baseHeight);
    if(chapter===3){this.liftS=-2.9;this.liftHeight=2.2;}
    this.checkpoint=this.capture();
  }
  get challenge(){return this.definition.challenges[Math.min(2,this.stage)];}
  get locked(){return this.phase!=="exploring";}
  get canManipulate(){return !this.locked&&this.actor.grounded&&["start","safe1","safe2","lift","exit"].includes(this.actor.groundId);}
  get aligned(){return Math.abs(Math.sin((this.angle-this.definition.targets[this.stage])*Math.PI/180))*5<.18&&Math.cos((this.angle-this.definition.targets[this.stage])*Math.PI/180)>.9;}
  get canConfirm() {
    if(!this.canManipulate||this.completed) return false;
    if(this.stage===0) return this.aligned&&(this.chapter===2||this.projectionReady);
    if(this.stage===1) return this.chapter===2?this.power&&this.timer===0:this.power&&this.actor.groundId==="lift"&&this.aligned;
    if(this.chapter===2) return this.power&&this.actor.groundId==="lift"&&this.aligned&&!this.liftDocked;
    if(!this.counterweight) return this.power&&this.liftDocked&&Math.abs(this.angle+45)<2.1&&this.actor.groundId==="safe2";
    return this.aligned&&this.projectionReady&&this.liftDocked&&this.power&&!this.finalRoad;
  }
  get actionLabel(){return this.chapter===3&&this.stage===2&&!this.counterweight?"释放石环配重":this.challenge.action;}
  rotate(value:number){if(this.canManipulate&&Number.isFinite(value))this.angle=clamp(value,-80,80);}
  toggleView(){if(this.chapter!==3||!this.canManipulate)return false;this.view=this.view===0?1:0;this.projectionReady=false;return true;}
  confirm() {
    if(!this.canConfirm)return false;
    this.input={forward:0,side:0,run:false};this.actor.velocity=0;
    this.phaseTime=0;
    if(this.chapter===3&&this.stage===2&&!this.counterweight) {
      this.counterweight=true;this.saveCheckpoint();this.emit("plate");return true;
    }
    this.phase="sealing";this.afterSeal="exploring";
    if(this.stage===0)this.bridgeLocked=true;
    else if(this.chapter===2&&this.stage===1){this.timer=this.timerDuration=14;}
    else if((this.chapter===2&&this.stage===2)||(this.chapter===3&&this.stage===1))this.afterSeal="lifting";
    else if(this.chapter===3&&this.stage===2)this.afterSeal="assembling";
    this.emit("seal");return true;
  }
  requestJump(){if(!this.locked)this.actor.jump();}
  private emit(type:AdventureEvent){this.events.push({type,stage:this.stage});}
  private capture():Checkpoint{return {stage:this.stage,s:this.actor.s,y:this.actor.y,angle:this.angle,power:this.power,counterweight:this.counterweight,liftS:this.liftS,liftHeight:this.liftHeight,liftDocked:this.liftDocked};}
  private saveCheckpoint(){this.checkpoint=this.capture();}
  retry() {
    const c=this.checkpoint;this.stage=c.stage;this.angle=c.angle;this.power=c.power;this.counterweight=c.counterweight;
    this.liftS=c.liftS;this.liftHeight=c.liftHeight;this.liftDocked=c.liftDocked;
    this.bridgeLocked=this.stage>0;this.departure=0;this.finalRoad=false;this.timer=0;this.assembly=0;this.orbitTime=0;
    this.bridgeRotation=this.liftDocked?0:-65;this.completed=false;this.phase="exploring";this.phaseTime=0;
    this.actor.reset(c.s,c.y,this.stage===0?"start":this.stage===1?"safe1":"safe2");
    this.input={forward:0,side:0,run:false};
  }
  fail(){if(this.phase==="recovering"||this.completed)return;this.retries++;this.phase="recovering";this.phaseTime=0;this.input={forward:0,side:0,run:false};this.emit("fail");}
  depth(s:number) {
    if(this.chapter===2)return 0;
    return smooth((s+9.3)/.8)*3+smooth((s-9.1)/.8)*2;
  }
  point(s:number,y:number,lane=0){return new T.Vector3(s,y,lane).addScaledVector(VIEW_RAY,this.depth(s));}
  projectionEndpoints(){const near=new T.Vector3(-8.9,2.2,0);return [near,near.clone().addScaledVector(VIEW_RAY,3)] as const;}
  /** Actual camera projection, not a selected-view integer, grants the link. */
  measureProjection(camera:T.Camera) {
    camera.updateMatrixWorld(true);
    const [a,b]=this.projectionEndpoints();
    const p=a.clone().project(camera),q=b.clone().project(camera);
    const unit=a.clone().add(new T.Vector3(1,0,0)).project(camera);
    const scale=Math.hypot(unit.x-p.x,unit.y-p.y);
    this.projectionReady=Math.hypot(p.x-q.x,p.y-q.y)<=Math.max(1e-8,scale*.15);
  }
  surfaces():Surface[] {
    const list:Surface[]=[];
    const add=(id:string,from:number,to:number,height:number,width=1.5,kind:Surface["kind"]="stone")=>list.push({id,from,to,height,width,kind});
    const h=this.definition.baseHeight;
    add("start",-14.8,-11,h,2.8);
    if(this.chapter===2) {
      if(this.bridgeLocked){add("bridge-a",-11,-8.5,h,1.15,"bridge");add("bridge-b",-6.8,-5.6,h,1.15,"bridge");}
      add("safe1",-5.6,-3.5,h,2.6);
      if(this.timer>0&&this.stage===1)add("timed-ice",-3.5,2.6,h,1.25,"ice");
      add("safe2",2.6,4.9,h,2.6);
      add("lift",this.liftS-.8,this.liftS+.8,this.liftHeight,1.7,"lift");
      if(this.liftDocked&&Math.abs(this.bridgeRotation)<1.5){add("high-bridge-a",8.5,10.2,4.2,1.3,"bridge");add("high-bridge-b",11.8,12.8,4.2,1.3,"bridge");}
      add("exit",12.8,15.5,4.2+this.departure*2.2,3);
    } else {
      if(this.bridgeLocked&&this.projectionReady)add("ray-bridge",-11,-6,h,1.3,"ray");
      add("safe1",-6,-3.8,h,2.8);
      add("lift",-3.8,-2,this.liftHeight,1.8,"lift");
      add("safe2",-2,1.2,5.2,3);
      if(this.finalRoad&&this.timer>0&&this.assembly>=1&&this.projectionReady){add("ring-ice-a",1.2,3.1,5.2,1.3,"ice");add("ring-ice-b",4.8,8.5,5.2,1.3,"ice");add("final-ray",8.5,12,5.2,1.3,"ray");}
      add("exit",12,15.5,5.2,3);
    }
    return list;
  }
  private advanceCheckpoint(stage:number) {
    this.stage=stage;this.power=true;this.timer=0;this.actor.velocity=0;this.input={forward:0,side:0,run:false};
    this.saveCheckpoint();this.emit("checkpoint");this.emit("plate");
  }
  update(dt:number) {
    if(this.completed)return;
    this.elapsed+=dt;this.phaseTime+=dt;
    if(this.phase==="recovering"){if(this.phaseTime>=.65)this.retry();return;}
    if(this.phase==="sealing") {
      if(this.phaseTime>=.75){this.phase=this.afterSeal;this.phaseTime=0;if(this.phase==="lifting")this.emit("lift");if(this.phase==="assembling")this.emit("assembly");}
      return;
    }
    if(this.phase==="lifting") {
      const beforeS=this.liftS,beforeH=this.liftHeight,t=smooth(this.phaseTime/2.6);
      if(this.chapter===2){this.liftS=5.6+3*t;this.liftHeight=1.5+2.7*t;this.bridgeRotation=-65*(1-t);}
      else this.liftHeight=2.2+3*t;
      if(this.actor.groundId==="lift"){this.actor.s+=this.liftS-beforeS;this.actor.y+=this.liftHeight-beforeH;}
      if(t>=1){this.liftDocked=true;this.bridgeRotation=0;this.phase="exploring";this.phaseTime=0;}
      return;
    }
    if(this.phase==="assembling") {
      this.assembly=smooth(this.phaseTime/2.4);
      if(this.assembly>=1){this.finalRoad=true;this.phase="orbit";this.orbitTime=0;this.phaseTime=0;}
      return;
    }
    if(this.phase==="orbit") {
      this.orbitTime+=dt;
      if(this.orbitTime>=4&&this.projectionReady&&this.cameraSettled){this.phase="exploring";this.phaseTime=0;this.timer=this.timerDuration=20;}
      return;
    }
    if(this.timer>0){this.timer=Math.max(0,this.timer-dt);if(this.timer===0)this.emit("fail");}
    const lastLandings=this.actor.landings;
    for(let remain=dt;remain>1e-6;remain-=1/120) this.actor.step(Math.min(1/120,remain),this.input,this.surfaces());
    if(this.actor.landings>lastLandings)this.emit("land");
    if(this.actor.y<-.9||Math.abs(this.actor.lane)>2.6){this.fail();return;}
    if(this.actor.grounded) {
      if(this.stage===0&&this.actor.groundId==="safe1"&&this.actor.s>=this.definition.checkpoints[1])this.advanceCheckpoint(1);
      else if(this.stage===1&&this.actor.groundId==="safe2"&&this.actor.s>=this.definition.checkpoints[2])this.advanceCheckpoint(2);
      else if(this.stage===2&&this.actor.groundId==="exit"&&this.actor.s>=this.definition.exit) {
        this.completed=true;this.phase="complete";this.input={forward:0,side:0,run:false};this.timer=0;this.emit("complete");
      }
    }
  }
  /** The second exit really rises, carrying its rider before the next doorway. */
  raiseDeparture(dt:number) {
    if(this.chapter!==2||this.departure>=1)return true;
    const previous=this.departure;this.departure=Math.min(1,this.departure+dt/1.2);
    if(this.actor.groundId==="exit")this.actor.y+=(this.departure-previous)*2.2;
    this.actor.velocity=0;this.actor.state="Idle";
    return this.departure>=1;
  }
  /** Door approach is still collision-resolved walking, never a scene teleport. */
  approachDoor(dt:number,target=14.45) {
    const distance=target-this.actor.s;
    if(distance<.055&&Math.abs(this.actor.velocity)<.15)return true;
    const input={forward:distance>.06?1:0,side:0,run:false};
    for(let remain=dt;remain>1e-6;remain-=1/120)this.actor.step(Math.min(1/120,remain),input,this.surfaces());
    return Math.abs(target-this.actor.s)<.12&&Math.abs(this.actor.velocity)<.2;
  }
  snapshot(){return {chapter:this.chapter,stage:this.stage,phase:this.phase,angle:this.angle,view:this.view,projectionReady:this.projectionReady,canConfirm:this.canConfirm,canManipulate:this.canManipulate,power:this.power,counterweight:this.counterweight,liftDocked:this.liftDocked,liftS:this.liftS,liftHeight:this.liftHeight,bridgeRotation:this.bridgeRotation,assembly:this.assembly,departure:this.departure,finalRoad:this.finalRoad,timer:this.timer,retries:this.retries,completed:this.completed,actor:{s:this.actor.s,y:this.actor.y,lane:this.actor.lane,velocity:this.actor.velocity,vy:this.actor.verticalVelocity,grounded:this.actor.grounded,groundId:this.actor.groundId,state:this.actor.state,jumps:this.actor.jumps,landings:this.actor.landings}};}
}
