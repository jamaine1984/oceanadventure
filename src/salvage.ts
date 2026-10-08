import type {FieldEquipment} from './field-equipment';
import type {RovEquipment} from './research-rov';
export type MaterialKey='alloy'|'copper'|'cell';
export const MATERIALS={alloy:'Marine alloy',copper:'Insulated copper',cell:'Pressure cartridges'} as const;
export const FIELD_POSTS=[
  {id:'bay',name:'Bluewater service mooring',x:70,z:-86,requires:'bay-signal'},
  {id:'lagoon',name:'Seagrass service mooring',x:-175,z:-88,requires:'bay-signal'},
  {id:'passage',name:'Limestone service mooring',x:200,z:-88,requires:'lagoon-echo'},
  {id:'reach',name:'Wreckward service mooring',x:-273,z:-145,requires:'array-repair'},
  {id:'pelagic',name:'Observatory service mooring',x:202,z:-170,requires:'reach-archive'},
] as const;
export const SALVAGE_CACHES=FIELD_POSTS.flatMap(post=>([
  {material:'alloy' as const,amount:4,dx:-7,dz:-5},
  {material:'copper' as const,amount:3,dx:7,dz:-5},
  {material:'cell' as const,amount:2,dx:0,dz:7},
]).map(item=>({...item,id:`salvage-${post.id}-${item.material}`,name:`${MATERIALS[item.material]} / ${post.id}`,post:post.id,requires:post.requires,x:post.x+item.dx,z:post.z+item.dz})));
export type SalvageState={version:1;stock:Record<MaterialKey,number>;recovered:string[];capacitor:boolean;pod:{built:boolean;site:string|null;air:number;energy:number}};
export type SalvageProgress={saveVersion?:number;credits:number;voyage:{completed:string[];blueprints:string[]};salvage?:SalvageState;fieldEquipment?:FieldEquipment;rov?:RovEquipment};
export type FieldPose={x:number;y:number;z:number};
export function newSalvage():SalvageState{return{version:1,stock:{alloy:0,copper:0,cell:0},recovered:[],capacitor:false,pod:{built:false,site:null,air:0,energy:0}};}
export function salvageUsed(s:SalvageState){return s.recovered.length>0||s.capacitor||s.pod.built||Object.values(s.stock).some(n=>n>0);}
export function sanitizeSalvage(value:unknown):SalvageState{
  if(value===undefined)return newSalvage();
  const p=value as SalvageState,object=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v),whole=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=999;
  if(!object(p)||p.version!==1||!object(p.stock)||!Object.keys(MATERIALS).every(k=>whole(p.stock[k]))||!Array.isArray(p.recovered)||!p.recovered.every(id=>typeof id==='string'&&SALVAGE_CACHES.some(c=>c.id===id))||new Set(p.recovered).size!==p.recovered.length||typeof p.capacitor!=='boolean'||!object(p.pod)||typeof p.pod.built!=='boolean'||!whole(p.pod.air)||p.pod.air>400||!whole(p.pod.energy)||p.pod.energy>300||!(p.pod.site===null||FIELD_POSTS.some(s=>s.id===p.pod.site))||(!p.pod.built&&(p.pod.site!==null||p.pod.air!==0||p.pod.energy!==0)))throw Error('The salvage and outpost record is incomplete.');
  for(const key of Object.keys(MATERIALS)as MaterialKey[]){const earned=SALVAGE_CACHES.filter(c=>c.material===key&&p.recovered.includes(c.id)).reduce((n,c)=>n+c.amount,0),spent=(p.pod.built?RECIPES.pod[key]:0)+(p.capacitor?RECIPES.capacitor[key]:0);if(p.stock[key]!==earned-spent)throw Error('The material ledger does not match its recovery receipts.');}
  return structuredClone(p);
}
function upgraded<P extends SalvageProgress>(p:P):P{const next=structuredClone(p);next.saveVersion=Math.max(4,p.saveVersion??2);next.salvage=sanitizeSalvage(p.salvage);next.rov??={version:1,owned:false,battery:100};return next;}
export function cacheAvailable(p:SalvageProgress,id:string){const c=SALVAGE_CACHES.find(c=>c.id===id);return !!c&&p.voyage.completed.includes(c.requires)&&!(p.salvage?.recovered??[]).includes(id);}
export function salvageReady(p:SalvageProgress,id:string,position:FieldPose,floor:number,speed:number){
  const c=SALVAGE_CACHES.find(c=>c.id===id);return !!c&&cacheAvailable(p,id)&&Number.isFinite(speed)&&Math.abs(speed)<=.2&&position.y>=floor+1.2&&position.y<=floor+4.5&&Math.hypot(position.x-c.x,position.y-floor-.7,position.z-c.z)<=3.5;
}
export function recoverSalvage<P extends SalvageProgress>(p:P,id:string,position:FieldPose,floor:number,speed:number):P{
  if(!salvageReady(p,id,position,floor,speed))throw Error('Hold position beside the released supply case.');
  const c=SALVAGE_CACHES.find(c=>c.id===id)!,next=upgraded(p);next.salvage!.recovered.push(id);next.salvage!.stock[c.material]+=c.amount;return next;
}
export type MaterialRecipe='pod'|'capacitor'|'refill';
export const RECIPES={pod:{name:'Calypso Survey Anchor',cost:250,alloy:3,copper:2,cell:1},capacitor:{name:'Manta capacitor retrofit',cost:250,alloy:2,copper:1,cell:1},refill:{name:'Pod reservoir resupply',cost:125,alloy:0,copper:0,cell:0}} as const;
export function fabricateMaterials<P extends SalvageProgress>(p:P,recipe:MaterialRecipe):P{
  const s=sanitizeSalvage(p.salvage),r=RECIPES[recipe];if(!r)throw Error('Unknown fabrication recipe.');
  if(recipe==='pod'&&(s.pod.built||!p.voyage.completed.includes('bay-signal')||!p.voyage.blueprints.includes('survey-anchor')))throw Error(s.pod.built?'The survey anchor is already built.':'Archive The Lost Signal to unlock the survey anchor.');
  if(recipe==='capacitor'&&(s.capacitor||!p.fieldEquipment?.scooter||!p.voyage.completed.includes('lagoon-echo')))throw Error(s.capacitor?'The capacitor is already fitted.':'Fabricate Manta after archiving Echoes in the Seagrass.');
  if(recipe==='refill'&&(!s.pod.built||s.pod.site!==null||s.pod.air===400&&s.pod.energy===300))throw Error('Pack a depleted survey anchor before harbor resupply.');
  if(!Number.isFinite(p.credits)||p.credits<r.cost)throw Error('Not enough credits for fabrication.');
  for(const k of Object.keys(MATERIALS)as MaterialKey[])if(s.stock[k]<r[k])throw Error(`Recover more ${MATERIALS[k].toLowerCase()}.`);
  const next=upgraded(p);next.credits-=r.cost;for(const k of Object.keys(MATERIALS)as MaterialKey[])next.salvage!.stock[k]-=r[k];
  if(recipe==='capacitor')next.salvage!.capacitor=true;else next.salvage!.pod={...next.salvage!.pod,built:true,air:400,energy:300};return next;
}
export function podAnchorage(p:SalvageProgress,position:FieldPose,speed:number){
  if(!p.salvage?.pod.built||!Number.isFinite(speed)||Math.abs(speed)>.5)return;
  return FIELD_POSTS.find(s=>p.voyage.completed.includes(s.requires)&&Math.hypot(position.x-s.x,position.z-s.z)<=14&&position.y>-2);
}
export function deployPod<P extends SalvageProgress>(p:P,site:string,position:FieldPose,speed:number):P{
  if(p.salvage?.pod.site!==null||podAnchorage(p,position,speed)?.id!==site)throw Error('Stop at an unlocked service mooring with the packed survey anchor.');
  const next=upgraded(p);next.salvage!.pod.site=site;return next;
}
export function packPod<P extends SalvageProgress>(p:P,position:FieldPose,speed:number):P{
  if(!p.salvage?.pod.site||podAnchorage(p,position,speed)?.id!==p.salvage.pod.site)throw Error('Stop the vessel beside the deployed survey anchor.');
  const next=upgraded(p);next.salvage!.pod.site=null;return next;
}
export function podServiceReady(p:SalvageProgress,position:FieldPose,floor:number,speed:number){
  const site=FIELD_POSTS.find(s=>s.id===p.salvage?.pod.site);return !!site&&Number.isFinite(speed)&&Math.abs(speed)<=.2&&position.y<floor+5&&position.y>=floor+1.2&&Math.hypot(position.x-site.x,position.y-floor-2.8,position.z-site.z-3)<=2;
}
export function podApproach(p:SalvageProgress,position:FieldPose,floor:number){
  const s=FIELD_POSTS.find(s=>s.id===p.salvage?.pod.site);if(!s)return;
  const x=Math.abs(position.x-s.x),z=position.z-s.z,h=position.y-floor;
  if(x<=1.3&&z>=2&&z<=5.3&&h>=2.4&&h<=3.4)return{x:s.x,y:floor+2.8,z:s.z+3};
  if(x<=1.3&&z>=3.7&&z<=5.3)return{x:s.x,y:floor+2.8,z:s.z+4.5,via:true};
  if(h<4)return{x:position.x,y:floor+4.6,z:position.z,via:true};
  return{x:s.x,y:floor+4.6,z:s.z+4.5,via:true};
}
export function servicePod<P extends SalvageProgress>(p:P,position:FieldPose,floor:number,speed:number,mode:'swim'|'rov',oxygen:number){
  if(mode!=='swim'&&mode!=='rov')throw Error('Field service requires a diver or deployed ROV.');
  if(!podServiceReady(p,position,floor,speed)||!Number.isFinite(oxygen)||oxygen<0||oxygen>100)throw Error('Hold position at the pod service connectors.');
  const next=upgraded(p),pod=next.salvage!.pod;let air=oxygen,used=0;
  if(mode==='swim'){
    const transfer=Math.min(pod.air,Math.ceil(100-oxygen));air=Math.min(100,oxygen+transfer);pod.air-=transfer;used+=transfer;
    if(next.fieldEquipment?.scooter){const energy=Math.min(pod.energy,Math.ceil(100-next.fieldEquipment.charge));next.fieldEquipment.charge=Math.min(100,next.fieldEquipment.charge+energy);pod.energy-=energy;used+=energy;}
  }else if(next.rov?.owned){const energy=Math.min(pod.energy,Math.ceil(100-next.rov.battery));next.rov.battery=Math.min(100,next.rov.battery+energy);pod.energy-=energy;used+=energy;}
  if(!used)throw Error('Equipment is full or the required pod reservoir is empty.');return{progress:next,oxygen:air};
}
