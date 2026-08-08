export type UpgradeKey = 'engine' | 'tank' | 'hull';

export type PlayerProgress = {
  credits: number;
  expeditions: number;
  upgrades: Record<UpgradeKey, number>;
};

const STORAGE_KEY = 'ocean-adventure-progress-v1';

export const UPGRADE_CATALOG: Record<UpgradeKey, { name: string; description: string; baseCost: number; maxLevel: number }> = {
  engine: { name: 'Bluefin Drive', description: '+8% top speed and acceleration', baseCost: 450, maxLevel: 3 },
  tank: { name: 'Deep Air System', description: '+25% dive duration', baseCost: 350, maxLevel: 3 },
  hull: { name: 'Storm Hull', description: 'Reduces rough-water speed loss', baseCost: 400, maxLevel: 3 },
};

export function defaultProgress(): PlayerProgress {
  return { credits: 0, expeditions: 0, upgrades: { engine: 0, tank: 0, hull: 0 } };
}

export function loadProgress(): PlayerProgress {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<PlayerProgress>;
    return {
      credits: Math.max(0, Number(parsed.credits) || 0),
      expeditions: Math.max(0, Number(parsed.expeditions) || 0),
      upgrades: {
        engine: Math.max(0, Number(parsed.upgrades?.engine) || 0),
        tank: Math.max(0, Number(parsed.upgrades?.tank) || 0),
        hull: Math.max(0, Number(parsed.upgrades?.hull) || 0),
      },
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: PlayerProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function upgradeCost(key: UpgradeKey, level: number) {
  return Math.round(UPGRADE_CATALOG[key].baseCost * (1 + level * 0.75));
}
