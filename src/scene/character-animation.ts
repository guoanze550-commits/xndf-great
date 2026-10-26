import * as T from "three";
import type { MotionState } from "../game/levels";
import type { WinterWorld } from "./world";
/** Same coat/hat/scarf silhouette, distance-driven gait and independent joints. */
export class CharacterAnimation {
  private gait=0;private time=0;private lean=0;
  constructor(private world:WinterWorld){}
  update(dt:number,state:MotionState,speed:number,verticalSpeed:number,distance:number) {
    this.time+=dt;const w=this.world;
    const moving=state==="Walk"||state==="Run";
    const running=state==="Run";
    this.gait+=Math.max(0,distance)/(running?.92:.64)*Math.PI*2;
    const strength=moving?Math.min(1,Math.abs(speed)/1.4):0;
    const stride=Math.sin(this.gait),crouch=state==="JumpPreparation"?-.13:state==="Land"?-.10:0;
    const targetY=.4+crouch+(moving?Math.abs(stride)*.028*strength:Math.sin(this.time*1.7)*.006);
    w.body.position.y=T.MathUtils.damp(w.body.position.y,targetY,crouch?10:18,dt);
    this.lean=T.MathUtils.damp(this.lean,state==="JumpPreparation"?.16:state==="Jump"?.1:running?.13:0,9,dt);
    w.body.rotation.x=this.lean;
    w.body.rotation.z=T.MathUtils.damp(w.body.rotation.z,stride*.025*strength,9,dt);
    for(let i=0;i<2;i++) {
      const sign=i===0?1:-1;
      let leg=stride*sign*(running?.65:.39)*strength;
      if(state==="Jump")leg=(i===0?.28:-.4)+Math.min(.25,verticalSpeed*.025);
      if(state==="Fall")leg=i===0?-.15:.2;
      const bend=Math.acos(T.MathUtils.clamp((w.body.position.y-.1)/.3,.2,1));
      if(crouch)leg=-bend;
      w.legs[i].rotation.x=T.MathUtils.damp(w.legs[i].rotation.x,leg,16,dt);
      w.knees[i].rotation.x=T.MathUtils.damp(w.knees[i].rotation.x,crouch?bend*2:state==="Jump"?.55:Math.max(0,-stride*sign)*.45*strength,18,dt);
      const planted=state!=="Jump"&&state!=="Fall";
      w.ankles[i].rotation.x=planted?-w.legs[i].rotation.x-w.knees[i].rotation.x-w.body.rotation.x:0;
      const arm=state==="Jump"?(i===0?-.6:-.9):state==="Land"?.3:-stride*sign*(running?.6:.26)*strength;
      w.arms[i].rotation.x=T.MathUtils.damp(w.arms[i].rotation.x,arm,12,dt);
      w.elbows[i].rotation.x=T.MathUtils.damp(w.elbows[i].rotation.x,running?-.65:state==="Jump"?-.8:-.15,8,dt);
    }
  }
}
