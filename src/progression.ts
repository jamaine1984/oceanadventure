export type UpgradeKey = 'engine' | 'tank' | 'hull';
export type BoatKey = 'aurora' | 'voyager';
export type AchievementKey = 'first_signal' | 'deep_diver' | 'storm_runner' | 'fleet_owner' | 'expedition_complete';

export type PlayerProgress = {
  credits: number;
  expeditions: number;
  upgrades: Record<UpgradeKey, number>;
  ownedBoats: BoatKey[];
  activeBoat: BoatKey;
  achievements: AchievementKey[];
};

const STORAGE_KEY = 'ocean-adventure-progress-v1';
let progressStorage: Pick<Storage, 'getItem' | 'setItem'> = localStorage;

export function setProgressStorage(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  progressStorage = storage;
}

export const UPGRADE_CATALOG: Record<UpgradeKey, { name: string; description: string; baseCost: number; maxLevel: number }> = {
  engine: { name: 'Bluefin Drive', description: '+8% top speed and acceleration', baseCost: 450, maxLevel: 3 },
  tank: { name: 'Deep Air System', description: '+25% dive duration', baseCost: 350, maxLevel: 3 },
  hull: { name: 'Storm Hull', description: 'Reduces rough-water speed loss', baseCost: 400, maxLevel: 3 },
};

export const BOAT_CATALOG: Record<BoatKey, { name: string; role: string; price: number; model: string; speed: number; handling: number }> = {
  aurora: { name: 'Aurora 42', role: 'Expedition yacht', price: 0, model: '/models/aurora_explorer_yacht.glb', speed: 1, handling: 1 },
  voyager: { name: 'Voyager X', role: 'Performance explorer', price: 1800, model: '/models/expedition_yacht.glb', speed: 1.14, handling: 1.08 },
};

export const ACHIEVEMENT_CATALOG: Record<AchievementKey, { name: string; description: string }> = {
  first_signal: { name: 'Signal Found', description: 'Log the first navigation signal.' },
  deep_diver: { name: 'Into the Blue', description: 'Dive deeper than 10 meters.' },
  storm_runner: { name: 'Storm Runner', description: 'Log a signal during a storm.' },
  fleet_owner: { name: 'Fleet Captain', description: 'Own both expedition vessels.' },
  expedition_complete: { name: 'Safe Harbor', description: 'Complete a full expedition.' },
};

export function defaultProgress(): PlayerProgress {
  return { credits: 0, expeditions: 0, upgrades: { engine: 0, tank: 0, hull: 0 }, ownedBoats: ['aurora'], activeBoat: 'aurora', achievements: [] };
}

export function loadProgress(): PlayerProgress {
  try {
    const parsed = JSON.parse(progressStorage.getItem(STORAGE_KEY) ?? '') as Partial<PlayerProgress>;
    const ownedBoats: BoatKey[] = Array.isArray(parsed.ownedBoats)
      ? parsed.ownedBoats.filter((key): key is BoatKey => key === 'aurora' || key === 'voyager')
      : ['aurora'];
    if (!ownedBoats.includes('aurora')) ownedBoats.unshift('aurora');
    const activeBoat = (parsed.activeBoat === 'voyager' && ownedBoats.includes('voyager')) ? 'voyager' : 'aurora';
    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter((key): key is AchievementKey => key in ACHIEVEMENT_CATALOG)
      : [];
    return {
      credits: Math.max(0, Number(parsed.credits) || 0),
      expeditions: Math.max(0, Number(parsed.expeditions) || 0),
      upgrades: {
        engine: Math.max(0, Number(parsed.upgrades?.engine) || 0),
        tank: Math.max(0, Number(parsed.upgrades?.tank) || 0),
        hull: Math.max(0, Number(parsed.upgrades?.hull) || 0),
      },
      ownedBoats,
      activeBoat,
      achievements,
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress) {
  progressStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function upgradeCost(key: UpgradeKey, level: number) {
  return Math.round(UPGRADE_CATALOG[key].baseCost * (1 + level * 0.75));
}
