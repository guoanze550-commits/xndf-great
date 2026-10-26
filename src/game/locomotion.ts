import { MOVEMENT as M, type MotionInput, type MotionState, type Surface } from "./levels";
const approach=(a:number,b:number,step:number)=>a+Math.max(-step,Math.min(step,b-a));
export class Locomotion {
  s=-13; lane=0; y=1.5; velocity=0; verticalVelocity=0;
  grounded=true; groundId="start"; state:MotionState="Idle";
  jumpBuffer=0; coyote=M.coyote; preparation=0; landing=0;
  jumps=0; landings=0; distance=0;
  reset(s:number,y:number,groundId="start") {
    this.s=s;this.y=y;this.lane=0;this.velocity=0;this.verticalVelocity=0;
    this.grounded=true;this.groundId=groundId;this.state="Idle";
    this.jumpBuffer=0;this.coyote=M.coyote;this.preparation=0;this.landing=0;
  }
  jump() {this.jumpBuffer=M.buffer;}
  support(s:number,surfaces:Surface[]) {
    return surfaces.filter(p=>s>=p.from-M.radius*.35&&s<=p.to+M.radius*.35&&Math.abs(this.lane)<=p.width/2-M.radius*.4).sort((a,b)=>b.height-a.height)[0];
  }
  step(dt:number,input:MotionInput,surfaces:Surface[]) {
    this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.landing=Math.max(0,this.landing-dt);
    this.coyote=this.grounded?M.coyote:Math.max(0,this.coyote-dt);
    const desired=Math.max(-1,Math.min(1,input.forward))*(input.run?M.run:M.walk);
    this.velocity=approach(this.velocity,desired,(input.forward?M.acceleration:M.friction)*dt);
    this.lane+=input.side*1.4*dt;
    if(this.jumpBuffer>0&&this.coyote>0&&this.preparation===0) {this.preparation=M.jumpPreparation;this.jumpBuffer=0;}
    if(this.preparation>0) {
      this.preparation=Math.max(0,this.preparation-dt);
      if(this.preparation===0&&this.coyote>0) {
        this.verticalVelocity=M.jumpVelocity;this.grounded=false;this.coyote=0;this.groundId="";this.jumps++;
      }
    }
    const previousS=this.s,previousY=this.y;
    let nextS=this.s+this.velocity*dt;
    const ground=this.support(nextS,surfaces);
    // Authored solid sides block the capsule until its feet can clear the top.
    if(ground&&ground.height>this.y+.24&&this.groundId!==ground.id) {nextS=this.s;this.velocity=0;}
    const floor=this.support(nextS,surfaces);
    this.s=nextS;this.distance+=Math.abs(this.s-previousS);
    if(this.grounded&&floor&&Math.abs(floor.height-this.y)<=.24&&this.verticalVelocity<=0) {
      this.y=floor.height;this.groundId=floor.id;this.verticalVelocity=0;
    } else {
      this.grounded=false;this.groundId="";
      this.verticalVelocity-=M.gravity*dt;this.y+=this.verticalVelocity*dt;
      if(floor&&this.verticalVelocity<=0&&previousY>=floor.height-.05&&this.y<=floor.height) {
        this.y=floor.height;this.verticalVelocity=0;this.grounded=true;this.groundId=floor.id;
        this.landing=.18;this.landings++;
      }
    }
    this.state=this.preparation>0?"JumpPreparation":!this.grounded?(this.verticalVelocity>0?"Jump":"Fall"):this.landing>0?"Land":Math.abs(this.velocity)>2.1?"Run":Math.abs(this.velocity)>.08?"Walk":"Idle";
  }
}
