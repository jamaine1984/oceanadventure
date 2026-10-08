import type { DiveTool, ExpeditionRecord } from './expedition-state';
export const REACH_SITE={x:-300,z:-170} as const;
export const FREIGHTER_STEPS=[
  {id:'entry',name:'Starboard breach',tool:'scanner' as DiveTool,x:2.4,y:2.7,z:4,action:'Log entry'},
  {id:'latch',name:'Recorder latch',tool:'cutter' as DiveTool,x:0,y:2.7,z:0,action:'Release latch'},
  {id:'recorder',name:'Expedition archive',tool:'scanner' as DiveTool,x:0,y:2.7,z:0,action:'Recover archive'},
  {id:'exit',name:'Port escape route',tool:'scanner' as DiveTool,x:-6,y:2.7,z:-4,action:'Log port exit'},
] as const;
export function orderedFreighterSteps(value:unknown){const saved=Array.isArray(value)?value:[],steps:number[]=[];for(let i=0;i<FREIGHTER_STEPS.length&&saved.includes(i);i++)steps.push(i);return steps;}
export function freighterObjective(record:ExpeditionRecord,floor:number){
  if(record.stage!=='interior'||record.route!=='reach')return;
  const index=orderedFreighterSteps(record.interiorSteps).length,step=FREIGHTER_STEPS[index];
  return step?{...step,index,x:step.x+REACH_SITE.x,y:step.y+floor,z:step.z+REACH_SITE.z}:undefined;
}
export function freighterApproach(record:ExpeditionRecord,position:{x:number;y:number;z:number},floor:number){
  if(record.stage!=='interior'||record.route!=='reach'||orderedFreighterSteps(record.interiorSteps).length>=3)return;
  const x=position.x-REACH_SITE.x,z=position.z-REACH_SITE.z,side=x<0?-1:1;
  if(Math.abs(x)<5.3&&(position.y>floor+5.5||Math.abs(z)>18))return{x:REACH_SITE.x+side*6.6,y:position.y,z:position.z};
  if(position.y>floor+3.5||Math.abs(x)>3.8&&Math.abs(z-side*4)>1.1)return{x:REACH_SITE.x+side*6.6,y:floor+2.7,z:REACH_SITE.z+side*4};
}
export function freighterExit(position:{x:number;y:number;z:number},floor:number){
  const x=position.x-REACH_SITE.x,z=position.z-REACH_SITE.z;
  if(Math.abs(x)>15||Math.abs(z)>24||position.y>=floor+7)return;
  if(Math.abs(x)<7.1){const side=x>=0?1:-1;return{x:REACH_SITE.x+side*8,y:floor+2.7,z:REACH_SITE.z+side*4,ascent:false};}
  return{x:position.x,y:floor+7.2,z:position.z,ascent:true};
}
export function recordFreighterStep(record:ExpeditionRecord,tool:DiveTool,position:{x:number;y:number;z:number},floor:number){
  const step=freighterObjective(record,floor);
  if(!step||!freighterStepReady(record,tool,position,floor))throw new Error('Reach the marked freighter position and select its required tool.');
  const next=structuredClone(record);next.interiorSteps=orderedFreighterSteps(record.interiorSteps);next.interiorSteps.push(step.index);
  if(next.interiorSteps.length===FREIGHTER_STEPS.length)next.stage='return';return next;
}
export function freighterStepReady(record:ExpeditionRecord,tool:DiveTool,position:{x:number;y:number;z:number},floor:number){const step=freighterObjective(record,floor);return record.contractId==='reach-archive'&&!record.sold&&!!step&&step.tool===tool&&Math.hypot(position.x-step.x,position.y-step.y,position.z-step.z)<1.8&&(step.index===3?position.x<=REACH_SITE.x-5.3:Math.abs(position.x-REACH_SITE.x)<=3.2&&Math.abs(position.z-REACH_SITE.z)<=6);}
