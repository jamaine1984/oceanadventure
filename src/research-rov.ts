export const RESEARCH_ROV={name:'Sentry Research ROV',cost:900,blueprint:'research-rov',contract:'reach-archive',model:'/models/sentry_research_rov.glb',range:120,radius:1.12,speed:3.2,recharge:1.2} as const;
export type RovEquipment={version:1;owned:boolean;battery:number};
export function newRovEquipment():RovEquipment{return{version:1,owned:false,battery:100};}
export function rovDepthBounds(floor:number,surface:number){
  const min=floor+RESEARCH_ROV.radius,max=surface-RESEARCH_ROV.radius;
  return Number.isFinite(min)&&Number.isFinite(max)&&min<=max?{min,max}:undefined;
}
export function sanitizeRov(value:unknown,completed:readonly string[]):RovEquipment{
  if(!value||typeof value!=='object'||Array.isArray(value))return newRovEquipment();
  const p=value as Partial<RovEquipment>;
  return{version:1,owned:p.owned===true&&completed.includes(RESEARCH_ROV.contract),battery:typeof p.battery==='number'&&Number.isFinite(p.battery)?Math.max(0,Math.min(100,p.battery)):100};
}
export function fabricateRov<P extends {credits:number;saveVersion?:number;voyage:{completed:string[];blueprints:string[]};rov?:RovEquipment}>(progress:P):P{
  if(progress.rov?.owned)throw Error('The research ROV is already fabricated.');
  if(!progress.voyage.completed.includes(RESEARCH_ROV.contract)||!progress.voyage.blueprints.includes(RESEARCH_ROV.blueprint))throw Error('Archive The Freighter Archive at harbor to unlock this blueprint.');
  if(!Number.isFinite(progress.credits)||progress.credits<RESEARCH_ROV.cost)throw Error('Not enough credits to fabricate the research ROV.');
  const next=structuredClone(progress);next.credits-=RESEARCH_ROV.cost;next.saveVersion=Math.max(3,progress.saveVersion??2);next.rov={version:1,owned:true,battery:100};return next;
}
export function rovBatteryStep(battery:number,delta:number,state:{owned:boolean;active:boolean;aboard:boolean;moving:boolean;lights:boolean}){
  const dt=Number.isFinite(delta)?Math.max(0,Math.min(.1,delta)):0;
  const charge=Number.isFinite(battery)?Math.max(0,Math.min(100,battery)):0;
  const rate=!state.owned?0:state.active?-(.10+(state.moving?.28:0)+(state.lights?.08:0)):state.aboard?RESEARCH_ROV.recharge:0;
  return Math.max(0,Math.min(100,charge+rate*dt));
}
export function constrainRovTether(position:{x:number;y:number;z:number},anchor:{x:number;y:number;z:number},range:number=RESEARCH_ROV.range){
  const x=position.x-anchor.x,y=position.y-anchor.y,z=position.z-anchor.z,distance=Math.hypot(x,y,z);
  if(!Number.isFinite(distance)||!Number.isFinite(range)||range<=0)throw Error('Invalid ROV tether coordinates.');
  const scale=distance>range?range/distance:1;
  return{x:anchor.x+x*scale,y:anchor.y+y*scale,z:anchor.z+z*scale,limited:distance>range};
}
