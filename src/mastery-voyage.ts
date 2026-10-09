import type {PlayerProgress} from './progression';
import {FIELD_POSTS,newSalvage} from './salvage';
import {newRovEquipment} from './research-rov';
import {newVoyageWeather} from './voyage-weather';
import {WEATHER_PRESETS,type WeatherKey} from './sea-config';

export const MASTERY_PLANS = [
  {id:'coast',title:'Coastline Comparison',stops:['bay','lagoon','passage'],reward:650,first:250,description:'Compare three coastal water columns in one voyage. Selene needs an ordered record of the coral shelf, seagrass edge and eastern ledge.'},
  {id:'waters',title:'The Five Waters',stops:['bay','lagoon','reach','passage','pelagic'],reward:1100,first:400,description:'Connect all five regions with a new habitat baseline. Survey the outer banks of Pelagic 05 and the observatory as well as the living coast.'},
] as const;
export type MasteryId=typeof MASTERY_PLANS[number]['id'];
export const CAMPAIGN_RECEIPTS=['bay-signal','lagoon-echo','passage-origin','array-repair','reach-archive','pelagic-record'];
const TITLES:Record<string,string>={bay:'Coral shelf water column',lagoon:'Seagrass canopy edge',passage:'Eastern limestone ledge',reach:'Freighter outer bank',pelagic:'Observatory approach'};
export type MasteryAnchor={x:number;z:number;yaw:number};
export type MasteryReading={stop:string;weather:WeatherKey;elapsed:number;wind:number;depth:number};
export type MasteryState={version:1;counts:Record<MasteryId,number>;active:null|{id:MasteryId;run:number;started:number;readings:MasteryReading[];anchor:MasteryAnchor};last:null|{id:MasteryId;run:number;readings:MasteryReading[];reward:number}};
export const MASTERY_DWELL=4;
export const newMastery=():MasteryState=>({version:1,counts:{coast:0,waters:0},active:null,last:null});
export const masteryPlan=(id:unknown)=>MASTERY_PLANS.find(p=>p.id===id);
export const masteryUnlocked=(completed:readonly string[])=>CAMPAIGN_RECEIPTS.every(id=>completed.includes(id));
export function masteryStops(id:MasteryId,run:number){
  const stops=[...masteryPlan(id)!.stops] as string[],offset=(run-1)%stops.length;
  if(run%2===0)stops.reverse();return stops.slice(offset).concat(stops.slice(0,offset));
}
export function masteryStation(state:MasteryState|undefined,floor:(x:number,z:number)=>number){
  const active=state?.active;if(!active)return;
  const id=masteryStops(active.id,active.run)[active.readings.length],post=FIELD_POSTS.find(p=>p.id===id);if(!post)return;
  return {id,name:TITLES[id],x:post.x,z:post.z+5,y:floor(post.x,post.z+5)+3};
}
export function masteryReady(state:MasteryState|undefined,position:{x:number;y:number;z:number},floor:(x:number,z:number)=>number,speed:number,depth:number){
  const s=masteryStation(state,floor);return !!s&&Number.isFinite(speed)&&Math.abs(speed)<=.2&&depth>.6&&Math.abs(position.y-s.y)<=1.5&&Math.hypot(position.x-s.x,position.y-s.y,position.z-s.z)<=3.5;
}
export const masteryReward=(id:MasteryId,run:number)=>masteryPlan(id)!.reward+(run===1?masteryPlan(id)!.first:0);
const validAnchor=(v:MasteryAnchor)=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Math.abs(v.x)<100000&&Math.abs(v.z)<100000&&Number.isFinite(v.yaw)&&Math.abs(v.yaw)<1e8;
function validReadings(readings:MasteryReading[],id:MasteryId,run:number,started:number,maxTime:number){
  const order=masteryStops(id,run);let previous=started;
  if(!Array.isArray(readings)||readings.length>order.length)return false;
  return readings.every((r,i)=>{
    const valid=r&&r.stop===order[i]&&Object.hasOwn(WEATHER_PRESETS,r.weather)&&Number.isFinite(r.elapsed)&&r.elapsed>=previous&&r.elapsed<=maxTime&&Number.isFinite(r.wind)&&r.wind>=0&&r.wind<=60&&Number.isFinite(r.depth)&&r.depth>.6&&r.depth<150;previous=r?.elapsed;return valid;
  });
}
export function validateMastery(value:unknown,completed:readonly string[],elapsed:number):MasteryState{
  const v=value as MasteryState,whole=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<10000;
  if(!v||v.version!==1||!v.counts||Object.keys(v.counts).length!==2||!MASTERY_PLANS.every(p=>whole(v.counts[p.id]))||!(v.active===null||typeof v.active==='object')||!(v.last===null||typeof v.last==='object'))throw Error('The mastery voyage record is incomplete.');
  if((v.active||v.last||Object.values(v.counts).some(n=>n>0))&&!masteryUnlocked(completed))throw Error('The mastery voyage is missing its campaign receipts.');
  if(v.active){const r=v.active;if(!masteryPlan(r.id)||r.run!==v.counts[r.id]+1||!whole(r.run)||!Number.isFinite(r.started)||r.started<0||r.started>elapsed||!validAnchor(r.anchor)||!validReadings(r.readings,r.id,r.run,r.started,elapsed))throw Error('The active mastery voyage is inconsistent.');}
  if(v.last){const r=v.last;if(!masteryPlan(r.id)||!whole(r.run)||r.run<1||r.run>v.counts[r.id]||r.reward!==masteryReward(r.id,r.run)||!validReadings(r.readings,r.id,r.run,0,elapsed)||r.readings.length!==masteryPlan(r.id)!.stops.length)throw Error('The mastery payment receipt is inconsistent.');}
  if(Object.values(v.counts).some(n=>n>0)&&!v.last)throw Error('The mastery payment receipt is missing.');
  return structuredClone(v);
}
export function beginMastery(p:PlayerProgress,id:MasteryId,harbor:boolean,anchor:MasteryAnchor):PlayerProgress{
  if(!masteryPlan(id)||!harbor||!validAnchor(anchor)||!masteryUnlocked(p.voyage.completed)||p.mastery?.active||!p.expedition.sold&&p.expedition.stage!=='briefing')throw Error('Finish the campaign and return to harbor before starting a mastery voyage.');
  const n=structuredClone(p);n.mastery??=newMastery();if(n.mastery.counts[id]>=9998)throw Error('This voyage archive is full.');
  n.weather??=newVoyageWeather();n.rov??=newRovEquipment();n.salvage??=newSalvage();n.saveVersion=6;n.shorePosition=undefined;n.voyage.activeWaypoint=undefined;
  n.mastery.active={id,run:n.mastery.counts[id]+1,started:n.weather.elapsed,readings:[],anchor:{...anchor}};return n;
}
export function recordMastery(p:PlayerProgress,position:{x:number;y:number;z:number},floor:(x:number,z:number)=>number,speed:number,depth:number,weather:WeatherKey,wind:number,anchor:MasteryAnchor):PlayerProgress{
  if(!masteryReady(p.mastery,position,floor,speed,depth)||!validAnchor(anchor))throw Error('Hold position inside the current survey water column.');
  const n=structuredClone(p),r=n.mastery!.active!,s=masteryStation(n.mastery,floor)!;
  r.readings.push({stop:s.id,elapsed:n.weather!.elapsed,depth,weather,wind});r.anchor={...anchor};
  validateMastery(n.mastery,n.voyage.completed,n.weather!.elapsed);return n;
}
export function claimMastery(p:PlayerProgress,harbor:boolean):PlayerProgress{
  const r=p.mastery?.active;if(!r||!harbor||r.readings.length!==masteryPlan(r.id)!.stops.length)throw Error('Return all station records to the research harbor.');
  validateMastery(p.mastery,p.voyage.completed,p.weather!.elapsed);
  const n=structuredClone(p),reward=masteryReward(r.id,r.run);n.credits+=reward;n.expeditions+=1;n.voyage.reputation.selene=Math.min(10000,n.voyage.reputation.selene+15);
  n.mastery!.counts[r.id]++;n.mastery!.last={id:r.id,run:r.run,readings:structuredClone(r.readings),reward};n.mastery!.active=null;return n;
}
export function abandonMastery(p:PlayerProgress,harbor:boolean):PlayerProgress{
  if(!p.mastery?.active||!harbor)throw Error('Return to harbor before abandoning a voyage.');
  const n=structuredClone(p);n.mastery!.active=null;return n;
}
