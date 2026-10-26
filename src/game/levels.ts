/** All route distances are authored in metres, shared by collision and rendering. */
export type AdventureChapter = 2 | 3;
export interface LevelDefinition {
  id: AdventureChapter; title: string; subtitle: string; baseHeight: number;
  checkpoints: number[]; targets: number[]; gap: [number, number]; exit: number;
  challenges: {title:string;copy:string;hint:string;action:string}[];
}
export const LEVELS: Record<AdventureChapter,LevelDefinition> = {
  2:{id:2,title:"断桥迷城",subtitle:"道路会移动，许可也会过期。",baseHeight:1.5,checkpoints:[-13,-4.6,3.6],targets:[30,0,42],gap:[-8.5,-6.8],exit:13.5,challenges:[
    {title:"01 · 借力越隙",copy:"先转动断桥，让两端的暖线相遇。锁定后助跑，在裂隙前起跳。",hint:"中央桥对齐约 +30°。奔跑后，在第一条裂隙前约半步起跳。W/前进，Shift/奔跑，Space/跳跃。",action:"锁定断桥"},
    {title:"02 · 脆弱的许可",copy:"压力板已为冰路供能。凝结后有十四秒；先看清对岸，再出发。",hint:"点击凝结。冰路会从边缘出现裂纹，剩余时间在下方显示；过桥后会自动停在安全台。",action:"凝结限时冰桥"},
    {title:"03 · 巨桥苏醒",copy:"先走上轨道平台，再调整高处机关。平台将载你升起；巨桥锁定后，助跑越过最后一缝。",hint:"走到轨道台中央（暖光圆环），停下。调至 +42°，启动升降；上层缺口同样需要助跑跳跃。",action:"启动轨道升降台"},
  ]},
  3:{id:3,title:"倒悬之境",subtitle:"被看见的连接，也必须承受重量。",baseHeight:2.2,checkpoints:[-13,-4.8,.2],targets:[-25,35,60],gap:[3.1,4.8],exit:12.9,challenges:[
    {title:"01 · 观察的边界",copy:"石阶在深处错开。切换到重合视角，再转动断桥；两端的圆环必须在真实画面中相遇。",hint:"先按 Q / 视角切到「重合」，等待镜头稳定，调到 −25°，再确认。侧观角度不能获得许可。",action:"承认投影通路"},
    {title:"02 · 重量的去向",copy:"踩下的石板将重量传到上方。走上升降台，利用联动机关抵达高层。",hint:"从安全台走上前方升降台并停下；调至 +35° 后启动。抬升会带着人物一起运动。",action:"抬升倒悬庭院"},
    {title:"03 · 最后的秩序",copy:"先释放配重，再转动石环。高度、视角与桥梁缺一不可；最终冰路仍有裂隙。",hint:"站在上层压力板，先调 −45° 释放配重；再调 +60° 并保持重合视角，启动重组。助跑越隙，在冰路消失前走入门。",action:"重组最后的道路"},
  ]},
};
export const MOVEMENT = {walk:1.55,run:3.5,acceleration:11,friction:15,gravity:14,jumpVelocity:6,jumpPreparation:.055,coyote:.22,buffer:.2,radius:.15};
export interface Surface {id:string;from:number;to:number;height:number;width:number;kind:"stone"|"bridge"|"ice"|"lift"|"ray";}
export interface MotionInput {forward:number;side:number;run:boolean;}
export type MotionState="Idle"|"Walk"|"Run"|"JumpPreparation"|"Jump"|"Land"|"Fall";
