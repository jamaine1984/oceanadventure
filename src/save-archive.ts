export type SaveArchive = { format:'ocean-adventure-voyage'; version:1; exportedAt:string; checksum:string; payload:string };
export function saveChecksum(value:string) {
  let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function createArchive(payload:string,now=new Date()):SaveArchive {
  return {format:'ocean-adventure-voyage',version:1,exportedAt:now.toISOString(),checksum:saveChecksum(payload),payload};
}
export function parseArchive(text:string):SaveArchive {
  if(text.length>2_000_000)throw new Error('This save file is too large.');
  const value=JSON.parse(text) as SaveArchive;
  if(!value||value.format!=='ocean-adventure-voyage'||value.version!==1||typeof value.payload!=='string'||value.checksum!==saveChecksum(value.payload)||!Number.isFinite(Date.parse(value.exportedAt)))throw new Error('This is not a valid Ocean Adventure save file.');
  return value;
}
