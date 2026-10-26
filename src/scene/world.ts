import * as T from "three";
import { beveledBox } from "./geometry";
import { CinematicCamera } from "./cinematic-camera";
import { buildArchitecture, type Architecture } from "./architecture";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { WorldRules } from "../game/rules";
import { Reflector } from "three/addons/objects/Reflector.js";
import { ACTIVE, CONNECTIONS, NODES, VIEW_RAY, bridgePose, createPuzzleCamera, evaluate, travelPoint, type BridgePose, type Connection, type Configuration } from "../game/puzzle";
import {
  stoneTexture,
  waterVertex,
  waterFragment,
  iceMaterial,
} from "./materials";
export const POINTS = NODES;
export class WinterWorld {
  scene = new T.Scene();
  camera: T.OrthographicCamera;
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  director: CinematicCamera;
  architecture: Architecture;
  bloom: UnrealBloomPass;
  quality: "auto" | "high" = "auto";
  balanced = false;
  private slowFrames = 0;
  private frameCost = 16;
  private lastFrame = 0;
  private reflectionEvery = 4;
  crystals = new T.InstancedMesh(new T.OctahedronGeometry(.055,0),new T.MeshStandardMaterial({color:0xb7edf4,emissive:0x2a5e69,emissiveIntensity:.4,metalness:.15,roughness:.24,transparent:true,opacity:.8,depthWrite:false}),64);
  private crystalDummy = new T.Object3D();
  character = new T.Group();
  body = new T.Group();
  legs: T.Group[] = [];
  arms: T.Group[] = [];
  knees: T.Group[] = [];
  ankles: T.Group[] = [];
  elbows: T.Group[] = [];
  private legacyRoot: T.Group | null = null;
  control = new T.Group();
  poles: T.Group[] = [];
  doorLight: T.PointLight;
  wires: T.Mesh[] = [];
  wireMats: T.MeshStandardMaterial[] = [];
  bridges: { definition: Connection; halves: T.Group[]; ice: T.Mesh[]; marker: T.Mesh; target: T.Mesh; glow: T.MeshStandardMaterial }[] = [];
  blockers: T.Object3D[] = [];
  lanterns: T.MeshStandardMaterial[] = [];
  frameMetrics = { draws: 0, triangles: 0 };
  reflectionFrame = 0;
  geometryCache = new Map<string,T.BufferGeometry>();
  snow: T.Points;
  snowBase: Float32Array;
  snowSpeed: Float32Array;
  water: T.ShaderMaterial;
  field: T.LineLoop;
  time = 0;
  lastAngle = 999;
  width = 0;
  height = 0;
  stone = new T.MeshStandardMaterial({
    color: 0xa1b3bd,
    map: stoneTexture(),
    roughness: 0.92,
    bumpScale: .065,
  });
  detailedStone: T.MeshStandardMaterial;
  carvedStone: T.MeshStandardMaterial;
  snowMat = new T.MeshStandardMaterial({ color: 0xd7e2e4, roughness: 0.86 });
  metal = new T.MeshStandardMaterial({
    color: 0x36464d,
    metalness: 0.65,
    roughness: 0.6,
  });
  warm = new T.MeshStandardMaterial({
    color: 0xe5b46f,
    emissive: 0xe6a54e,
    emissiveIntensity: 1.4,
  });
  constructor(public canvas: HTMLCanvasElement) {
    this.detailedStone=this.stone.clone();
    this.carvedStone=this.detailedStone.clone();
    this.carvedStone.bumpMap=this.stone.map;
    this.detailedStone.roughnessMap=this.stone.map;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new T.Color(0x0b1c28);
    this.scene.fog = new T.FogExp2(0x102633, 0.025);
    this.camera = createPuzzleCamera();
    this.director=new CinematicCamera(this.camera);
    this.director.reset();
    this.scene.add(new T.HemisphereLight(0xb2d9ec, 0x1e323e, 2));
    const moon = new T.DirectionalLight(0xc6dfef, 3.3);
    moon.position.set(-8, 18, 4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, {
      left: -16,
      right: 16,
      top: 16,
      bottom: -16,
      near: 1,
      far: 60,
    });
    moon.shadow.normalBias = 0.035;
    moon.shadow.bias = -0.0002;
    moon.shadow.radius = 4;
    this.scene.add(moon);
    const fill = new T.DirectionalLight(0x658ca5, 1.6);
    fill.position.set(10, 8, -12);
    this.scene.add(fill);
    this.platform(POINTS.A, 2.05, 0);
    this.platform(POINTS.B, 2.25, 1);
    this.platform(POINTS.C, 2.05, 2);
    this.arch(
      POINTS.A.clone().add(new T.Vector3(-0.7, 0, -0.55)),
      1.45,
      2.4,
      0.34,
    );
    this.blockers.push(this.box(0.75, 2.1, 0.6, this.stone, -1.25, 2.35, -0.8));
    this.box(0.84, 0.13, 0.7, this.snowMat, -1.25, 3.45, -0.8);
    this.box(0.05, 0.9, 0.03, this.warm, -1.25, 2.55, -0.48);
    const portal = POINTS.C.clone().add(new T.Vector3(0.1, 0, -0.55));
    this.arch(portal, 1.6, 3, 0.65);
    this.box(0.9, 2.2, 0.12, this.warm, portal.x, 2.42, portal.z + 0.04);
    this.doorLight = new T.PointLight(0xffc77d, 13, 8, 2);
    this.doorLight.position.set(portal.x, 2.5, portal.z + 0.65);
    this.scene.add(this.doorLight);
    [POINTS.A, POINTS.B, POINTS.C].forEach((v, i) =>
      this.pole(
        v
          .clone()
          .add(new T.Vector3(i === 0 ? -0.8 : 0.95, 0, i === 2 ? 0.8 : -0.65)),
        i === 1,
      ),
    );
    this.water = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        viewRay: { value: VIEW_RAY },
        gate: { value: new T.Vector2(portal.x, portal.z) },
        permission: { value: 0 },
      },
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      transparent: true,
      depthWrite: false,
    });
    const mirror = new Reflector(new T.PlaneGeometry(160,160), { color: 0x8ba2ac, textureWidth: 384, textureHeight: 384, clipBias: .003 });
    mirror.name="water-reflection";
    const reflect = mirror.onBeforeRender.bind(mirror);
    mirror.onBeforeRender = (...args) => {
      if(this.reflectionFrame++ % this.reflectionEvery === 0) reflect(...args);
    };
    // Render real submerged masonry through two restrained transparent layers.
    const mirrorMaterial=mirror.material as T.ShaderMaterial;
    mirrorMaterial.transparent=true;mirrorMaterial.depthWrite=false;
    mirrorMaterial.fragmentShader=mirrorMaterial.fragmentShader.replace("gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );","gl_FragColor = vec4( blendOverlay( base.rgb, color ), 0.42 );");
    mirror.renderOrder=1;
    mirror.rotation.x = -Math.PI/2;
    mirror.position.y = -.36;
    this.scene.add(mirror);
    const water = new T.Mesh(
      new T.PlaneGeometry(180, 180, 64, 64),
      this.water,
    );
    water.name="water-surface";
    water.renderOrder=2;
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    this.scene.add(water);
    this.makeLanding(POINTS.L, "西");
    this.makeLanding(POINTS.U, "东");
    this.makeLanding(POINTS.B2, "上");
    for (const definition of CONNECTIONS) this.makeBridge(definition);
    this.makeRuins();
    this.architecture=buildArchitecture(this.scene,{stone:this.detailedStone,snow:this.snowMat,metal:this.metal,warm:this.warm});
    this.blockers.push(...this.architecture.occluders);
    this.crystals.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.crystals.frustumCulled=false;
    this.scene.add(this.crystals);
    this.createCharacter();
    this.scene.add(this.character);
    this.character.position.copy(POINTS.A);
    const n = 2100;
    this.snowBase = new Float32Array(n * 3);
    this.snowSpeed = new Float32Array(n);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.snowBase.set(
        [
          (Math.random() - 0.5) * 52,
          Math.random() * 22,
          -22 + (i % 3) * 15 + Math.random() * 14,
        ],
        i * 3,
      );
      this.snowSpeed[i] = 0.3 + Math.random() * 0.65;
      sizes[i] = [1.1, 2.5, 7][i%3];
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute(
      "position",
      new T.BufferAttribute(this.snowBase.slice(), 3),
    );
    sg.setAttribute("size", new T.BufferAttribute(sizes, 1));
    this.snow = new T.Points(
      sg,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { pixelRatio: { value: this.renderer.getPixelRatio() }, closeup:{value:0} },
        vertexShader: `attribute float size;uniform float pixelRatio;uniform float closeup;varying float alpha;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);alpha=clamp(1.-(-mv.z)/85.,.08,.6)*(size>5.0 ? mix(0.48,0.12,closeup) : 1.0);gl_PointSize=size*pixelRatio;gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.82,.9,.94,alpha*smoothstep(.5,.05,d));}`,
      }),
    );
    this.scene.add(this.snow);
    const ring = Array.from(
      { length: 96 },
      (_, i) =>
        new T.Vector3(
          Math.cos((i / 96) * Math.PI * 2) * 3.3,
          0.03,
          Math.sin((i / 96) * Math.PI * 2) * 3.3,
        ),
    );
    this.field = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(ring),
      new T.LineBasicMaterial({
        color: 0x8badae,
        transparent: true,
        opacity: 0.1,
      }),
    );
    this.field.position.copy(POINTS.B);
    this.scene.add(this.field);
    const farMat = new T.MeshStandardMaterial({
      color: 0x15303d,
      roughness: 1,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    for (let i = 0; i < 18; i++) {
      const x = (i - 9) * 3.1,
        z = -19 - Math.sin(i * 4) * 3,
        h = 0.5 + (Math.sin(i * 17) + 1) * 0.8;
      this.box(1.7, h, 2, farMat, x, h / 2 - 0.6, z);
      if (i % 4 === 0)
        this.box(0.045, 0.5, 0.03, this.warm, x, h * 0.6, z + 1.02);
    }
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.22,.5,1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }
  box(
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.scene,
  ) {
    const key = `${w},${h},${d}`;
    let geometry = this.geometryCache.get(key);
    if (!geometry) {
      geometry = beveledBox(w,h,d,Math.min(.045,w/4,h/4,d/4));
      this.geometryCache.set(key,geometry);
    }
    const m = new T.Mesh(geometry,mat);
    m.position.set(x, y, z);
    m.castShadow = h > .16;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  platform(p: T.Vector3, r: number, index: number) {
    const v = [
      [-1, -0.6],
      [-0.6, -1],
      [0.45, -1],
      [1, -0.5],
      [0.85, 0.6],
      [0.35, 1],
      [-0.9, 0.8],
    ];
    for (let layer = 0; layer < 4; layer++) {
      const s = new T.Shape();
      v.forEach(([x, z], i) => {
        const f = r * (1 - layer * 0.045);
        if (i === 0) s.moveTo(x * f, -z * f);
        else s.lineTo(x * f, -z * f);
      });
      s.closePath();
      const geo = new T.ExtrudeGeometry(s, {
        depth: 0.55,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.07,
        bevelThickness: 0.06,
      });
      geo.rotateX(-Math.PI / 2);
      const mat = this.detailedStone.clone();
      mat.color.multiplyScalar(0.79 + layer * 0.065);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(
        p.x + (layer % 2) * 0.025,
        p.y - 2.16 + layer * 0.51,
        p.z,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      if (layer === 3) {
        const cap = new T.Mesh(geo, this.snowMat);
        cap.scale.set(1.01, 0.1, 1.01);
        cap.position.set(p.x, p.y - 0.02, p.z);
        cap.receiveShadow = true;
        this.scene.add(cap);
      }
    }
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) + Math.abs(j) > 3) continue;
        this.box(
          0.69,
          0.065,
          0.66,
          this.snowMat,
          p.x + i * 0.7,
          p.y + 0.025,
          p.z + j * 0.69,
        );
      }
    this.box(0.55, 2.3, 0.7, this.stone, p.x - r * 0.75, p.y - 1.2, p.z + 0.5);
    this.box(0.45, 1.8, 0.6, this.stone, p.x + r * 0.6, p.y - 1.2, p.z - 0.7);
    // Dry, irregular stone paving remains visible between windblown snow caps.
    const paving = new T.InstancedMesh(beveledBox(.63,.075,.6,.025),this.stone,25);
    let tile = 0;
    const matrix = new T.Matrix4();
    for(let x=-2;x<=2;x++) for(let z=-2;z<=2;z++) {
      matrix.makeTranslation(p.x+x*.66,p.y+.025,p.z+z*.65);
      paving.setMatrixAt(tile++,matrix);
    }
    paving.receiveShadow=true;
    this.scene.add(paving);
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#b8c6c8";
    ctx.font = "38px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(["I", "II", "III"][index], 64, 80);
    const label = new T.Mesh(
      new T.PlaneGeometry(0.6, 0.6),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    label.position.set(p.x, p.y + 0.085, p.z + 0.9);
    label.rotation.x = -Math.PI / 2;
    this.scene.add(label);
    this.box(0.32, 0.035, 0.045, this.warm, p.x + 0.1, p.y + 0.09, p.z + 1.25);
  }
  arch(p: T.Vector3, w: number, h: number, d: number) {
    const s = new T.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2, h - 0.2);
    s.quadraticCurveTo(-w / 2, h, 0, h);
    s.quadraticCurveTo(w / 2, h, w / 2, h - 0.2);
    s.lineTo(w / 2, 0);
    s.lineTo(w * 0.27, 0);
    s.lineTo(w * 0.27, h * 0.72);
    s.quadraticCurveTo(0, h * 0.92, -w * 0.27, h * 0.72);
    s.lineTo(-w * 0.27, 0);
    s.closePath();
    const mesh = new T.Mesh(
      new T.ExtrudeGeometry(s, {
        depth: d,
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.06,
        bevelThickness: 0.04,
        steps: 1,
      }),
      this.carvedStone,
    );
    mesh.position.copy(p);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.blockers.push(mesh);
    this.box(
      w + 0.1,
      0.09,
      d + 0.1,
      this.snowMat,
      p.x,
      p.y + h + 0.03,
      p.z + d / 2,
    );
  }
  pole(p: T.Vector3, central: boolean) {
    const g = new T.Group();
    g.position.copy(p);
    this.scene.add(g);
    this.poles.push(g);
    this.box(0.42, 0.24, 0.42, this.stone, 0, 0.12, 0, g);
    const shaft = new T.Mesh(
      new T.CylinderGeometry(0.065, 0.1, 4.65, 12),
      this.metal,
    );
    shaft.position.y = 2.4;
    shaft.castShadow = true;
    g.add(shaft);
    const head = new T.Group();
    head.position.y = 4.25;
    g.add(head);
    this.box(1.3, 0.12, 0.13, this.metal, 0, 0, 0, head);
    for (const x of [-0.51, 0.51]) {
      this.box(0.08, 0.28, 0.08, this.metal, x, 0.16, 0, head);
      for (let j = 0; j < 3; j++) {
        const ins = new T.Mesh(
          new T.CylinderGeometry(0.095, 0.095, 0.06, 12),
          new T.MeshStandardMaterial({ color: 0xc9d7d5, roughness: 0.3 }),
        );
        ins.position.set(x, 0.25 + j * 0.07, 0);
        head.add(ins);
      }
    }
    this.box(1.35, 0.045, 0.17, this.snowMat, 0, 0.09, 0, head);
    if (central) {
      this.control = head;
      const node = new T.Mesh(
        new T.TorusGeometry(0.24, 0.035, 8, 40),
        this.warm,
      );
      node.position.set(0, -2.7, 0.12);
      g.add(node);
      const light = new T.PointLight(0xf9bf71, 3, 4);
      light.position.set(0, 1.6, 0.3);
      g.add(light);
    }
    const lampMat = this.warm.clone();
    this.lanterns.push(lampMat);
    this.box(.12,.25,.12,lampMat,.3,3.6,.15,g);
    this.box(.18,.04,.18,this.metal,.3,3.75,.15,g);
    g.userData.head = head;
  }
  updateWires() {
    this.control.rotation.y = (this.lastAngle * Math.PI) / 180;
    this.scene.updateMatrixWorld(true);
    for (const w of this.wires) {
      this.scene.remove(w);
      w.geometry.dispose();
    }
    this.wires = [];
    for (let pair = 0; pair < 2; pair++)
      for (const side of [-1, 1]) {
        const a = (this.poles[pair].userData.head as T.Group).localToWorld(
            new T.Vector3(side * 0.51, 0.41, 0),
          ),
          b = (this.poles[pair + 1].userData.head as T.Group).localToWorld(
            new T.Vector3(side * 0.51, 0.41, 0),
          );
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.7;
        const mat = (this.wireMats[pair] ??= new T.MeshStandardMaterial({
          color: 0x243943,
          metalness: 0.65,
          roughness: 0.5,
          emissive: 0x9b7346,
          emissiveIntensity: 0.03,
        }));
        const w = new T.Mesh(
          new T.TubeGeometry(
            new T.QuadraticBezierCurve3(a, mid, b),
            32,
            0.018,
            5,
            false,
          ),
          mat,
        );
        this.scene.add(w);
        this.wires.push(w);
      }
  }
  makeLanding(p: T.Vector3, label: string) {
    this.box(1.28,.3,1.25,this.stone,p.x,p.y-.15,p.z);
    this.box(1.3,.055,1.27,this.snowMat,p.x,p.y-.005,p.z);
    this.box(.45,p.y+.35,.48,this.stone,p.x,p.y/2-.35,p.z);
    this.box(.08,.18,.08,this.warm,p.x+.48,p.y+.08,p.z+.45);
    // A fixed safe slab: every rotating half is hinged at, not under, the feet.
    const ring = new T.Mesh(new T.TorusGeometry(.34,.012,4,32),this.warm);
    ring.rotation.x=-Math.PI/2; ring.position.copy(p).y+=.04;
    ring.userData.label=label;
    this.scene.add(ring);
  }
  makeBridge(definition: Connection) {
    const exact = {axis:0,stairs:0,crown:0,...definition.controls};
    const pose = bridgePose(definition,exact);
    const halves: T.Group[] = [], ice: T.Mesh[] = [];
    for (const [index,half] of [pose.left,pose.right].entries()) {
      const group = new T.Group();
      group.position.copy(half.anchor);
      this.scene.add(group); halves.push(group);
      const points = half.bend ? [half.anchor,half.bend,half.tip] : [half.anchor,half.tip];
      const segments = points.slice(1).map((b,i)=>[points[i],b]);
      for (const [a,b] of segments) {
        const length = Math.hypot(b.x-a.x,b.z-a.z);
        const count = Math.max(3,Math.ceil(length/.28));
        const stone = new T.InstancedMesh(beveledBox(.83,.25,Math.max(.17,length/count+.025),.025),this.stone,count);
        const snow = new T.InstancedMesh(new T.BoxGeometry(.85,.035,Math.max(.18,length/count)),this.snowMat,count);
        const dummy = new T.Object3D();
        for(let i=0;i<count;i++) {
          const point=a.clone().lerp(b,(i+.5)/count).sub(half.anchor);
          dummy.position.copy(point); dummy.position.y-=.13;
          dummy.rotation.y=Math.atan2(b.x-a.x,b.z-a.z); dummy.updateMatrix(); stone.setMatrixAt(i,dummy.matrix);
          dummy.position.y+=.14; dummy.updateMatrix(); snow.setMatrixAt(i,dummy.matrix);
        }
        stone.castShadow=true; stone.receiveShadow=true; snow.receiveShadow=true;
        group.add(stone,snow);
      }
      // Each permission grows along its own stone stair: no invisible V1 ice shortcut.
      const delta=half.tip.clone().sub(half.anchor);
      const length=delta.length();
      const ribbon = new T.Mesh(new T.PlaneGeometry(.72,length,2,24),iceMaterial());
      ribbon.position.copy(delta).multiplyScalar(.5).y+=.035;
      const forward=delta.clone().normalize(), right=forward.clone().cross(T.Object3D.DEFAULT_UP).normalize();
      ribbon.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,forward,right.clone().cross(forward)));
      (ribbon.material as T.ShaderMaterial).side=T.DoubleSide;
      group.add(ribbon); ice.push(ribbon);
      const fittings:T.BufferGeometry[]=[];
      const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.clone().normalize());
      for(const edge of [-1,1]) {
        const rail=beveledBox(.055,.16,.45,.012);
        rail.translate(edge*.415,-.07,-.16);fittings.push(rail);
        for(const z of [-.31,-.08]) {
          const bolt=new T.CylinderGeometry(.025,.025,.025,6).toNonIndexed();bolt.translate(edge*.405,.023,z);fittings.push(bolt);
        }
      }
      const shoe=beveledBox(.8,.06,.16,.012);shoe.translate(0,-.07,.045);fittings.push(shoe);
      const merged=mergeGeometries(fittings);if(!merged) throw new Error("Bridge hardware geometry could not merge");merged.applyQuaternion(q);merged.translate(delta.x,delta.y,delta.z);
      fittings.forEach(g=>g.dispose());
      const hardware=new T.Mesh(merged,this.metal);hardware.castShadow=true;group.add(hardware);
      if(definition.decoy === "direction" && index===0) group.visible=false;
    }
    const glow=this.warm.clone(); glow.emissiveIntensity=.05;
    const marker=new T.Mesh(new T.TorusGeometry(.24,.018,6,32),glow);
    marker.rotation.x=-Math.PI/2; this.scene.add(marker);
    const target = new T.Mesh(new T.TorusGeometry(.24,.018,6,32),glow);
    target.rotation.x=-Math.PI/2; this.scene.add(target);
    this.bridges.push({definition,halves,ice,marker,target,glow});
  }
  makeRuins() {
    // Designed perimeter fragments frame the playable architecture, never its corridor.
    const columns=[[-9,3.5,7],[-2,2.1,7.5],[6,2.8,6.5],[9,3,-4],[-8,3,-7],[1,2,-11]];
    for(const [x,h,z] of columns) {
      this.box(.65,h,.72,this.stone,x,h/2-.35,z);
      this.box(.72,.08,.78,this.snowMat,x,h-.31,z);
      this.box(.68,.15,.75,this.stone,x,h*.45,z);
    }
    // Central upper court is supported by narrow layered stone rather than a floating cube.
    for(const x of [-.49,.49]) {
      this.box(.23,2.55,.23,this.stone,x,2.55,-.75);
      this.box(.3,.1,.3,this.snowMat,x,3.86,-.75);
    }
    // Branching icicles beneath ledges, batched into a single draw call.
    const icicles=new T.InstancedMesh(new T.ConeGeometry(.035,.38,5),new T.MeshStandardMaterial({color:0x99b9c6,roughness:.28,metalness:.15}),72);
    const dummy=new T.Object3D();
    for(let i=0;i<72;i++) {
      const p=[POINTS.A,POINTS.B,POINTS.C][i%3];
      const a=i*2.39996;
      dummy.position.set(p.x+Math.cos(a)*1.72,p.y-.22,p.z+Math.sin(a)*1.72);
      dummy.rotation.z=Math.PI; dummy.scale.y=.5+(i%5)*.19; dummy.updateMatrix(); icicles.setMatrixAt(i,dummy.matrix);
    }
    this.scene.add(icicles);
  }
  prepareCamera(dt:number,r:WorldRules) {
    this.resize();
    const connection=r.locked?r.walkingConnection:r.next;
    const pose=connection?bridgePose(connection,r.config):null;
    const focus=pose?[pose.left.tip,pose.right.tip,pose.left.anchor.clone().lerp(pose.left.tip,.55),pose.right.anchor.clone().lerp(pose.right.tip,.55)]:[];
    const actor=r.phase==="walking" && connection && pose?travelPoint(connection,pose,r.travel):POINTS[r.platform];
    this.director.update(dt,{phase:r.phase,node:r.platform,proximity:r.proximity,legal:r.alignments.some(a=>a.id===r.next?.id && a.legal),focus,actor,travel:r.travel,endTime:r.endTime},this.width,this.height);
  }
  setQuality(quality:"auto"|"high") {
    this.quality=quality;
    if(quality==="high") this.applyBalanced(false);
  }
  private applyBalanced(balanced:boolean) {
    if(this.balanced===balanced) return;
    this.balanced=balanced;this.bloom.enabled=!balanced;this.renderer.shadowMap.enabled=!balanced;this.reflectionEvery=balanced?8:4;
    this.snow.geometry.setDrawRange(0,balanced?1400:2100);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,balanced?1.1:1.5));
    this.renderer.setSize(this.width,this.height);this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(this.width,this.height);
    (this.snow.material as T.ShaderMaterial).uniforms.pixelRatio.value=this.renderer.getPixelRatio();
  }
  measure(r: WorldRules) {
    this.resize();
    r.measure(evaluate(r.config,r.platform,this.camera,this.width,this.height,this.blockers));
  }
  createCharacter() {
    const coat = new T.MeshStandardMaterial({
        color: 0x23323c,
        roughness: 0.98,
      }),
      boot = new T.MeshStandardMaterial({ color: 0x17212a, roughness: 0.8 }),
      skin = new T.MeshStandardMaterial({ color: 0xd6b5a0, roughness: 0.85 });
    this.character.add(this.body);
    this.body.position.y = 0.4;
    const torso = new T.Mesh(new T.CylinderGeometry(0.14, 0.22, 0.5, 9), coat);
    torso.position.y = 0.16;
    torso.castShadow = true;
    this.body.add(torso);
    this.box(0.24, 0.12, 0.22, coat, 0, 0.45, 0, this.body);
    const face = new T.Mesh(new T.SphereGeometry(0.115, 16, 12), skin);
    face.position.set(0, 0.56, 0.025);
    this.body.add(face);
    const hat = new T.Mesh(
      new T.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      coat,
    );
    hat.position.set(0, 0.6, 0);
    this.body.add(hat);
    this.box(0.27, 0.045, 0.22, coat, 0, 0.62, 0, this.body);
    const scarf = new T.MeshStandardMaterial({ color: 0x9e8062, roughness: 1 });
    this.box(0.27, 0.07, 0.26, scarf, 0, 0.42, 0, this.body);
    this.box(0.075, 0.25, 0.035, scarf, -0.07, 0.29, 0.16, this.body);
    for (const x of [-0.09, 0.09]) {
      const leg = new T.Group();
      leg.position.set(x, -0.04, 0);
      this.body.add(leg);
      this.box(0.11, 0.15, 0.13, coat, 0, -0.075, 0, leg);
      const knee=new T.Group();knee.position.y=-.15;leg.add(knee);this.knees.push(knee);
      this.box(0.11,0.14,0.13,coat,0,-.065,0,knee);
      const ankle=new T.Group();ankle.position.y=-.15;knee.add(ankle);this.ankles.push(ankle);
      this.box(0.12, 0.09, 0.22, boot, 0, 0, 0.035, ankle);
      this.legs.push(leg);
    }
    for (const x of [-0.23, 0.23]) {
      const arm = new T.Group();
      arm.position.set(x, 0.31, 0);
      this.body.add(arm);
      this.box(0.11, 0.17, 0.13, coat, 0, -0.05, 0, arm);
      const elbow=new T.Group();elbow.position.y=-.14;arm.add(elbow);this.elbows.push(elbow);
      this.box(0.11,0.16,0.13,coat,0,-.075,0,elbow);
      this.box(0.09, 0.09, 0.1, boot, 0, -0.16, 0, elbow);
      arm.rotation.z = x > 0 ? 0.12 : -0.12;
      this.arms.push(arm);
    }
    for (let i = 0; i < 3; i++)
      this.box(
        0.025,
        0.025,
        0.015,
        this.metal,
        0.03,
        0.26 - i * 0.09,
        0.178,
        this.body,
      );
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const v = w / h < 1.1 ? 16 : 11.4;
    const shift = w / h > 1.1 ? 3.3 : 0;
    this.camera.left = (-v * w) / h - shift;
    this.camera.right = (v * w) / h - shift;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
  }
  setLegacyVisible(visible:boolean) {
    if(!this.legacyRoot) {
      this.legacyRoot=new T.Group();this.legacyRoot.name="v22-retained-architecture";
      const keep=(o:T.Object3D)=>o===this.character||o===this.snow||o===this.crystals||o instanceof T.HemisphereLight||o instanceof T.DirectionalLight||o.name==="water-reflection"||o.name==="water-surface";
      for(const child of [...this.scene.children])if(!keep(child))this.legacyRoot.add(child);
      this.scene.add(this.legacyRoot);
    }
    this.legacyRoot.visible=visible;
  }
  update(dt: number, r: WorldRules, started: boolean, presentation?:()=>void) {
    this.time += dt;
    const now=performance.now();
    if(this.lastFrame) this.frameCost=T.MathUtils.lerp(this.frameCost,Math.min(300,now-this.lastFrame),.08);
    this.lastFrame=now;
    if(this.quality==="auto" && !this.balanced && this.frameCost>45) {
      if(++this.slowFrames>=45) this.applyBalanced(true);
    }
    this.resize();
    this.water.uniforms.time.value = this.time;
    const permission=Math.max(0,...Object.values(r.growth));
    this.water.uniforms.permission.value = permission;
    if(Math.abs(r.config.axis-this.lastAngle)>.12 || this.lastAngle===999) {
      this.lastAngle=r.config.axis; this.updateWires();
    }
    const seal=r.phase==="connecting"?T.MathUtils.smoothstep(r.connectionTime,.2,.7):r.phase==="walking"?1:0;
    for(const gear of this.architecture.gears) gear.object.rotation.z=T.MathUtils.degToRad(r.config[gear.mechanism])*gear.ratio;
    for(const bridge of this.bridges) {
      const pose=bridgePose(bridge.definition,r.config);
      bridge.halves[0].rotation.y=pose.left.rotation;
      bridge.halves[1].rotation.y=pose.right.rotation;
      const growth=r.growth[bridge.definition.id];
      for(const mesh of bridge.ice) {
        (mesh.material as T.ShaderMaterial).uniforms.growth.value=growth;
        (mesh.material as T.ShaderMaterial).uniforms.seal.value=r.walkingConnection?.id===bridge.definition.id?seal:0;
        mesh.visible=growth>.001;
      }
      bridge.marker.position.copy(pose.left.tip).y+=.04;
      bridge.target.position.copy(pose.right.tip).y+=.04;
      const alignment=r.alignments.find(a=>a.id===bridge.definition.id);
      bridge.glow.emissiveIntensity=.08+(alignment?.proximity??0)*.5+growth*(1.1+seal*1.2);
      bridge.target.visible=bridge.definition.from===r.platform || growth>.01;
      bridge.marker.visible=bridge.target.visible && bridge.definition.decoy!=="direction";
      // Keep topological feedback on the same actual bridge geometry.
    }
    this.wireMats.forEach((mat)=>mat.emissiveIntensity=.04+permission*.7+r.proximity*.25);
    this.lanterns.forEach((mat,i)=>mat.emissiveIntensity=.8+permission*(i+1)*.4);
    const pos = POINTS[r.platform].clone();
    if (r.phase === "walking") {
      const connection=r.walkingConnection!;
      const pose=bridgePose(connection,r.config), t=r.travel;
      pos.copy(travelPoint(connection,pose,t));
      const ahead=travelPoint(connection,pose,Math.min(1,t+.008)).sub(pos);
      // During the depth transfer keep the screen-facing walk direction stable.
      if(t<.44 || t>.56) {
        const turn=T.MathUtils.euclideanModulo(Math.atan2(ahead.x,ahead.z)-this.character.rotation.y+Math.PI,Math.PI*2)-Math.PI;
        this.character.rotation.y+=turn*(1-Math.exp(-dt*12));
      }
      const stride = Math.sin(t * Math.PI * 22),
        taper = Math.min(1, t * 12, (1 - t) * 12);
      this.body.position.y = 0.4 + Math.abs(stride) * 0.025 * taper;
      this.body.rotation.z = stride * 0.025 * taper;
      this.legs.forEach(
        (l, i) => (l.rotation.x = stride * 0.37 * (i === 0 ? 1 : -1) * taper),
      );
      this.arms.forEach(
        (l, i) => (l.rotation.x = stride * 0.23 * (i === 0 ? -1 : 1) * taper),
      );
    } else {
      this.body.position.y = T.MathUtils.damp(this.body.position.y, 0.4, 6, dt);
      this.body.rotation.z *= Math.exp(-dt * 8);
      this.legs.forEach((l) => (l.rotation.x *= Math.exp(-dt * 8)));
      this.arms.forEach((l) => (l.rotation.x *= Math.exp(-dt * 8)));
    }
    if (r.phase === "ending" || r.phase === "complete") {
      pos.lerp(
        POINTS.C.clone().add(new T.Vector3(0.1, 0, -0.5)),
        Math.min(1, r.endTime / 2),
      );
      this.character.rotation.y = Math.PI;
    }
    if(r.phase==="connecting") {
      const p=Math.min(1,r.connectionTime/r.connectionDuration);
      this.body.rotation.x=-Math.sin(p*Math.PI)*.035;
      this.body.position.y=.4-Math.sin(p*Math.PI)*.018;
    } else this.body.rotation.x*=Math.exp(-dt*8);
    this.character.position.copy(pos);
    const end = r.phase === "ending" || r.phase === "complete";
    this.doorLight.intensity = end ? 13 + r.endTime * 7 : 13;
    this.character.scale.setScalar(
      end ? Math.max(0, 1 - (r.endTime - 2) / 2) : 1,
    );
    (this.snow.material as T.ShaderMaterial).uniforms.closeup.value=T.MathUtils.clamp((this.camera.zoom-1)/.46,0,1);
    const crystalConnection=r.walkingConnection && r.growth[r.walkingConnection.id]>.01?r.walkingConnection:r.next;
    this.crystals.visible=!!crystalConnection && (seal>0 || permission>.2);
    if(crystalConnection && this.crystals.visible) {
      const pose=bridgePose(crystalConnection,r.config),dummy=this.crystalDummy;
      for(let i=0;i<64;i++) {
        const half=i<32?pose.left:pose.right,k=i%32;
        const direction=half.anchor.clone().sub(half.tip).normalize(),side=direction.clone().cross(T.Object3D.DEFAULT_UP).normalize();
        const progress=(k%16)/16;
        dummy.position.copy(half.tip).addScaledVector(direction,progress*Math.min(half.tip.distanceTo(half.anchor),1.9)).addScaledVector(side,(k%2?1:-1)*.32);dummy.position.y+=.055;
        dummy.rotation.set(i*.8,i*.3,i*.5);
        const size=Math.max(.001,(seal>0?Math.min(1,Math.max(0,(seal-progress)*8)):permission*.18));
        dummy.scale.set(size*.6,size*(1+(k%3)*.5),size*.6);dummy.updateMatrix();this.crystals.setMatrixAt(i,dummy.matrix);
      }
      this.crystals.instanceMatrix.needsUpdate=true;
    }
    const arr = this.snow.geometry.attributes.position.array as Float32Array,
      field = end ? 0 : T.MathUtils.damp(this.field.userData.strength??0,r.proximity,4,dt);
    this.field.userData.strength=field;
    const snowPose = r.next ? bridgePose(r.next,r.config) : null;
    for (let i = 0; i < this.snowSpeed.length; i++) {
      const j = i * 3,
        s = this.snowSpeed[i];
      arr[j] =
        this.snowBase[j] +
        Math.sin(this.time * 0.24 + i) * 0.6 +
        Math.sin(this.time * 0.02) * 4 * s;
      arr[j + 1] =
        ((((this.snowBase[j + 1] - this.time * s) % 22) + 22) % 22) - 0.4;
      arr[j + 2] = this.snowBase[j + 2] + Math.cos(this.time * 0.21 + i) * 0.35;
      if (i % 16 === 0 && this.wires.length) {
        const path=(this.wires[Math.floor(i/16)%this.wires.length].geometry as T.TubeGeometry).parameters.path;
        const p=path.getPoint((i%71)/71);
        arr[j]=T.MathUtils.lerp(arr[j],p.x,field*.85);
        arr[j+1]=T.MathUtils.lerp(arr[j+1],p.y+.06,field*.85);
        arr[j+2]=T.MathUtils.lerp(arr[j+2],p.z,field*.85);
      } else if (i % 4 === 0 && snowPose) {
        const pose=snowPose;
        const tip=i%8===0?pose.left.tip:pose.right.tip;
        const anchor=i%8===0?pose.left.anchor:pose.right.anchor;
        const k=(i%64)/64;
        arr[j]=T.MathUtils.lerp(arr[j],T.MathUtils.lerp(anchor.x,tip.x,k),field*.92);
        arr[j+1]=T.MathUtils.lerp(arr[j+1],T.MathUtils.lerp(anchor.y,tip.y,k)+.13,field*.92);
        arr[j+2]=T.MathUtils.lerp(arr[j+2],T.MathUtils.lerp(anchor.z,tip.z,k),field*.92);
      }
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
    (this.field.material as T.LineBasicMaterial).opacity = 0.06 + field * 0.12;
    this.field.rotation.y = (r.config.axis * Math.PI) / 180;
    presentation?.();
    this.renderer.info.reset();
    this.composer.render();
    this.frameMetrics={draws:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles};
  }
}
