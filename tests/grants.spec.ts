import { test, expect } from '@playwright/test';
import { defaultProgress, loadProgress, saveProgress, setProgressStorage } from '../src/progression';
import { researchGrantAmount, claimResearchGrant } from '../src/research-grant';
import { sanitizeExpedition } from '../src/expedition-state';

test('research grant caps the actual sale and persists one atomic claim', () => {
  const values = new Map<string, string>();
  setProgressStorage({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
  const p = defaultProgress();
  Object.assign(p.expedition, { photos: ['tang', 'turtle', 'ray'], waterSample: true, sedimentSample: true, cableFreed: true, sensorRecovered: true, sold: true, saleCredits: 1510, stage: 'complete', grantState: 'earned' });
  p.credits = 1510;
  expect(researchGrantAmount(p)).toBe(500);
  const next = claimResearchGrant(p)!;
  expect(p.credits).toBe(1510); saveProgress(next);
  const reloaded = loadProgress();
  expect(reloaded.credits).toBe(2010);
  expect(reloaded.expedition.grantState).toBe('claimed');
  expect(claimResearchGrant(reloaded)).toBeNull();
});

test('legacy sale migrates but unfinished records cannot unlock grants', () => {
  const r = defaultProgress().expedition;
  Object.assign(r, { photos: ['tang', 'turtle', 'ray'], waterSample: true, sedimentSample: true, cableFreed: true, sensorRecovered: true, sold: true });
  delete (r as any).saleCredits;
  expect(sanitizeExpedition(r).saleCredits).toBe(1510);
  expect(sanitizeExpedition({ ...r, sensorRecovered: false, grantState: 'claimed', grantCredits: 500 }).grantState).toBe('unclaimed');
});

test('a failed save cannot mutate balance or consume a claim', () => {
  const p = defaultProgress(); p.expedition.sold = true; p.expedition.saleCredits = 400; p.expedition.grantState = 'earned';
  setProgressStorage({ getItem: () => null, setItem: () => { throw new Error('Storage full'); } });
  expect(researchGrantAmount(p)).toBe(200);
  expect(() => saveProgress(claimResearchGrant(p)!)).toThrow('Storage full');
  expect(p.credits).toBe(0); expect(p.expedition.grantState).toBe('earned');
});

test('stale progress cannot overwrite another saved transaction', () => {
  const values = new Map<string, string>();
  setProgressStorage({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
  const p = loadProgress(); saveProgress(p);
  const external = structuredClone(p); external.credits = 500;
  values.set('ocean-adventure-progress-v1', JSON.stringify(external));
  expect(() => saveProgress(p)).toThrow('Progress changed in another session');
  expect(loadProgress().credits).toBe(500);
});
