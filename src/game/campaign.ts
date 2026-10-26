import { AdventureRules } from "./adventure";
import { WorldRules } from "./rules";
import type { AdventureChapter } from "./levels";
export type CampaignState="playing"|"leaving"|"entering"|"restoring"|"complete";
/** Only arrival/collision and animation completion events advance chapters. */
export class Campaign {
  chapter:1|2|3=1;state:CampaignState="playing";engine:AdventureRules|null=null;
  mask=0;endTime=0;completed:number[]=[];entries=[1];transitionFailures=0;
  private previousLegacy:Partial<WorldRules>|null=null;
  private checkpointNode="A";
  constructor(private activate:(chapter:1|2|3,engine:AdventureRules|null)=>void,private onFailure:()=>void){}
  get acceptsInput(){return this.state==="playing";}
  reset(){this.chapter=1;this.state="playing";this.engine=null;this.mask=0;this.endTime=0;this.completed=[];this.entries=[1];this.previousLegacy=null;this.checkpointNode="A";this.activate(1,null);}
  private rememberLegacy(r:WorldRules){
    if(r.platform===this.checkpointNode||r.platform==="C")return;
    this.checkpointNode=r.platform;
    this.previousLegacy={platform:r.platform,config:{...r.config},traversed:[...r.traversed],phase:"idle",growth:{...r.growth},elapsed:r.elapsed};
  }
  private next(r:WorldRules) {
    const oldChapter=this.chapter,oldEngine=this.engine;
    const chapter=(oldChapter+1) as AdventureChapter;
    try {
      const next=new AdventureRules(chapter);next.cameraSettled=false;next.actor.reset(-14,next.definition.baseHeight);
      this.activate(chapter,next);
      this.chapter=chapter;this.engine=next;this.state="entering";this.mask=1;this.entries.push(chapter);
    } catch {
      this.transitionFailures++;this.completed=this.completed.filter(c=>c!==oldChapter);
      if(oldEngine)oldEngine.retry();
      else {const saved=this.previousLegacy;r.reset();if(saved)Object.assign(r,saved);}
      this.activate(oldChapter,oldEngine);this.state="restoring";this.onFailure();
    }
  }
  update(dt:number,r:WorldRules) {
    if(this.state==="complete"){this.engine?.approachDoor(dt);this.endTime+=dt;return;}
    if(this.state==="restoring"){this.mask=Math.max(0,this.mask-dt*1.5);if(this.mask===0)this.state="playing";return;}
    if(this.state==="playing") {
      if(this.chapter===1){this.rememberLegacy(r);if(r.phase==="ending"&&r.platform==="C"&&r.traversed.length===5){this.completed.push(1);this.state="leaving";}}
      else {
        this.engine!.update(dt);
        if(this.engine!.completed){this.completed.push(this.chapter);if(this.chapter===3){this.state="complete";this.endTime=0;}else this.state="leaving";}
      }
    }
    if(this.state==="leaving") {
      const ready=this.chapter===1?r.phase==="complete":this.engine!.raiseDeparture(dt)&&this.engine!.approachDoor(dt);
      const progress=this.chapter===1?Math.min(1,r.endTime/3.5):Math.min(1,(this.engine!.actor.s-this.engine!.definition.exit)/.95);
      this.mask=Math.min(1,Math.max(this.mask,progress));
      if(ready){this.mask=Math.min(1,this.mask+dt*2);if(this.mask>=1)this.next(r);}
    } else if(this.state==="entering") {
      if(this.mask===1&&!this.engine!.cameraSettled)return;
      const ready=this.engine!.approachDoor(dt,-13);
      this.mask=Math.max(0,this.mask-dt*.75);
      if(ready&&this.mask===0&&this.engine!.cameraSettled)this.state="playing";
    }
  }
  snapshot(){return {chapter:this.chapter,state:this.state,mask:this.mask,completed:[...this.completed],entries:[...this.entries],transitionFailures:this.transitionFailures,engine:this.engine?.snapshot()??null};}
}
