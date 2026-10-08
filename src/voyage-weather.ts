import { WEATHER_PRESETS, type WeatherKey } from './sea-config';

export type VoyageWeather = { version: 1; elapsed: number; override: WeatherKey | null; until: number };
export const VOYAGE_DAY = 2160;
export const WEATHER_HOLD = 180;
const FRONTS: { key: WeatherKey; seconds: number }[] = [
  {key:'bluewater',seconds:480}, {key:'calm',seconds:360},
  {key:'bluewater',seconds:360}, {key:'storm',seconds:240},
  {key:'bluewater',seconds:240}, {key:'calm',seconds:480},
];
export const newVoyageWeather = (): VoyageWeather => ({version:1,elapsed:0,override:null,until:0});
export function validateWeather(value: unknown): VoyageWeather {
  if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Missing voyage weather record.');
  const v=value as VoyageWeather;
  if(v.version!==1 || !Number.isFinite(v.elapsed) || v.elapsed<0 || v.elapsed>1e9 || !Number.isFinite(v.until) || v.until<0 || v.until>1e9+WEATHER_HOLD || !(v.override===null || Object.hasOwn(WEATHER_PRESETS,v.override)))throw Error('Invalid voyage weather record.');
  if(v.override!==null && (v.until<v.elapsed || v.until-v.elapsed>WEATHER_HOLD+.001))throw Error('Invalid weather hold.');
  return {version:1,elapsed:v.elapsed,override:v.override,until:v.until};
}
export function advanceWeather(state: VoyageWeather, seconds: number, paused=false): void {
  if(paused || !Number.isFinite(seconds) || seconds<=0)return;
  state.elapsed=Math.min(1e9,state.elapsed+Math.min(seconds,.05));
  if(state.override!==null && state.elapsed>=state.until){state.override=null;state.until=0;}
}
export function weatherFront(elapsed: number) {
  const phase=elapsed%VOYAGE_DAY;
  let start=0;
  for(let index=0;index<FRONTS.length;index++) {
    const front=FRONTS[index];
    if(phase<start+front.seconds)return {key:front.key,remaining:start+front.seconds-phase,index};
    start+=front.seconds;
  }
  return {key:'bluewater' as WeatherKey,remaining:480,index:0};
}
export function activeWeather(state: VoyageWeather): WeatherKey {
  return state.override!==null && state.until>state.elapsed ? state.override : weatherFront(state.elapsed).key;
}
export function holdWeather(state: VoyageWeather, key: WeatherKey|null): VoyageWeather {
  return {...state,override:key,until:key===null?0:state.elapsed+WEATHER_HOLD};
}
export function restWeather(state: VoyageWeather, moored: boolean): VoyageWeather {
  const hour=voyageLight(state.elapsed).hour;
  if(!moored || (hour>=7&&hour<17))throw Error('Rest is available at harbor from dusk until dawn.');
  return {version:1,elapsed:state.elapsed+((7-hour+24)%24)*VOYAGE_DAY/24,override:null,until:0};
}
export function voyageLight(elapsed: number) {
  const hour=(9+elapsed/VOYAGE_DAY*24)%24;
  const elevation=58*Math.sin((hour-6)/24*Math.PI*2);
  const daylight=Math.max(0,Math.min(1,(elevation+6)/20));
  const minutes=Math.floor(hour*60);
  return {hour,elevation,daylight,azimuth:(150+elapsed/VOYAGE_DAY*360)%360,
    clock:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,
    period:daylight<.1?'Night':elevation<14?'Twilight':'Daylight'};
}
export function weatherForecast(state: VoyageWeather) {
  const manual=state.override!==null&&state.until>state.elapsed;
  const resume=manual?state.until-state.elapsed:0;
  const front=weatherFront(state.elapsed+resume);
  const entries: {key:WeatherKey;inSeconds:number;duration:number}[]=[];
  let offset=resume+front.remaining;
  if(manual)entries.push({key:front.key,inSeconds:resume,duration:front.remaining});
  for(let n=1;n<=3;n++) {
    const next=FRONTS[(front.index+n)%FRONTS.length];
    entries.push({key:next.key,inSeconds:offset,duration:next.seconds});
    offset+=next.seconds;
  }
  return {key:activeWeather(state),manual,remaining:manual?state.until-state.elapsed:front.remaining,entries:entries.slice(0,3)};
}
