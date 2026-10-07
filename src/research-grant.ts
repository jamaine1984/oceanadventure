import type { PlayerProgress } from './progression';

export function researchGrantAmount(progress: PlayerProgress) {
  return progress.expedition.sold ? Math.min(500, Math.floor(progress.expedition.saleCredits * .5)) : 0;
}

// Return a transaction snapshot. The caller saves it before replacing live progress.
export function claimResearchGrant(progress: PlayerProgress): PlayerProgress | null {
  const record = progress.expedition;
  if (!record.sold || record.grantState !== 'earned') return null;
  const next = structuredClone(progress);
  next.expedition.grantCredits = researchGrantAmount(progress);
  next.expedition.grantState = 'claimed';
  next.credits += next.expedition.grantCredits;
  return next;
}
