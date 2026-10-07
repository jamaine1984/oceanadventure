import { newExpedition, sanitizeExpedition, type ExpeditionRecord } from './expedition-state';
import { newVoyage, sanitizeVoyage, type VoyageState } from './voyage-state';
import { createArchive, parseArchive, type SaveArchive } from './save-archive';
import { newFieldEquipment, sanitizeFieldEquipment, type FieldEquipment } from './field-equipment';
import { newStory, sanitizeStory, type StoryState } from './story-state';
export type UpgradeKey = 'engine' | 'tank' | 'hull' | 'fins' | 'light';
export type BoatKey = 'aurora' | 'voyager';
export type AchievementKey = 'first_signal' | 'deep_diver' | 'storm_runner' | 'fleet_owner' | 'expedition_complete';

export type PlayerProgress = {
  saveVersion: 2;
  voyage: VoyageState;
  fieldEquipment?: FieldEquipment;
  story?: StoryState;
  credits: number;
  expeditions: number;
  upgrades: Record<UpgradeKey, number>;
  ownedBoats: BoatKey[];
  activeBoat: BoatKey;
  achievements: AchievementKey[];
  expedition: ExpeditionRecord;
  discoveredSpecies: string[];
  collectionPhotos: Partial<Record<string, string>>;
  shorePosition?: { x:number; z:number; yaw:number };
};

const STORAGE_KEY = 'ocean-adventure-progress-v1';
const BACKUP_KEY = 'ocean-adventure-recovery-v1';
let progressStorage: Pick<Storage, 'getItem' | 'setItem'> = globalThis.localStorage;
let knownStoredValue: string | null | undefined;
export let progressLoadStatus: 'new' | 'loaded' | 'recovered' = 'new';
export class ProgressLoadError extends Error {}

export function setProgressStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  progressStorage = storage;
  knownStoredValue = undefined;
}

export async function acquireProgressWriter(): Promise<boolean> {
  if (!navigator.locks) return true;
  return new Promise<boolean>((resolve, reject) => {
    void navigator.locks.request('ocean-adventure-progress-writer', { ifAvailable: true }, async (lock) => {
      resolve(!!lock);
      if (lock) await new Promise<void>(() => {});
    }).catch(reject);
  });
}

export const UPGRADE_CATALOG: Record<UpgradeKey, { name: string; description: string; baseCost: number; maxLevel: number }> = {
  engine: { name: 'Bluefin Drive', description: '+8% top speed and acceleration', baseCost: 450, maxLevel: 3 },
  tank: { name: 'Deep Air System', description: '+25% dive duration', baseCost: 350, maxLevel: 3 },
  hull: { name: 'Storm Hull', description: 'Reduces rough-water speed loss', baseCost: 400, maxLevel: 3 },
  fins: { name: 'Carbon Expedition Fins', description: '+12% swim speed per level', baseCost: 280, maxLevel: 3 },
  light: { name: 'Survey Dive Light', description: 'Brighter, longer underwater beam', baseCost: 320, maxLevel: 3 },
};

export const BOAT_CATALOG: Record<BoatKey, { name: string; role: string; price: number; model: string; speed: number; handling: number; length: number; beam: number }> = {
  aurora: { name: 'Aurora 42', role: 'Dive expedition yacht', price: 0, model: '/models/aurora_explorer_yacht_v2.glb', speed: 1, handling: 1, length: 42, beam: 8.6 },
  voyager: { name: 'Voyager X', role: 'Fast research launch', price: 1800, model: '/models/voyager_research_launch_v2.glb', speed: 1.14, handling: 1.14, length: 28, beam: 6.8 },
};

export const ACHIEVEMENT_CATALOG: Record<AchievementKey, { name: string; description: string }> = {
  first_signal: { name: 'Signal Found', description: 'Log the first navigation signal.' },
  deep_diver: { name: 'Into the Blue', description: 'Dive deeper than 10 meters.' },
  storm_runner: { name: 'Storm Runner', description: 'Log a signal during a storm.' },
  fleet_owner: { name: 'Fleet Captain', description: 'Own both expedition vessels.' },
  expedition_complete: { name: 'Safe Harbor', description: 'Complete a full expedition.' },
};

export function defaultProgress(): PlayerProgress {
  return { saveVersion:2,voyage:newVoyage(),fieldEquipment:newFieldEquipment(),story:newStory(),credits: 0, expeditions: 0, upgrades: { engine: 0, tank: 0, hull: 0, fins: 0, light: 0 }, ownedBoats: ['aurora'], activeBoat: 'aurora', achievements: [], expedition: newExpedition(), discoveredSpecies: [], collectionPhotos: {} };
}

export function loadProgress(): PlayerProgress {
  progressLoadStatus='new';
  try { knownStoredValue=progressStorage.getItem(STORAGE_KEY); }
  catch { throw new ProgressLoadError('Browser storage is unavailable. Allow storage to protect your voyage.'); }
  if(knownStoredValue===null)return defaultProgress();
  try { const result=normalizeProgress(JSON.parse(knownStoredValue));progressLoadStatus='loaded';return result; }
  catch(error) {
    if(error instanceof ProgressLoadError)throw error;
    for(const archive of recoveryArchives())try{const result=normalizeProgress(JSON.parse(archive.payload));progressLoadStatus='recovered';return result;}catch(recoveryError){if(recoveryError instanceof ProgressLoadError)throw recoveryError;/* Try the next verified recovery checkpoint. */}
    throw new ProgressLoadError('Your saved voyage could not be read. It has not been overwritten. Import a backup to recover.');
  }
}

export function normalizeProgress(value: unknown): PlayerProgress {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid voyage data.');
    const parsed=value as Partial<PlayerProgress>;
    if(parsed.saveVersion!==undefined&&parsed.saveVersion!==2)throw new ProgressLoadError('This voyage was saved by a different game version. Keep the save and update the game.');
    if(parsed.story&&parsed.story.version!==1){if(parsed.story.version===undefined)throw new Error('The story record is incomplete.');throw new ProgressLoadError('This story record needs a different game version. Keep the save and update the game.');}
    if(parsed.voyage&&parsed.voyage.version!==1){if(parsed.voyage.version===undefined)throw new Error('The campaign record is incomplete.');throw new ProgressLoadError('The campaign save version is not supported. Keep the save and update the game.');}
    if(parsed.expedition&&parsed.expedition.version!==2){if(parsed.expedition.version===undefined)throw new Error('The expedition record is incomplete.');throw new ProgressLoadError('The expedition save version is not supported. Keep the save and update the game.');}
    if(!Number.isFinite(parsed.credits)||parsed.credits<0||!Array.isArray(parsed.ownedBoats))throw new Error('The voyage is missing its saved balance or fleet.');
    if(parsed.saveVersion===2){
      const record=parsed.expedition,voyage=parsed.voyage;
      const object=(item:unknown)=>!!item&&typeof item==='object'&&!Array.isArray(item);
      const validUpgrades=object(parsed.upgrades)&&(Object.keys(UPGRADE_CATALOG)as UpgradeKey[]).every(key=>Number.isFinite(parsed.upgrades[key]));
      const validExpedition=object(record)&&record.version===2&&Number.isFinite(record.run)&&typeof record.route==='string'&&typeof record.stage==='string'&&typeof record.checkpoint==='string'&&Array.isArray(record.photos)&&Array.isArray(record.transectReadings)&&object(record.photoImages)&&Number.isFinite(record.saleCredits)&&Number.isFinite(record.grantCredits)&&typeof record.grantState==='string'&&(['waterSample','sedimentSample','cableFreed','sensorRecovered','sold']as const).every(key=>typeof record[key]==='boolean');
      const validVoyage=object(voyage)&&voyage.version===1&&Array.isArray(voyage.completed)&&Array.isArray(voyage.discoveries)&&Array.isArray(voyage.blueprints)&&Array.isArray(voyage.pins)&&object(voyage.completions)&&object(voyage.reputation)&&(['mara','ivo','selene']as const).every(key=>Number.isFinite(voyage.reputation[key]));
      if(!Number.isFinite(parsed.expeditions)||parsed.expeditions<0||typeof parsed.activeBoat!=='string'||!Array.isArray(parsed.achievements)||!Array.isArray(parsed.discoveredSpecies)||!object(parsed.collectionPhotos)||!validUpgrades||!validExpedition||!validVoyage)throw new Error('The current-version voyage is incomplete.');
    }
    if(!parsed.expedition){if(!Number.isFinite(parsed.credits)||!Array.isArray(parsed.ownedBoats))throw new Error('Missing expedition record.');parsed.expedition=newExpedition();}
    const ownedBoats: BoatKey[] = Array.isArray(parsed.ownedBoats)
      ? parsed.ownedBoats.filter((key): key is BoatKey => key === 'aurora' || key === 'voyager')
      : ['aurora'];
    if (!ownedBoats.includes('aurora')) ownedBoats.unshift('aurora');
    const activeBoat = (parsed.activeBoat === 'voyager' && ownedBoats.includes('voyager')) ? 'voyager' : 'aurora';
    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter((key): key is AchievementKey => key in ACHIEVEMENT_CATALOG)
      : [];
    const level = (key: UpgradeKey) => Math.min(UPGRADE_CATALOG[key].maxLevel, Math.max(0, Math.floor(Number(parsed.upgrades?.[key]) || 0)));
    const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.min(1000000000, Math.max(0, Math.floor(Number(value)))) : 0;
    const expedition = sanitizeExpedition(parsed.expedition);
    const collectionPhotos: PlayerProgress['collectionPhotos'] = {};
    for (const key of ['butterflyfish', 'tang', 'anthias', 'turtle', 'ray', 'reefshark', 'hammerhead']) {
      const photo = parsed.collectionPhotos?.[key] ?? expedition.photoImages[key];
      if (typeof photo === 'string' && photo.startsWith('data:image/jpeg;base64,') && photo.length < 65000) collectionPhotos[key] = photo;
    }
    return {
      saveVersion:2,
      story:sanitizeStory(parsed.story),
      voyage:sanitizeVoyage(parsed.voyage),
      fieldEquipment:sanitizeFieldEquipment(parsed.fieldEquipment,sanitizeVoyage(parsed.voyage).blueprints),
      credits: count(parsed.credits),
      expeditions: count(parsed.expeditions),
      upgrades: {
        engine: level('engine'), tank: level('tank'), hull: level('hull'), fins: level('fins'), light: level('light'),
      },
      ownedBoats,
      activeBoat,
      achievements,
      expedition,
      collectionPhotos,
      discoveredSpecies: Array.isArray(parsed.discoveredSpecies) ? parsed.discoveredSpecies.filter((key) => typeof key === 'string').slice(0, 20) : [],
      shorePosition: parsed.shorePosition&&Number.isFinite(parsed.shorePosition.x)&&Number.isFinite(parsed.shorePosition.z)&&Number.isFinite(parsed.shorePosition.yaw)&&parsed.shorePosition.x>=-90&&parsed.shorePosition.x<=12&&parsed.shorePosition.z>=-4&&parsed.shorePosition.z<=84&&parsed.expedition?.checkpoint==='harbor'?{x:parsed.shorePosition.x,z:parsed.shorePosition.z,yaw:parsed.shorePosition.yaw}:undefined,
    };
}

export function saveProgress(progress: PlayerProgress) {
  const current = progressStorage.getItem(STORAGE_KEY);
  if (knownStoredValue !== undefined && current !== knownStoredValue) throw new Error('Progress changed in another session. Reload before saving.');
  const value = JSON.stringify(progress);
  progressStorage.setItem(STORAGE_KEY, value);
  knownStoredValue = value;
  if(current!==value) {
    try { const previous=recoveryArchives();const archive=createArchive(value);progressStorage.setItem(BACKUP_KEY,JSON.stringify([archive,...previous.filter(item=>item.payload!==value)].slice(0,3))); }
    catch { /* The primary save is committed even if optional recovery storage is full. */ }
  }
}

export function recoveryArchives(): SaveArchive[] {
  try { const values=JSON.parse(progressStorage.getItem(BACKUP_KEY)??'[]');if(!Array.isArray(values))return [];return values.slice(0,3).flatMap(value=>{try{return [parseArchive(JSON.stringify(value))];}catch{return [];}}); }
  catch{return [];}
}
export function exportProgress(progress:PlayerProgress) { return JSON.stringify(createArchive(JSON.stringify(normalizeProgress(progress))),null,2); }
export function readProgressImport(text:string):PlayerProgress {
  const value=JSON.parse(parseArchive(text).payload);
  if(!Number.isFinite(value?.credits)||!Number.isFinite(value?.expeditions)||!Array.isArray(value?.ownedBoats)||!value?.upgrades)throw new Error('The save file has an incomplete player record.');
  return normalizeProgress(value);
}
export function importProgress(next:PlayerProgress) {
  // Retain the pre-import voyage before committing a deliberate replacement.
  const current=progressStorage.getItem(STORAGE_KEY);
  if(knownStoredValue!==undefined&&current!==knownStoredValue)throw new Error('Progress changed in another session. Reload before importing.');
  if(current){let valid=false;try{normalizeProgress(JSON.parse(current));valid=true;}catch{/* An unreadable primary is preserved in storage until the verified import commits. */}if(valid){const archives=recoveryArchives();progressStorage.setItem(BACKUP_KEY,JSON.stringify([createArchive(current),...archives.filter(item=>item.payload!==current)].slice(0,3)));}}
  const value=JSON.stringify(normalizeProgress(next));progressStorage.setItem(STORAGE_KEY,value);knownStoredValue=value;
  try{const archives=recoveryArchives();progressStorage.setItem(BACKUP_KEY,JSON.stringify([createArchive(value),...archives.filter(item=>item.payload!==value)].slice(0,3)));}catch{/* The imported primary is committed; existing verified checkpoints remain available. */}
}

export function researchDiscount(progress:Pick<PlayerProgress,'voyage'>) {
  const reputation=Object.values(progress.voyage.reputation).reduce((sum,value)=>sum+value,0);
  return Math.min(.12,Math.floor(reputation/50)*.02);
}
export function upgradeCost(key: UpgradeKey, level: number, discount=0) {
  return Math.round(UPGRADE_CATALOG[key].baseCost * (1 + level * 0.75)*(1-Math.max(0,Math.min(.12,discount))));
}
