import { CONTRACTS, CLIENTS, LANDMARKS, CHART_BOUNDS, contractById, contractAvailable, type ContractDefinition } from './voyage-catalog';
import {FIELD_POSTS} from './salvage';
export type VoyageState = {
  version: 1; completed: string[]; discoveries: string[];
  reputation: Record<keyof typeof CLIENTS, number>;
  blueprints: string[]; pins: { id: string; x: number; z: number; name: string }[];
  completions: Record<string, number>; activeWaypoint?: string;
};
export function newVoyage(): VoyageState { return {version:1,completed:[],discoveries:['harbor'],reputation:{mara:0,ivo:0,selene:0},blueprints:[],pins:[],completions:{}}; }
export function sanitizeVoyage(value: unknown): VoyageState {
  const state=newVoyage();if(!value||typeof value!=='object')return state;
  const item=value as Partial<VoyageState>;
  const unique=(input:unknown,valid:(id:string)=>boolean)=>Array.isArray(input)?[...new Set(input.filter((id):id is string=>typeof id==='string'&&valid(id)))]:[];
  state.completed=unique(item.completed,id=>!!contractById(id));
  state.discoveries=[...new Set(['harbor',...unique(item.discoveries,id=>LANDMARKS.some(place=>place.id===id))])];
  state.blueprints=unique(item.blueprints,id=>id==='survey-anchor'||id==='scooter-drive'||id==='research-rov');
  if(state.completed.includes('reach-archive')&&!state.blueprints.includes('research-rov'))state.blueprints.push('research-rov');
  if(state.completed.includes('bay-signal')){if(!state.blueprints.includes('survey-anchor'))state.blueprints.push('survey-anchor');if(!state.discoveries.includes('field-bay'))state.discoveries.push('field-bay');}
  if(state.completed.includes('lagoon-echo')&&!state.blueprints.includes('scooter-drive'))state.blueprints.push('scooter-drive');
  for(const post of FIELD_POSTS)if(state.completed.includes(post.requires)&&!state.discoveries.includes(`field-${post.id}`))state.discoveries.push(`field-${post.id}`);
  for(const key of Object.keys(CLIENTS) as (keyof typeof CLIENTS)[]) state.reputation[key]=Number.isFinite(item.reputation?.[key])?Math.max(0,Math.min(10000,Math.floor(item.reputation[key]))):0;
  for(const contract of CONTRACTS) if(state.completed.includes(contract.id))state.completions[contract.id]=Number.isFinite(item.completions?.[contract.id])?Math.max(1,Math.min(10000,Math.floor(item.completions[contract.id]))):1;
  if(Array.isArray(item.pins))for(const pin of item.pins.slice(0,12))if(pin&&typeof pin.id==='string'&&/^pin-[a-z0-9-]{1,40}$/.test(pin.id)&&!state.pins.some(item=>item.id===pin.id)&&Number.isFinite(pin.x)&&Number.isFinite(pin.z)&&pin.x>=CHART_BOUNDS.minX&&pin.x<=CHART_BOUNDS.maxX&&pin.z>=CHART_BOUNDS.minZ&&pin.z<=CHART_BOUNDS.maxZ&&typeof pin.name==='string')state.pins.push({id:pin.id,x:pin.x,z:pin.z,name:pin.name.replace(/[<>\x00-\x1f]/g,'').slice(0,36)||'Waypoint'});
  if(typeof item.activeWaypoint==='string'&&(state.pins.some(pin=>pin.id===item.activeWaypoint)||LANDMARKS.some(place=>place.id===item.activeWaypoint&&state.discoveries.includes(place.id))))state.activeWaypoint=item.activeWaypoint;
  return state;
}
export function recordContractCompletion(state: VoyageState, contract: ContractDefinition): VoyageState {
  if(!contractAvailable(contract,state.completed))throw new Error('Contract prerequisites are incomplete.');
  const next=structuredClone(state);const first=!next.completed.includes(contract.id);
  if(first)next.completed.push(contract.id);
  next.completions[contract.id]=Math.min(10000,(next.completions[contract.id]??0)+1);
  next.reputation[contract.client]=Math.min(10000,next.reputation[contract.client]+contractReputationReward(contract,state.completed));
  if(contract.blueprint&&!next.blueprints.includes(contract.blueprint))next.blueprints.push(contract.blueprint);
  for(const post of FIELD_POSTS)if(next.completed.includes(post.requires)&&!next.discoveries.includes(`field-${post.id}`))next.discoveries.push(`field-${post.id}`);
  return next;
}
export function contractReputationReward(contract:ContractDefinition,completed:readonly string[]) { return completed.includes(contract.id)?Math.ceil(contract.reputation*.4):contract.reputation; }
export function discoverNearby(state: VoyageState, position:{x:number;z:number}) {
  const fresh=LANDMARKS.filter(place=>!state.discoveries.includes(place.id)&&Math.hypot(place.x-position.x,place.z-position.z)<place.radius);
  for(const place of fresh)state.discoveries.push(place.id);return fresh;
}
export function waypointLocation(state: VoyageState) { return state.pins.find(pin=>pin.id===state.activeWaypoint)??LANDMARKS.find(place=>place.id===state.activeWaypoint&&state.discoveries.includes(place.id)); }
