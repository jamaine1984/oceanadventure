import type { ExpeditionRecord } from './expedition-state';
export type Speaker = 'mara' | 'ivo' | 'selene';
export type StoryState = { version: 1; seen: string[]; decisions: Record<string, string> };
export type StoryContext = { expeditions: number; expedition: ExpeditionRecord; voyage: { completed: string[] }; story?: StoryState };
export type StoryChoice = { id: string; label: string; reply?: string; depart?: boolean };
export type StoryScene = { id: string; speaker: Speaker; title: string; text: string; choices: StoryChoice[] };
export const STORY_SCENES: readonly StoryScene[] = [
  {id:'restoration-report',speaker:'ivo',title:'The array wakes',text:'The commissioning record is archived. Three reference channels are transmitting again. The bay has a reliable network, and we have a safe starting point for the next expedition.',choices:[{id:'continue',label:'Archive the commissioning report'}]},
  {id:'welcome',speaker:'mara',title:'The Lost Signal',text:'The launch went silent. Its last transmission came from the reef. We need to find out why.',choices:[{id:'signal',label:'Ask about the signal',reply:'Three short pulses, then silence. Photograph the reef and collect the two marked samples before recovering the launch recorder. Selene needs the habitat record; Ivo needs the recorder intact.'},{id:'depart',label:'Accept expedition',depart:true}]},
  {id:'recorder',speaker:'ivo',title:'A voice beneath the reef',text:'That recorder is still carrying a pulse. It is repeating a station identifier, not a distress call. Bring it back intact. I can compare its clock with the lagoon instruments.',choices:[{id:'source',label:'Where is it coming from?',reply:'West, beneath the seagrass. We need three clean readings, not guesses. The channel stations can separate the echo from the source.'},{id:'continue',label:'Secure the recorder'}]},
  {id:'bay-report',speaker:'mara',title:'The first bearing',text:'The recorder survived. The reef survey tells us the habitat is healthy, but the missing launch was listening to something older. Ivo has a bearing into the lagoon.',choices:[{id:'crew',label:'How is the crew?',reply:'They reached shore before the launch sank. This is a recovery expedition, not a rescue. We can take the time to leave the habitats undisturbed.'},{id:'continue',label:'Log the bearing'}]},
  {id:'lagoon-pulse',speaker:'ivo',title:'The eastern reply',text:'All three stations agree. The same pulse is answering from the limestone vault. The timing is deliberate. Someone built this network to keep listening without a crew.',choices:[{id:'network',label:'What kind of network?',reply:'An old habitat-monitoring array. Selene has seen its instrument codes in archived field notes. The vault should contain its local reference station.'},{id:'continue',label:'Archive the readings'}]},
  {id:'lagoon-report',speaker:'selene',title:'A living coast',text:'The lagoon record is safely archived. The turtle and ray routes match the older observations. Those pulses may be carrying a long-term habitat record, not just instrument noise.',choices:[{id:'drive',label:'What do we need next?',reply:'Ivo has released the Manta Dive Drive blueprint. Fabricate it at the outfitter if you want powered travel. Normal swimming remains enough to reach the limestone survey.'},{id:'continue',label:'Plan the next expedition'}]},
  {id:'array-report',speaker:'mara',title:'The Silent Array',text:'The vault was the local reference station. Your surveys restored its habitat record. We know what the launch was following now: a monitoring network that outlived its crew.',choices:[{id:'record',label:'What have we preserved?',reply:'Three districts, their wildlife observations and the complete station transect. Selene has the archive. Ivo will keep the instruments working. The follow-up contracts remain open.'},{id:'continue',label:'Close the first campaign record'}]},
  {id:'mara',speaker:'mara',title:'Expedition lead',text:'The sea gives us enough surprises. We keep a safe route home, bring every field record back, and leave the animals where we found them.',choices:[{id:'route',label:'Ask about the next bearing',reply:'The campaign record in the atlas tracks the unanswered transmission. Take one expedition at a time; you can choose separate research contracts between chapters.'},{id:'continue',label:'Return to the voyage'}]},
  {id:'ivo',speaker:'ivo',title:'Marine systems',text:'A useful instrument tells you what it knows and what it does not. A sonar fix is a bearing, not a completed reading. Get close and hold steady before recording a station.',choices:[{id:'gear',label:'Ask about equipment',reply:'The outfitter can improve your tank, fins and dive light. After the lagoon chapter, the earned Manta blueprint adds powered travel and a rechargeable battery.'},{id:'continue',label:'Return to the voyage'}]},
  {id:'selene',speaker:'selene',title:'Habitat research',text:'A photograph is a field observation, not a trophy. Approach gently, keep the animal visible, and bring back a record of its habitat as well as its shape.',choices:[{id:'samples',label:'Ask about the samples',reply:'The marked stations use sealed water and sediment containers. There is no reason to strip the reef for a research reward. The collection journal keeps the photographs you earn.'},{id:'continue',label:'Return to the voyage'}]},
];
export function newStory():StoryState { return {version:1,seen:[],decisions:{}}; }
export function sceneById(id:string) { return STORY_SCENES.find(scene=>scene.id===id); }
export function sanitizeStory(value:unknown):StoryState {
  if(value===undefined)return newStory();
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The story record is incomplete.');
  const item=value as Partial<StoryState>;
  if(item.version!==1||!Array.isArray(item.seen)||!item.decisions||typeof item.decisions!=='object'||Array.isArray(item.decisions))throw new Error('The story record is incomplete.');
  const seen=[...new Set(item.seen.filter(id=>typeof id==='string'&&!!sceneById(id)))],decisions:Record<string,string>={};
  for(const scene of STORY_SCENES){const choice=item.decisions[scene.id];if(seen.includes(scene.id)&&scene.choices.some(option=>option.id===choice&&!option.reply))decisions[scene.id]=choice;}
  return {version:1,seen,decisions};
}
export function storyAvailable(context:StoryContext,id:string):boolean {
  const r=context.expedition,c=context.voyage.completed;
  if(['mara','ivo','selene'].includes(id))return true;
  if(id==='welcome')return context.expeditions===0&&r.stage==='briefing'&&r.contractId==='bay-signal';
  if(id==='recorder')return r.contractId==='bay-signal'&&r.sensorRecovered;
  if(id==='bay-report')return c.includes('bay-signal');
  if(id==='lagoon-pulse')return r.contractId==='lagoon-echo'&&r.transectReadings.length===3;
  if(id==='lagoon-report')return c.includes('lagoon-echo');
  if(id==='array-report')return c.includes('passage-origin');
  if(id==='restoration-report')return c.includes('array-repair');
  return false;
}
export function nextStoryScene(context:StoryContext,excluded:readonly string[]=[]) {
  const seen=context.story?.seen??[];
  return STORY_SCENES.find(scene=>!['mara','ivo','selene'].includes(scene.id)&&!seen.includes(scene.id)&&!excluded.includes(scene.id)&&storyAvailable(context,scene.id));
}
export function completeStory<P extends StoryContext>(context:P,id:string,choiceId:string):P {
  const scene=sceneById(id),choice=scene?.choices.find(option=>option.id===choiceId&&!option.reply);
  if(!scene||!choice||!storyAvailable(context,id))throw new Error('This conversation is not available.');
  const next=structuredClone(context);next.story??=newStory();
  if(!next.story.seen.includes(id))next.story.seen.push(id);
  next.story.decisions[id]=choiceId;return next;
}
