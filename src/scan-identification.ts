import { SPECIES, type ExpeditionRecord, type SpeciesKey } from './expedition-state';
import { sonarContacts, SONAR_COOLDOWN, type SonarContact } from './field-equipment';

export type ScanIdentification = SonarContact & { kind: 'Research instrument' | 'Marine life'; note: string; action: string };
export type WildlifeEcho = { key: SpeciesKey; root: { visible: boolean; position: { x: number; y: number; z: number } } };

export function scannerReady(state: { swimming: boolean; selected: boolean; depth: number; paused: boolean; acquiring: boolean; time: number; lastSweep: number }) {
  return state.swimming && state.selected && state.depth > .6 && !state.paused && !state.acquiring && state.time - state.lastSweep >= SONAR_COOLDOWN;
}

export function identifyScan(record: ExpeditionRecord, position: { x: number; y: number; z: number }, animals: readonly WildlifeEcho[]): ScanIdentification[] {
  const research = sonarContacts(record, position).map(contact => ({
    ...contact, kind: 'Research instrument' as const,
    note: contact.id === 'water' ? 'A water-quality sampling station.' : contact.id === 'sediment' ? 'A seabed sediment collection station.' : contact.id === 'cable' ? 'A research tether caught beside the wreck.' : contact.id === 'sensor' ? 'A recoverable ocean monitoring sensor.' : 'A fixed acoustic survey station.',
    action: contact.id === 'water' || contact.id === 'sediment' ? 'Sampler / collect at the station' : contact.id === 'cable' ? 'Cutter / release the tether' : contact.id === 'sensor' ? record.cableFreed ? 'Scanner / retrieve at the sensor' : 'Release the tether before recovery' : 'Scanner / hold position to acquire a reading',
  }));
  const wildlife = new Map<SpeciesKey, ScanIdentification>();
  for (const animal of animals) {
    const p = animal.root.position;
    const dx = p.x - position.x, dz = p.z - position.z, vertical = p.y - position.y;
    const distance = Math.hypot(dx, vertical, dz);
    if (!animal.root.visible || !Number.isFinite(distance) || distance > 25 || (wildlife.get(animal.key)?.distance ?? Infinity) <= distance) continue;
    wildlife.set(animal.key, { id: `wildlife-${animal.key}`, name: SPECIES[animal.key].name, kind: 'Marine life', note: SPECIES[animal.key].note,
      action: 'Camera / photograph to record an observation', x: p.x, y: p.y, z: p.z, distance, bearing: Math.atan2(dx, -dz), vertical });
  }
  // Research instruments retain priority; moving wildlife positions are last-sweep fixes, not live tracking.
  return [...research, ...[...wildlife.values()].sort((a, b) => a.distance - b.distance)].slice(0, 5);
}
