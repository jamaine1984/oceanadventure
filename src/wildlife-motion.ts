import type { SpeciesKey } from './expedition-state';

export function wildlifePose(key: SpeciesKey, time: number, radius: number, pace: number, phase: number) {
  const angle = time * pace + phase;
  const grazing = key === 'turtle' ? (1 + Math.sin(angle * 2 - .6)) * .5 : 0;
  const stretch = key === 'ray' ? .64 : key === 'turtle' ? .76 : .9;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius * stretch;
  const dx = -Math.sin(angle), dz = Math.cos(angle) * stretch;
  return {
    x, z,
    y: key === 'turtle' ? -.8 * grazing + Math.sin(time * .28 + phase) * .12 : Math.sin(time * .34 + phase) * (key === 'ray' ? .18 : .28),
    yaw: -Math.atan2(dz, dx),
    bank: key === 'ray' ? Math.sin(angle) * .09 : Math.sin(angle) * .025,
    stroke: Math.sin(time * (key === 'turtle' ? .95 : 1.5) + phase) * (.16 + .09 * (1 - grazing)),
  };
}
