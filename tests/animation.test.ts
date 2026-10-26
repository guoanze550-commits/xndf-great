import * as T from 'three';
import {expect,it} from 'vitest';
import {CharacterAnimation} from '../src/scene/character-animation';
import type {WinterWorld} from '../src/scene/world';
it('keeps boot soles flat through crouch and landing with independent knee/ankle joints',()=>{
 const body=new T.Group();body.position.y=.4;
 const legs:T.Group[]=[],knees:T.Group[]=[],ankles:T.Group[]=[],arms:T.Group[]=[],elbows:T.Group[]=[],boots:T.Mesh[]=[];
 for(let i=0;i<2;i++){
  const leg=new T.Group();leg.position.set(i?-.09:.09,-.04,0);body.add(leg);legs.push(leg);
  const knee=new T.Group();knee.position.y=-.15;leg.add(knee);knees.push(knee);
  const ankle=new T.Group();ankle.position.y=-.15;knee.add(ankle);ankles.push(ankle);
  const boot=new T.Mesh(new T.BoxGeometry(.12,.09,.22));boot.position.z=.035;ankle.add(boot);boots.push(boot);
  arms.push(new T.Group());elbows.push(new T.Group());
 }
 const a=new CharacterAnimation({body,legs,knees,ankles,arms,elbows} as unknown as WinterWorld);
 for(const state of ['JumpPreparation','Land','Idle'] as const){
  for(let i=0;i<30;i++){a.update(1/60,state,0,0,0);body.updateMatrixWorld(true);for(const boot of boots)expect(new T.Box3().setFromObject(boot).min.y).toBeGreaterThan(-.035);}
 }
 expect(knees[0].rotation.x).toBeLessThan(.1);
});
