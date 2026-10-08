import { expeditionPlan, SAMPLE_SITES, type ExpeditionRecord } from './expedition-state';

export type FieldEquipment = { scooter: boolean; charge: number };
export const SCOOTER = { name:'Manta Dive Drive', cost:650, blueprint:'scooter-drive', model:'/models/manta_dive_drive.glb', speed:1.65, boostSpeed:1.5, recharge:1.25 } as const;
export function newFieldEquipment(): FieldEquipment { return { scooter:false, charge:100 }; }
export function sanitizeFieldEquipment(value:unknown, blueprints:readonly string[]): FieldEquipment {
  if(!value||typeof value!=='object'||Array.isArray(value))return newFieldEquipment();
  const saved=value as Partial<FieldEquipment>;
  return {scooter:saved.scooter===true&&blueprints.includes(SCOOTER.blueprint),charge:typeof saved.charge==='number'&&Number.isFinite(saved.charge)?Math.max(0,Math.min(100,saved.charge)):100};
}
export function fabricateScooter<P extends {credits:number;voyage:{blueprints:string[]};fieldEquipment?:FieldEquipment}>(progress:P):P {
  if(progress.fieldEquipment?.scooter)throw new Error('The dive drive is already built.');
  if(!progress.voyage.blueprints.includes(SCOOTER.blueprint))throw new Error('Complete Echoes in the Seagrass to unlock this blueprint.');
  if(progress.credits<SCOOTER.cost)throw new Error('Not enough credits to fabricate the dive drive.');
  const next=structuredClone(progress);next.credits-=SCOOTER.cost;next.fieldEquipment={scooter:true,charge:100};return next;
}
export function scooterStep(equipment:FieldEquipment, delta:number, state:{aboard:boolean;enabled:boolean;forward:number;boost:boolean;depth:number;assisting:boolean;retrofit?:boolean}) {
  const seconds=Number.isFinite(delta)?Math.max(0,Math.min(.1,delta)):0;
  if(!equipment.scooter)return {charge:equipment.charge,powered:false,multiplier:1};
  const powered=!state.aboard&&state.enabled&&equipment.charge>0&&state.forward>.05&&state.depth>.6&&!state.assisting;
  const charge=Math.max(0,Math.min(100,equipment.charge+(state.aboard?SCOOTER.recharge*(state.retrofit?1.5:1):powered?-(state.boost?.75:.42)*(state.retrofit?.75:1):0)*seconds));
  return {charge,powered:powered&&charge>0,multiplier:powered&&charge>0?(state.boost?SCOOTER.boostSpeed:SCOOTER.speed):1};
}

export type SonarContact = { id:string;name:string;x:number;y:number;z:number;distance:number;bearing:number;vertical:number };
export const SONAR_RANGE=65, SONAR_DURATION=6, SONAR_COOLDOWN=7;
export function sonarContacts(record:ExpeditionRecord, position:{x:number;y:number;z:number}):SonarContact[] {
  const plan=expeditionPlan(record),sites:Array<{id:string;name:string;x:number;y:number;z:number}>=[];
  if(record.stage==='reef'&&plan.samplesRequired){
    if(!record.waterSample)sites.push({id:'water',name:'Water sampler',...plan.samples.water});
    if(!record.sedimentSample)sites.push({id:'sediment',name:'Sediment sampler',...plan.samples.sediment});
  }
  if(record.stage==='wreck'&&plan.recoveryRequired){
    if(!record.cableFreed)sites.push({id:'cable',name:'Snagged sensor cable',...SAMPLE_SITES.cable});
    if(!record.sensorRecovered)sites.push({id:'sensor',name:'Research sensor',...SAMPLE_SITES.sensor});
  }
  if(record.stage==='transect'&&plan.recoveryRequired)plan.stations.forEach((station,index)=>{
    if(!record.transectReadings.includes(index))sites.push({id:`station-${index}`,...station});
  });
  return sites.map(site=>{const dx=site.x-position.x,dz=site.z-position.z,vertical=site.y-position.y;return {...site,distance:Math.hypot(dx,vertical,dz),bearing:Math.atan2(dx,-dz),vertical};}).filter(site=>site.distance<=SONAR_RANGE).sort((a,b)=>a.distance-b.distance);
}
