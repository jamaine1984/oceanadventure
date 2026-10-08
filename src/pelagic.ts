import type {ExpeditionRecord} from './expedition-state';
export const PELAGIC_SITE={x:225,z:-190} as const;
export const PELAGIC_PORTS=[
  {id:'clock',name:'Chronometer',x:0,z:3.8,deviceX:0,deviceZ:2.28},
  {id:'habitat',name:'Habitat archive',x:-2.6,z:0,deviceX:-4.22,deviceZ:0},
  {id:'archive',name:'Crew deployment log',x:2.6,z:-2.2,deviceX:4.22,deviceZ:-2.2},
] as const;
export function orderedPelagicRecords(value:unknown){const a=Array.isArray(value)?value:[],r:number[]=[];for(let i=0;i<3&&a.includes(i);i++)r.push(i);return r;}
export function pelagicTarget(record:ExpeditionRecord,floor:number){
  if(record.route!=='pelagic'||record.stage!=='remote'||record.sold)return;
  const index=orderedPelagicRecords(record.observatoryRecords).length,p=PELAGIC_PORTS[index];
  return p?{...p,index,x:PELAGIC_SITE.x+p.x,y:floor+3,z:PELAGIC_SITE.z+p.z,deviceX:PELAGIC_SITE.x+p.deviceX,deviceY:floor+2.85,deviceZ:PELAGIC_SITE.z+p.deviceZ}:undefined;
}
export function pelagicReady(record:ExpeditionRecord,floor:number,position:{x:number;y:number;z:number},look:{x:number;y:number;z:number},speed:number){
  const target=pelagicTarget(record,floor);if(!target||!Number.isFinite(speed)||Math.abs(speed)>.2)return false;
  const x=position.x-PELAGIC_SITE.x,z=position.z-PELAGIC_SITE.z;
  if(Math.hypot(x,z)>4.8||position.y<floor+2.3||position.y>floor+3.7||Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z)>1.2)return false;
  const dx=target.deviceX-position.x,dy=target.deviceY-position.y,dz=target.deviceZ-position.z,d=Math.hypot(dx,dy,dz),l=Math.hypot(look.x,look.y,look.z);
  return Number.isFinite(d)&&Number.isFinite(l)&&d>.01&&l>.01&&(dx*look.x+dy*look.y+dz*look.z)/(d*l)>.88;
}
export function recordPelagicPort(record:ExpeditionRecord,floor:number,position:{x:number;y:number;z:number},look:{x:number;y:number;z:number},speed:number){
  if(!pelagicReady(record,floor,position,look,speed))throw Error('Hold the ROV in view of the current terminal.');
  const next=structuredClone(record);next.observatoryRecords=orderedPelagicRecords(record.observatoryRecords);next.observatoryRecords.push(next.observatoryRecords.length);if(next.observatoryRecords.length===3)next.stage='return';return next;
}
export function pelagicApproach(record:ExpeditionRecord,floor:number,position:{x:number;y:number;z:number}){
  const target=pelagicTarget(record,floor);if(!target)return;
  const x=position.x-PELAGIC_SITE.x,z=position.z-PELAGIC_SITE.z;
  if(Math.hypot(x,z)<4.8)return target;
  if(z<4.8&&position.y<floor+9){const side=x<0?-12:12;return{x:PELAGIC_SITE.x+side,y:position.y,z:Math.abs(x)<10?position.z:PELAGIC_SITE.z+12};}
  if(z<4.8||Math.abs(x)>1.4)return{x:PELAGIC_SITE.x,y:position.y,z:PELAGIC_SITE.z+12};
  if(position.y>floor+3.6||position.y<floor+2.4||z>9.7)return{x:PELAGIC_SITE.x,y:floor+3,z:PELAGIC_SITE.z+9};
  return target;
}
