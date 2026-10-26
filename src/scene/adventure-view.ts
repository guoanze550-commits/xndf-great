import * as T from "three";
import { VIEW_RAY } from "../game/puzzle";
import { AdventureRules } from "../game/adventure";
import type { AdventureChapter, Surface } from "../game/levels";
import type { Campaign } from "../game/campaign";
import type { WinterWorld } from "./world";
import { beveledBox } from "./geometry";
import { iceMaterial } from "./materials";
import { CharacterAnimation } from "./character-animation";
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
interface Piece {p:T.Vector3;scale:T.Vector3;q:T.Quaternion;}

class ChapterScene {
  departureRoot=new T.Group();
  private buildingDeparture=false;
  private departureBatches=new Map<T.Material,Piece[]>();
  root=new T.Group();bridge=new T.Group();highBridge=new T.Group();lift=new T.Group();
  road=new T.Group();rings:T.Group[]=[];gears:T.Group[]=[];markers:T.Mesh[]=[];
  iceMaterial:T.MeshPhysicalMaterial;
  private sharedFrost=iceMaterial();
  frost:T.ShaderMaterial[]=[];cracks:T.LineSegments[]=[];plate:T.Mesh;
  entrance:T.PointLight;exit:T.PointLight;
  private batches=new Map<T.Material,Piece[]>();
  private cube=beveledBox(1,1,1,.035);
  constructor(private world:WinterWorld,public chapter:AdventureChapter) {
    const r=new AdventureRules(chapter),h=r.definition.baseHeight;
    this.root.name=`chapter-${chapter}-authored-architecture`;
    this.sharedFrost.vertexShader=`varying vec2 vUv;
void main(){vUv=uv;vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`;
    this.iceMaterial=new T.MeshPhysicalMaterial({color:0x79b8cb,metalness:.1,roughness:.24,transparent:true,opacity:.75,clearcoat:.4,depthWrite:false});
    this.root.add(this.departureRoot);
    for(const surface of r.surfaces().filter(p=>p.kind==="stone")){
      this.buildingDeparture=chapter===2&&surface.id==="exit";this.island(r,surface);
    }
    this.buildingDeparture=false;
    // Authored load-bearing arcades: piers, setbacks, cornices and open bays.
    for(const [x,z,height,width] of (chapter===2?[[-12,-6,8,2.7],[-4,-10,13,3],[5,-8,15,3.4],[13,-6,9,2.5]]:[[-12,-7,12,3],[-4,-11,19,3.5],[6,-10,17,3.5],[15,-7,14,3]])) {
      for(const side of [-1,1]) {
        this.block(world.detailedStone,new T.Vector3(x+side*width*.6,height/2-.3,z),new T.Vector3(.65,height,1.3));
        this.block(world.snowMat,new T.Vector3(x+side*width*.6,height-.25,z),new T.Vector3(.85,.1,1.5));
        for(let y=1.8;y<height;y+=2.5)this.block(world.carvedStone,new T.Vector3(x+side*width*.6,y,z+.03),new T.Vector3(.9,.2,1.5));
      }
      this.block(world.detailedStone,new T.Vector3(x,height-.8,z),new T.Vector3(width*1.4,1.1,1.4));
      this.block(world.snowMat,new T.Vector3(x,height-.2,z),new T.Vector3(width*1.5,.12,1.5));
      this.block(world.warm,new T.Vector3(x-width*.6+.35,height*.47,z+.7),new T.Vector3(.045,1.1,.06));
      for(const y of [height*.32,height*.64]) {
        this.block(world.carvedStone,new T.Vector3(x,y,z-.4),new T.Vector3(width*1.6,.5,1));
        this.block(world.snowMat,new T.Vector3(x,y+.29,z-.4),new T.Vector3(width*1.65,.08,1.05));
      }
    }
    // Structured distant aqueduct, only two batches regardless of repetition.
    for(let i=0;i<12;i++) {
      const x=-21+i*3.8,top=chapter===3?8.8:5.8;
      for(const side of [-1,1])this.block(world.stone,new T.Vector3(x+side*1.2,top/2-1,-18),new T.Vector3(.5,top+2,.75));
      this.block(world.carvedStone,new T.Vector3(x,top,-18),new T.Vector3(3.4,.7,.95));
      this.block(world.snowMat,new T.Vector3(x,top+.38,-18),new T.Vector3(3.55,.07,1));
    }
    // Submerged abandoned routes anchor the architecture in the reflecting water.
    for(const [x,z] of [[-10,5],[-5,7],[2,6],[10,8]]) {
      this.block(world.carvedStone,new T.Vector3(x,-.8,z),new T.Vector3(1.2,1.4,1.2));
      this.block(world.stone,new T.Vector3(x+1.8,-.5,z),new T.Vector3(2.8,.3,.7));
    }
    this.root.add(this.bridge,this.highBridge,this.lift,this.road);
    this.bridge.position.copy(r.point(-11,h));
    this.route(r,-11,chapter===2?-8.5:-6,h,1.25,this.bridge,this.bridge.position);
    if(chapter===2)this.route(r,-6.8,-5.6,h,1.25,this.bridge,this.bridge.position);
    this.highBridge.position.copy(r.point(8.5,4.2));
    if(chapter===2) {
      this.route(r,8.5,10.2,4.2,1.35,this.highBridge,this.highBridge.position);
      this.route(r,11.8,12.8,4.2,1.35,this.highBridge,this.highBridge.position);
      this.route(r,-3.5,2.6,h,1.28,this.road,new T.Vector3(),true);
    } else {
      this.route(r,1.2,3.1,5.2,1.3,this.road,new T.Vector3(),true);
      this.route(r,4.8,12,5.2,1.3,this.road,new T.Vector3(),true);
      for(const [radius,z,tilt] of [[4.6,-3.5,.3],[3.4,-4.2,-.4],[2.1,-4.8,.6]]) {
        const ring=new T.Group();ring.position.copy(r.point(4,8));ring.position.z+=z;
        const stone=new T.Mesh(new T.TorusGeometry(radius,.24,8,64),world.carvedStone);stone.castShadow=true;ring.add(stone);
        const trim=new T.Mesh(new T.TorusGeometry(radius+.08,.035,5,64),world.metal);trim.position.z=.25;ring.add(trim);
        for(let i=0;i<16;i++){
          const a=i*Math.PI/8;
          const stoneBlock=new T.Mesh(this.cube,world.detailedStone);stoneBlock.position.set(Math.cos(a)*radius,Math.sin(a)*radius,.05);stoneBlock.scale.set(.65,.42,.6);stoneBlock.rotation.z=a+Math.PI/2;ring.add(stoneBlock);
          const cap=new T.Mesh(this.cube,world.snowMat);cap.position.set(Math.cos(a)*(radius+.2),Math.sin(a)*(radius+.2),.05);cap.scale.set(.64,.055,.64);cap.rotation.z=a+Math.PI/2;ring.add(cap);
          const tooth=new T.Mesh(this.cube,world.metal);tooth.position.set(Math.cos(a)*radius,Math.sin(a)*radius,.39);tooth.scale.set(.18,.16,.12);tooth.rotation.z=a;ring.add(tooth);
        }
        ring.rotation.y=tilt;this.root.add(ring);this.rings.push(ring);
      }
    }
    const deck=new T.Mesh(this.cube,world.carvedStone);deck.scale.set(1.65,.25,1.8);deck.position.y=-.15;this.lift.add(deck);
    const snow=new T.Mesh(this.cube,world.snowMat);snow.scale.set(1.68,.045,1.82);snow.position.y=-.02;this.lift.add(snow);
    const rim=new T.Mesh(new T.TorusGeometry(.48,.035,6,32),world.warm);rim.rotation.x=-Math.PI/2;rim.position.y=.015;this.lift.add(rim);
    const shaftBase=r.point(r.liftS,-.3),shaftTop=r.point(r.liftS,chapter===2?4.5:5.5);
    for(const side of [-1,1])this.beam(shaftBase.clone().add(new T.Vector3(0,0,side*1.1)),shaftTop.clone().add(new T.Vector3(0,0,side*1.1)),.12,.12,world.metal,this.root);
    const cp=r.point(chapter===2?-4.8:.15,chapter===2?h:5.2);
    if(chapter===3){
      const lowerPlate=new T.Mesh(this.cube,world.warm);lowerPlate.position.copy(r.point(-4.8,h+.025));lowerPlate.scale.set(.85,.05,.85);this.root.add(lowerPlate);
      const cablePoints=[r.point(-4.8,h+.06,-.85),r.point(-3.9,h+.06,-.85),r.point(-2.9,h+.06,-.85),r.point(-2.9,5.2,-.85)];
      const cable=new T.Line(new T.BufferGeometry().setFromPoints(cablePoints),new T.LineBasicMaterial({color:0x8aaeb9}));this.root.add(cable);
    }
    this.plate=new T.Mesh(this.cube,world.warm);this.plate.position.copy(cp).y+=.025;this.plate.scale.set(.85,.05,.85);this.root.add(this.plate);
    for(const [s,y] of [[-14,h],[14.45,chapter===2?4.2:5.2]]) {
      const p=r.point(s,y);this.buildingDeparture=chapter===2&&s>0;
      for(const side of [-1,1])this.block(world.carvedStone,p.clone().add(new T.Vector3(0,1.7,side*.92)),new T.Vector3(.6,3.4,.5));
      this.block(world.detailedStone,p.clone().add(new T.Vector3(0,3.5,0)),new T.Vector3(.75,.7,2.45));
      this.block(world.snowMat,p.clone().add(new T.Vector3(0,3.9,0)),new T.Vector3(.85,.12,2.6));
      this.block(world.warm,p.clone().add(new T.Vector3(0,1.45,0)),new T.Vector3(.08,2.8,1.35));
    }
    this.buildingDeparture=false;
    if(chapter===2){
      const origin=this.highBridge.position;
      for(const side of [-1,1]){
        const a=r.point(8.5,3.2,side*1.05).sub(origin),b=r.point(12.8,3.7,side*1.05).sub(origin);
        this.beam(a,b,.15,.22,world.metal,this.highBridge);
        this.beam(r.point(5,4.2,side*1.05).sub(origin),r.point(8.5,4.2,side*1.05).sub(origin),.38,.4,world.carvedStone,this.highBridge);
      }
    }
    this.entrance=new T.PointLight(0xffc887,8,6);this.entrance.position.copy(r.point(-13.5,h+1));
    this.exit=new T.PointLight(0xffc887,14,8);this.exit.position.copy(r.point(14,chapter===2?5.5:6.5));this.root.add(this.entrance);if(chapter===2)this.departureRoot.add(this.exit);else this.root.add(this.exit);
    for(const [s,y] of [[-11,h],[chapter===2?5.6:-2.9,h],[chapter===2?8.5:1,chapter===2?4.2:5.2]]) {
      const gear=new T.Group();gear.position.copy(r.point(s,y+.15));gear.position.z-=1.05;
      const wheel=new T.Mesh(new T.TorusGeometry(.65,.08,6,36),world.metal);gear.add(wheel);
      const hub=new T.Mesh(new T.CylinderGeometry(.17,.17,.25,12),world.metal);hub.rotation.x=Math.PI/2;gear.add(hub);
      for(let i=0;i<12;i++){const a=i*Math.PI/6,t=new T.Mesh(this.cube,world.metal);t.position.set(Math.cos(a)*.72,Math.sin(a)*.72,0);t.scale.set(.22,.16,.15);t.rotation.z=a;gear.add(t);}
      if(this.gears.length===2){gear.scale.setScalar(1.6);gear.position.z-=.5;}
      this.root.add(gear);this.gears.push(gear);
    }
    for(const [s,y] of [[-10.8,h],[-5.7,h],[chapter===2?10.2:3.1,chapter===2?4.2:5.2],[chapter===2?11.8:4.8,chapter===2?4.2:5.2]]) {
      const marker=new T.Mesh(new T.TorusGeometry(.16,.018,5,24),world.warm);marker.position.copy(r.point(s,y+.035));marker.rotation.x=-Math.PI/2;this.root.add(marker);this.markers.push(marker);
    }
    this.flush();
    for(const group of [this.bridge,this.highBridge,this.road,...this.gears,...this.rings])this.compact(group);
  }
  private compact(group:T.Group) {
    const map=new Map<T.Material,T.Mesh[]>();
    for(const child of [...group.children])if(child instanceof T.Mesh&&!(child instanceof T.InstancedMesh)&&child.geometry===this.cube&&!Array.isArray(child.material)) {
      if(!map.has(child.material))map.set(child.material,[]);map.get(child.material)!.push(child);
    }
    for(const [mat,meshes] of map)if(meshes.length>1){
      const batch=new T.InstancedMesh(this.cube,mat,meshes.length);batch.castShadow=true;batch.receiveShadow=true;
      meshes.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);group.remove(mesh);});group.add(batch);
    }
  }
  private block(material:T.Material,p:T.Vector3,scale:T.Vector3,q=new T.Quaternion()) {
    const batches=this.buildingDeparture?this.departureBatches:this.batches;
    if(!batches.has(material))batches.set(material,[]);
    batches.get(material)!.push({p,scale,q});
  }
  private flush() {
    const m=new T.Object3D();
    for(const [batches,parent] of [[this.batches,this.root],[this.departureBatches,this.departureRoot]] as const)for(const [material,pieces] of batches) {
      const mesh=new T.InstancedMesh(this.cube,material,pieces.length);mesh.castShadow=true;mesh.receiveShadow=true;
      pieces.forEach((piece,i)=>{m.position.copy(piece.p);m.scale.copy(piece.scale);m.quaternion.copy(piece.q);m.updateMatrix();mesh.setMatrixAt(i,m.matrix);});
      parent.add(mesh);
    }
    this.batches.clear();this.departureBatches.clear();
  }
  private island(r:AdventureRules,s:Surface) {
    const mid=(s.from+s.to)/2,p=r.point(mid,s.height),length=s.to-s.from;
    const bottom=r.chapter===2&&s.id==="exit"?-3:-.4;
    this.block(this.world.carvedStone,p.clone().setY((p.y+bottom)/2),new T.Vector3(Math.max(.9,length-.2),p.y-bottom,Math.max(1,s.width-.15)));
    this.block(this.world.detailedStone,p.clone().add(new T.Vector3(0,-.2,0)),new T.Vector3(length,.4,s.width));
    const count=Math.max(2,Math.ceil(length/.6));
    for(let i=0;i<count;i++) {
      const q=r.point(s.from+(i+.5)*length/count,s.height);
      this.block(this.world.snowMat,q.clone().add(new T.Vector3(0,-.02,0)),new T.Vector3(length/count-.018,.04,s.width+.04));
      this.block(this.world.metal,q.clone().add(new T.Vector3(0,-.25,s.width*.48)),new T.Vector3(.05,.12,.05));
    }
    for(const y of [.55,Math.max(.8,p.y*.55)])this.block(this.world.carvedStone,new T.Vector3(p.x,y,p.z),new T.Vector3(length+.15,.15,s.width+.12));
  }
  private beam(a:T.Vector3,b:T.Vector3,width:number,thickness:number,material:T.Material,parent:T.Group) {
    const delta=b.clone().sub(a);const mesh=new T.Mesh(this.cube,material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.position.y-=thickness/2;
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),delta.clone().normalize());mesh.scale.set(width,thickness,delta.length()+.015);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private route(r:AdventureRules,from:number,to:number,height:number,width:number,parent:T.Group,origin:T.Vector3,ice=false) {
    const n=Math.ceil((to-from)/(r.chapter===3?.16:.55));
    for(let i=0;i<n;i++) {
      const a=r.point(from+(to-from)*i/n,height).sub(origin),b=r.point(from+(to-from)*(i+1)/n,height).sub(origin);
      this.beam(a,b,width,ice?.12:.22,ice?this.iceMaterial:this.world.carvedStone,parent);
      if(!ice){this.beam(a.clone().add(new T.Vector3(0,.015,0)),b.clone().add(new T.Vector3(0,.015,0)),width+.025,.035,this.world.snowMat,parent);}
      else {
        const mat=this.sharedFrost;mat.side=T.DoubleSide;mat.depthWrite=false;if(!this.frost.includes(mat))this.frost.push(mat);
        this.beam(a.clone().add(new T.Vector3(0,.014,0)),b.clone().add(new T.Vector3(0,.014,0)),width+.02,.025,mat,parent);
      }
    }
    if(ice) {
      const lines:T.Vector3[]=[];
      for(let i=0;i<24;i++) {
        const s=from+(to-from)*(i+.5)/24,p=r.point(s,height+.035).sub(origin);
        lines.push(p.clone().add(new T.Vector3(-.07,0,-width*.48)),p.clone().add(new T.Vector3(.1,0,.1)),p.clone().add(new T.Vector3(.1,0,.1)),p.clone().add(new T.Vector3(-.08,0,width*.45)));
      }
      const crack=new T.LineSegments(new T.BufferGeometry().setFromPoints(lines),new T.LineBasicMaterial({color:0xe0eeef,transparent:true,opacity:0}));parent.add(crack);this.cracks.push(crack);
    }
  }
  update(r:AdventureRules,time:number) {
    const delta=r.angle-r.definition.targets[0];
    this.bridge.rotation.y=T.MathUtils.degToRad(r.bridgeLocked?0:delta);
    this.highBridge.rotation.y=T.MathUtils.degToRad(r.bridgeRotation);
    this.lift.position.copy(r.point(r.liftS,r.liftHeight));
    this.departureRoot.position.y=r.departure*2.2;
    this.road.visible=r.chapter===2?r.timer>0&&r.stage===1:r.finalRoad||r.phase==="assembling";
    const growth=r.phase==="sealing"?clamp(r.phaseTime/.75,0,1):r.chapter===3?r.assembly:1;
    for(const mat of this.frost){mat.uniforms.growth.value=growth;mat.uniforms.seal.value=growth;}
    const life=r.timer>0?r.timer/r.timerDuration:1;
    this.iceMaterial.opacity=.4+life*.4;
    for(const crack of this.cracks)(crack.material as T.LineBasicMaterial).opacity=clamp((1-life)*1.35,0,.9);
    if(r.chapter===3)this.road.position.y=(1-r.assembly)*-2.8;
    this.rings.forEach((ring,i)=>{ring.rotation.z=T.MathUtils.degToRad(r.angle)*(i%2?-.5:1)+r.assembly*(i+1)*Math.PI/5;ring.position.y=r.point(4,8).y+(1-r.assembly)*i*.3;});
    this.gears.forEach((gear,i)=>gear.rotation.z=T.MathUtils.degToRad(r.angle)*(i%2?-.65:1));
    this.plate.scale.y=T.MathUtils.damp(this.plate.scale.y,r.power?.025:.05,7,.016);
    this.markers.forEach((m,i)=>{m.scale.setScalar(1+Math.sin(time*2+i)*.08);m.visible=r.stage===0?i<2:i>=2;});
    this.exit.intensity=10+(r.completed?Math.min(15,time*.4):r.stage===2?4:0);
  }
}

export class AdventureView {
  private scenes=new Map<AdventureChapter,ChapterScene>();
  private current:ChapterScene|null=null;
  private target=new T.Vector3();private initialized=false;
  private animation:CharacterAnimation;private previousActor=new T.Vector3();
  private sharedDirection=VIEW_RAY.clone();
  private heading=Math.PI/2;
  private crystalDummy=new T.Object3D();
  private legacyGate:T.Vector2;
  constructor(public world:WinterWorld) {
    this.legacyGate=world.water.uniforms.gate.value.clone();
    world.setLegacyVisible(true);this.animation=new CharacterAnimation(world);
    world.water.uniforms.viewRay.value=VIEW_RAY.clone();
  }
  activate(chapter:1|2|3,engine:AdventureRules|null) {
    if(chapter>1&&!this.scenes.has(chapter as AdventureChapter)) {
      const scene=new ChapterScene(this.world,chapter as AdventureChapter);
      scene.root.visible=false;this.world.scene.add(scene.root);this.scenes.set(chapter as AdventureChapter,scene);
    }
    for(const [id,scene] of this.scenes)scene.root.visible=id===chapter;
    this.world.setLegacyVisible(chapter===1);this.current=chapter===1?null:this.scenes.get(chapter as AdventureChapter)!;
    this.initialized=false;this.world.character.scale.setScalar(1);this.heading=chapter===1?0:Math.PI/2;this.world.character.rotation.y=this.heading;
    if(chapter===1){this.world.director.reset();this.world.water.uniforms.viewRay.value.copy(VIEW_RAY);this.world.water.uniforms.gate.value.copy(this.legacyGate);}
    else this.world.water.uniforms.gate.value.set(this.current!.exit.position.x,this.current!.exit.position.z);
    if(engine)this.previousActor.copy(engine.point(engine.actor.s,engine.actor.y));
  }
  prepare(dt:number,c:Campaign) {
    if(c.chapter===1)return;
    const w=this.world,r=c.engine!,camera=w.camera;
    const aspect=w.width/w.height,v=aspect<1.1?21:15.5;
    camera.left=-v*aspect;camera.right=v*aspect;camera.top=v;camera.bottom=-v;
    const actor=r.point(r.actor.s,r.actor.y),overview=r.point(0,c.chapter===3?6:4);
    let desired=overview.clone(),zoom=c.chapter===3?.78:.84;
    const moving=Math.abs(r.actor.velocity)>.1;
    if(moving){desired.lerp(actor,.5);zoom=1.07;}
    if(r.phase==="sealing"||r.phase==="lifting") {desired=actor.clone().add(new T.Vector3(2,1,0));zoom=w.director.reduced?1.02:1.25;}
    const orbit=r.phase==="orbit"?Math.sin(Math.min(1,r.orbitTime/4)*Math.PI)*(w.director.reduced?0:.62):0;
    if(r.phase==="assembling"||r.phase==="orbit"){desired=r.point(4,6);zoom=.88;}
    if(c.state==="entering"){desired.lerp(actor,.6*c.mask);zoom+=c.mask*.45;}
    if(c.state==="leaving"){desired=actor.clone().add(new T.Vector3(1,1,0));zoom=1.2+c.mask*.45;}
    const angle=(c.chapter===3&&r.view===0?-.28:0)+orbit;
    const ray=VIEW_RAY.clone().applyAxisAngle(T.Object3D.DEFAULT_UP,angle);
    const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),ray).normalize();
    desired.addScaledVector(right,-v*aspect*.16/zoom);
    desired.addScaledVector(ray.clone().cross(right).normalize(),-v*.22/zoom);
    if(!this.initialized){this.target.copy(desired);this.sharedDirection.copy(ray);camera.zoom=zoom;this.initialized=true;}
    this.target.lerp(desired,1-Math.exp(-dt*5));this.sharedDirection.lerp(ray,1-Math.exp(-dt*7)).normalize();
    camera.position.copy(this.target).addScaledVector(this.sharedDirection,52);camera.lookAt(this.target);
    camera.zoom=T.MathUtils.damp(camera.zoom,zoom,6,dt);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    r.measureProjection(camera);
    r.cameraSettled=this.target.distanceTo(desired)<.12&&this.sharedDirection.distanceTo(ray)<.008&&Math.abs(camera.zoom-zoom)<.025;
    w.water.uniforms.viewRay.value.copy(this.sharedDirection);
  }
  present(dt:number,c:Campaign,time:number) {
    const w=this.world;
    if(c.chapter===1) {
      const distance=w.character.position.distanceTo(this.previousActor);
      const speed=Math.min(1.8,distance/Math.max(dt,.001));
      this.animation.update(dt,speed>.04?"Walk":"Idle",speed,0,Math.min(distance,.12));
      this.previousActor.copy(w.character.position);return;
    }
    const r=c.engine!,actor=r.actor;
    this.current!.update(r,time);
    w.water.uniforms.permission.value=r.bridgeLocked||r.finalRoad?1:0;
    const forming=r.phase==="sealing"||r.phase==="assembling";
    w.crystals.visible=forming;
    if(forming){
      const from=r.stage===0?-11:r.chapter===2&&r.stage===1?-3.5:r.chapter===2?8.5:1.2;
      const to=r.stage===0?(r.chapter===2?-5.6:-6):r.chapter===2&&r.stage===1?2.6:r.chapter===2?12.8:12;
      const h=r.stage===2?(r.chapter===2?4.2:5.2):r.definition.baseHeight;
      const growth=Math.min(1,r.phaseTime/(r.phase==="assembling"?2.4:.75));
      for(let i=0;i<64;i++){
        const t=(i%32)/31,dummy=this.crystalDummy;
        dummy.position.copy(r.point(from+(to-from)*t,h+.03,i%2?.57:-.57));
        dummy.rotation.set(i*.7,i*.3,i*.4);
        const scale=Math.max(.001,Math.min(1,(growth-t)*8));dummy.scale.set(scale*.7,scale*(1+i%3),scale*.7);dummy.updateMatrix();w.crystals.setMatrixAt(i,dummy.matrix);
      }
      w.crystals.instanceMatrix.needsUpdate=true;
    }
    w.character.position.copy(r.point(actor.s,actor.y,actor.lane));w.character.scale.setScalar(1);
    if(actor.velocity>.08)this.heading=Math.PI/2;else if(actor.velocity<-.08)this.heading=-Math.PI/2;
    const delta=T.MathUtils.euclideanModulo(this.heading-w.character.rotation.y+Math.PI,Math.PI*2)-Math.PI;
    w.character.rotation.y+=delta*(1-Math.exp(-dt*12));
    const distance=Math.abs(actor.velocity)*dt;
    this.animation.update(dt,actor.state,actor.velocity,actor.verticalVelocity,distance);
    if(c.state==="complete")w.character.scale.setScalar(Math.max(.02,1-Math.max(0,c.endTime-1)/2));
  }
  snapshot(){return {cachedScenes:this.scenes.size,visibleScenes:[...this.scenes].filter(([,s])=>s.root.visible).map(([id])=>id),cameraDirection:this.sharedDirection.toArray(),cameraZoom:this.world.camera.zoom,cameraTarget:this.target.toArray(),actorPosition:this.world.character.position.toArray()};}
}
