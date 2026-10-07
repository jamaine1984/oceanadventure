import type { ExpeditionRecord } from './expedition-state';
export const ARRAY_SITE={x:190,z:-156} as const;
export const ARRAY_SOURCES=[{name:'Blue',hz:18},{name:'White',hz:32},{name:'Yellow',hz:46}] as const;
export const ARRAY_RECEIVERS=[{name:'West',hz:46,reversed:true},{name:'Center',hz:18,reversed:false},{name:'North',hz:32,reversed:true}] as const;
export type ArrayCircuit={source:number;reversed:boolean};
export function circuitDiagnostics(circuits:readonly ArrayCircuit[]){
  return ARRAY_RECEIVERS.map((receiver,index)=>{const circuit=circuits[index];return !!circuit&&Number.isInteger(circuit.source)&&circuit.source>=0&&circuit.source<3&&ARRAY_SOURCES[circuit.source].hz===receiver.hz&&circuit.reversed===receiver.reversed;});
}
export function commissionArray(record:ExpeditionRecord,circuits:readonly ArrayCircuit[]):ExpeditionRecord{
  if(record.contractId!=='array-repair'||record.stage!=='repair'||record.arrayRestored||record.sold)throw new Error('No active array restoration.');
  if(circuits.length!==3||!circuitDiagnostics(circuits).every(Boolean))throw new Error('Circuit verification failed. Keep the feed isolated.');
  return {...structuredClone(record),arrayRestored:true,stage:'return'};
}
