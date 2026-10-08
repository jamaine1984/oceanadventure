import { contractById } from './voyage-catalog';
import { ARRAY_SITE } from './array-repair';
import { REACH_SITE, FREIGHTER_STEPS, orderedFreighterSteps } from './wreckward';
import {PELAGIC_SITE,orderedPelagicRecords} from './pelagic';

export const SPECIES = {
  butterflyfish: { name: 'Threadfin butterflyfish', note: 'Pairs shelter beside branching coral.' },
  tang: { name: 'Blue tang', note: 'Grazes on algae along the reef edge.' },
  anthias: { name: 'Reef anthias', note: 'Small schools hover above coral shelves.' },
  turtle: { name: 'Green sea turtle', note: 'A gentle grazer with a patterned shell.' },
  ray: { name: 'Spotted eagle ray', note: 'Cruises over open sand channels.' },
  reefshark: { name: 'Blacktip reef shark', note: 'Patrols the outer reef. Observe from a distance.' },
  hammerhead: { name: 'Scalloped hammerhead', note: 'An occasional visitor to the deeper channel.' },
} as const;
export type SpeciesKey = keyof typeof SPECIES;
export type ExpeditionStage = 'briefing' | 'reef' | 'wreck' | 'transect' | 'repair' | 'interior' | 'remote' | 'return' | 'complete';
export type DiveTool = 'camera' | 'sampler' | 'cutter' | 'scanner';
export type ExpeditionRecord = {
  version: 2 | 3; run: number; route: 'reef' | 'lagoon' | 'passage' | 'reach' | 'pelagic'; stage: ExpeditionStage;
  transectReadings: number[];
  photos: SpeciesKey[]; waterSample: boolean; sedimentSample: boolean;
  cableFreed: boolean; sensorRecovered: boolean; sold: boolean;
  checkpoint: 'harbor' | 'reef' | 'wreck' | 'transect';
  photoImages: Partial<Record<SpeciesKey,string>>;
  saleCredits: number;
  grantState: 'unclaimed' | 'earned' | 'claimed';
  grantCredits: number;
  contractId?: string;
  arrayRestored?: boolean;
  interiorSteps?:number[];
  observatoryRecords?:number[];
};
export const REEF_SITE = { x: 0, z: -86 };
export const WRECK_SITE = { x: 94, z: -168 };
export const SAMPLE_SITES = {
  water: { x: -3, y: -8.0, z: -89 },
  sediment: { x: 9, y: -12.5, z: -98 },
  cable: { x: 83, y: -25.0, z: -161 },
  sensor: { x: 85, y: -25.3, z: -164 },
} as const;
export const LAGOON_SITE = { x: -112, z: -100 };
export const TRANSECT_SITE = { x: -158, z: -160 };
export const LAGOON_SAMPLES = {
  water: { x: -106, y: -6.5, z: -95 },
  sediment: { x: -123, y: -12.0, z: -107 },
} as const;
export const TRANSECT_STATIONS = [
  { x: -148, y: -16, z: -151, name: 'Lagoon edge', reading: 'Seagrass canopy · quiet water' },
  { x: -159, y: -17.5, z: -167, name: 'Sand channel', reading: 'Open channel · passing wildlife' },
  { x: -173, y: -18.8, z: -153, name: 'Outer bank', reading: 'Outer bank · stronger wave noise' },
] as const;
export const GARDEN_SITE = { x: 146, z: -90 };
export const PASSAGE_SITE = { x: 166, z: -140 };
export const PASSAGE_SAMPLES = {
  water: { x: 143, y: -9, z: -89 },
  sediment: { x: 151, y: -14, z: -103 },
} as const;
export const PASSAGE_STATIONS = [
  { x: 166, y: -19, z: -130, name: 'South entrance', reading: 'Limestone entrance · sunlit ledges' },
  { x: 166, y: -19, z: -140, name: 'Arch interior', reading: 'Eroded vault · sheltered passage' },
  { x: 166, y: -19, z: -152, name: 'North exit', reading: 'Outer sand slope · open water' },
] as const;
function baseExpeditionPlan(record: Pick<ExpeditionRecord, 'route'>) {
  if(record.route==='pelagic')return{title:'Pelagic Observatory',habitat:'Pelagic Observatory',site:PELAGIC_SITE,samples:SAMPLE_SITES,photoGoal:0,requiredSpecies:[] as readonly SpeciesKey[],secondSite:PELAGIC_SITE,recoveryTitle:'Observatory terminals',stations:[],readingCredits:0,completionBonus:1150};
  if(record.route==='reach')return{title:'Wreckward Reach',habitat:'Pelagic 05',site:REACH_SITE,samples:SAMPLE_SITES,photoGoal:0,requiredSpecies:[] as readonly SpeciesKey[],secondSite:REACH_SITE,recoveryTitle:'Freighter archive',stations:[],readingCredits:0,completionBonus:1100};
  return record.route === 'passage' ? {
    title: 'Limestone Passage', habitat: 'Coral garden', site: GARDEN_SITE, samples: PASSAGE_SAMPLES,
    photoGoal: 2, requiredSpecies: ['turtle', 'tang'] as readonly SpeciesKey[], secondSite: PASSAGE_SITE,
    recoveryTitle: 'Limestone passage', stations: PASSAGE_STATIONS, readingCredits: 230, completionBonus: 400,
  } : record.route === 'lagoon' ? {
    title: 'Seagrass Watch', habitat: 'Turtle lagoon', site: LAGOON_SITE, samples: LAGOON_SAMPLES,
    photoGoal: 2, requiredSpecies: ['turtle', 'ray'] as readonly SpeciesKey[], secondSite: TRANSECT_SITE,
    recoveryTitle: 'Acoustic transect', stations: TRANSECT_STATIONS, readingCredits: 200, completionBonus: 350,
  } : {
    title: 'Bluewater Research', habitat: 'Reef survey', site: REEF_SITE, samples: SAMPLE_SITES,
    photoGoal: 3, requiredSpecies: [] as readonly SpeciesKey[], secondSite: WRECK_SITE,
    recoveryTitle: 'Wreck recovery', stations: [], readingCredits: 0, completionBonus: 250,
  };
}
export function expeditionPlan(record: Pick<ExpeditionRecord, 'route' | 'contractId'>) {
  const base=baseExpeditionPlan(record),contract=contractById(record.contractId);
  if(!contract||contract.route!==record.route)return {...base,samplesRequired:true,recoveryRequired:true,repairRequired:false,interiorRequired:false,remoteRequired:false};
  return {...base,title:contract.title,photoGoal:contract.photoGoal,requiredSpecies:contract.species as readonly SpeciesKey[],
    stations:contract.readings?base.stations:[],samplesRequired:contract.samples,recoveryRequired:contract.recovery||contract.readings,repairRequired:contract.repair===true,interiorRequired:contract.interior===true,remoteRequired:contract.remote===true,completionBonus:contract.bonus,
    secondSite:contract.repair?ARRAY_SITE:base.secondSite,recoveryTitle:contract.repair?'Array service station':base.recoveryTitle};
}
export function newContractExpedition(id:string,run=1): ExpeditionRecord {
  const contract=contractById(id);if(!contract)throw new Error('Unknown expedition contract.');
  return {...newExpedition(run),route:contract.route,contractId:contract.id,...contract.interior?{interiorSteps:[]}:{} ,...contract.remote?{observatoryRecords:[]}:{} };
}
export function objectiveCount(record: ExpeditionRecord) {
  const plan=expeditionPlan(record);
  return plan.photoGoal+(plan.samplesRequired?2:0)+(plan.recoveryRequired?(plan.stations.length||2):0)+(plan.repairRequired?1:0)+(plan.interiorRequired?FREIGHTER_STEPS.length:0)+(plan.remoteRequired?3:0)+1;
}
export function surveyPhotoCount(record: ExpeditionRecord) {
  const plan = expeditionPlan(record);
  return plan.requiredSpecies.length ? plan.requiredSpecies.filter(key => record.photos.includes(key)).length : Math.min(plan.photoGoal, record.photos.length);
}
export function recoveryComplete(record: ExpeditionRecord) {
  const plan=expeditionPlan(record);if(plan.remoteRequired)return orderedPelagicRecords(record.observatoryRecords).length===3;if(plan.interiorRequired)return orderedFreighterSteps(record.interiorSteps).length===FREIGHTER_STEPS.length;if(plan.repairRequired)return record.arrayRestored===true;if(!plan.recoveryRequired)return true;
  const stations = plan.stations;
  return stations.length ? stations.every((_, index) => record.transectReadings.includes(index)) : record.cableFreed && record.sensorRecovered;
}
export function nearestTransect(record: ExpeditionRecord, position: { x:number; y:number; z:number }) {
  return expeditionPlan(record).stations.map((site, index) => ({ site, index, distance: Math.hypot(position.x-site.x, position.y-site.y, position.z-site.z) }))
    .filter(station => !record.transectReadings.includes(station.index) && (record.route !== 'passage' || station.index === record.transectReadings.length)).sort((a,b) => a.distance-b.distance)[0];
}
export function passageApproach(record: ExpeditionRecord, position: { x:number; y:number; z:number }) {
  if(record.route!=='passage'||record.stage!=='transect'||record.transectReadings.length===0||record.transectReadings.length===3)return;
  if(position.z>-134&&(position.y>-18||Math.abs(position.x-PASSAGE_SITE.x)>2.4))return {x:PASSAGE_SITE.x,y:-19,z:-128};
}
export function passageExit(record: ExpeditionRecord, position: { x:number; y:number; z:number }, vessel: { z:number }, clearance = -12) {
  if(record.route!=='passage'||position.y>=clearance||Math.abs(position.x-PASSAGE_SITE.x)>12)return;
  const north=vessel.z<PASSAGE_SITE.z;
  if(north?position.z>-151&&position.z<-115:position.z<-130&&position.z>-172) {
    return {x:position.x,y:Math.min(-19,position.y),z:north?-153:-128};
  }
  // A boat above the vault needs an outside ascent before the final surface leg.
  if(vessel.z>=-151&&vessel.z<=-130&&(north?position.z<=-151:position.z>=-130)) {
    return {x:position.x,y:clearance+2,z:position.z};
  }
}
export function stableTransectReading(distance: number, speed: number) { return distance < 3.5 && Math.abs(speed) < .55; }
export function nearestSample(record: ExpeditionRecord, position: { x:number; y:number; z:number }) {
  if(!expeditionPlan(record).samplesRequired)return;
  const pending = (['water', 'sediment'] as const).filter(key => key === 'water' ? !record.waterSample : !record.sedimentSample);
  return pending.map(key => {
    const site = expeditionPlan(record).samples[key];
    const distance = Math.hypot(position.x-site.x, position.y-site.y, position.z-site.z);
    return { key, site, distance, inRange: distance < (key === 'water' ? 4 : 3.6) };
  }).sort((a,b) => a.distance-b.distance)[0];
}
export function newExpedition(run = 1): ExpeditionRecord {
  return { version: 3, run, route: run % 3 === 0 ? 'passage' : run % 3 === 2 ? 'lagoon' : 'reef', transectReadings: [], stage: 'briefing', photos: [], waterSample: false, sedimentSample: false, cableFreed: false, sensorRecovered: false, sold: false, checkpoint: 'harbor', photoImages: {}, saleCredits: 0, grantState: 'unclaimed', grantCredits: 0 };
}
export function sanitizeExpedition(value: unknown): ExpeditionRecord {
  const item = value as Partial<ExpeditionRecord> | undefined;
  if (!item || item.version !== 2&&item.version!==3) return newExpedition();
  const stages: ExpeditionStage[] = ['briefing', 'reef', 'wreck', 'transect', 'repair', 'interior', 'remote', 'return', 'complete'];
  const record = newExpedition(Number.isFinite(Number(item.run))?Math.max(1, Math.min(1000000000,Math.floor(Number(item.run)||1))):1);
  // Old saves, including later surveys, keep their original reef contract.
  record.route = item.route === 'lagoon' || item.route === 'passage' || item.route==='reach' || item.route==='pelagic' ? item.route : 'reef';
  const contract=contractById(item.contractId);if(contract?.route===record.route)record.contractId=contract.id;
  if(contract?.repair)record.arrayRestored=item.arrayRestored===true;
  if(contract?.interior)record.interiorSteps=orderedFreighterSteps(item.interiorSteps);
  if(contract?.remote)record.observatoryRecords=orderedPelagicRecords(item.observatoryRecords);
  record.transectReadings = record.route !== 'reef' && Array.isArray(item.transectReadings) ? [...new Set(item.transectReadings.filter(index => Number.isInteger(index) && index >= 0 && index < 3))] : [];
  if (record.route === 'passage') {
    const savedReadings = record.transectReadings;
    record.transectReadings = [];
    for (let index = 0; index < 3 && savedReadings.includes(index); index++) record.transectReadings.push(index);
  }
  record.photos = [...new Set(Array.isArray(item.photos) ? item.photos.filter((key): key is SpeciesKey => typeof key==='string'&&Object.hasOwn(SPECIES,key)) : [])];
  if(record.route!=='reef')record.photos=record.photos.filter(key=>expeditionPlan(record).requiredSpecies.includes(key));
  for(const key of record.photos){const photo=item.photoImages?.[key];if(typeof photo==='string'&&photo.startsWith('data:image/jpeg;base64,')&&photo.length<65000)record.photoImages[key]=photo;}
  for (const key of ['waterSample', 'sedimentSample', 'cableFreed', 'sensorRecovered', 'sold'] as const) record[key] = item[key] === true;
  record.checkpoint = item.checkpoint === 'transect' && record.route!=='reef' ? 'transect' : item.checkpoint === 'wreck' && record.route==='reef' ? 'wreck' : item.checkpoint === 'reef' ? 'reef' : 'harbor';
  record.stage = stages.includes(item.stage) ? item.stage : 'briefing';
  // Restore only coherent stages. Corrupt or old saves cannot grant a finished mission.
  record.sold = record.sold && reefComplete(record) && recoveryComplete(record);
  if (record.sold) record.stage = 'complete';
  else if (recoveryComplete(record) && reefComplete(record)) record.stage = 'return';
  else if (reefComplete(record)&&(!(expeditionPlan(record).repairRequired||expeditionPlan(record).interiorRequired||expeditionPlan(record).remoteRequired)||record.stage!=='briefing')) record.stage = expeditionPlan(record).remoteRequired?'remote':expeditionPlan(record).interiorRequired?'interior':expeditionPlan(record).repairRequired?'repair':record.route!=='reef'?'transect':'wreck';
  else if (record.stage !== 'briefing') record.stage = 'reef';
  if((record.checkpoint==='wreck'||record.checkpoint==='transect')&&!reefComplete(record))record.checkpoint=record.stage==='briefing'?'harbor':'reef';
  if (record.sold) {
    record.saleCredits = Number.isFinite(item.saleCredits) && item.saleCredits > 0
      ? Math.min(1990, Math.floor(item.saleCredits)) : expeditionReward(record);
    record.grantState = item.grantState === 'earned' || item.grantState === 'claimed' ? item.grantState : 'unclaimed';
    record.grantCredits = record.grantState === 'unclaimed' ? 0 : Math.min(500, Math.floor(record.saleCredits * .5));
  }
  return record;
}
export function reefComplete(record: ExpeditionRecord) {
  const plan=expeditionPlan(record);
  return surveyPhotoCount(record)>=plan.photoGoal&&(!plan.samplesRequired||record.waterSample&&record.sedimentSample);
}
export function expeditionReward(record: ExpeditionRecord) {
  const plan = expeditionPlan(record);
  return (plan.samplesRequired&&record.waterSample ? 150 : 0) + (plan.samplesRequired&&record.sedimentSample ? 200 : 0) + (record.contractId?surveyPhotoCount(record):record.photos.length) * 120 + (plan.recoveryRequired?(plan.stations.length?record.transectReadings.length*plan.readingCredits:record.sensorRecovered ? 550 : 0):0) + (reefComplete(record) && recoveryComplete(record) ? plan.completionBonus : 0);
}
export function completedObjectives(record: ExpeditionRecord) {
  const plan=expeditionPlan(record);
  return surveyPhotoCount(record)+(plan.samplesRequired?Number(record.waterSample)+Number(record.sedimentSample):0)+(plan.recoveryRequired?(plan.stations.length?record.transectReadings.length:Number(record.cableFreed)+Number(record.sensorRecovered)):0)+(plan.repairRequired?Number(record.arrayRestored===true):0)+(plan.interiorRequired?orderedFreighterSteps(record.interiorSteps).length:0)+(plan.remoteRequired?orderedPelagicRecords(record.observatoryRecords).length:0)+Number(record.sold);
}
