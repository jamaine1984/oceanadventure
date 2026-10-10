import type {Speaker} from './story-state';
export type VoiceState='off'|'ready'|'gesture'|'speaking'|'unavailable';
const profiles={mara:{names:/zira|jenny|aria|samantha/i,rate:.94,pitch:1},ivo:{names:/david|guy|daniel|alex/i,rate:.98,pitch:.92},selene:{names:/hazel|sonia|susan|karen/i,rate:.92,pitch:.96}};
export function chooseStoryVoice(voices:SpeechSynthesisVoice[],speaker:Speaker) {
  const english=voices.filter(v=>/^en\b/i.test(v.lang));
  const local=english.filter(v=>v.localService),pool=local.length?local:english;
  return pool.find(v=>profiles[speaker].names.test(v.name))??pool[['mara','ivo','selene'].indexOf(speaker)%Math.max(1,pool.length)];
}
export class StoryVoice {
  enabled=true;private unlocked=false;private generation=0;private timer=0;
  private utterance?:SpeechSynthesisUtterance;
  constructor(private state:(state:VoiceState)=>void,private duck:(talking:boolean)=>void,private synth:SpeechSynthesis|undefined=globalThis.speechSynthesis) {
    try{this.enabled=localStorage.getItem('ocean-adventure-voice')!=='off';}catch{}
  }
  unlock(){const first=!this.unlocked;this.unlocked=true;return first;}
  toggle(){this.enabled=!this.enabled;try{localStorage.setItem('ocean-adventure-voice',this.enabled?'on':'off');}catch{}this.stop();return this.enabled;}
  stop(){++this.generation;clearTimeout(this.timer);this.utterance=undefined;try{this.synth?.cancel();}catch{}this.duck(false);this.state(this.enabled?'ready':'off');}
  speak(text:string,speaker:Speaker){
    this.stop();if(!this.enabled)return;
    if(!this.synth||typeof SpeechSynthesisUtterance==='undefined'){this.state('unavailable');return;}
    if(!this.unlocked){this.state('gesture');return;}
    const token=this.generation,utterance=new SpeechSynthesisUtterance(text),profile=profiles[speaker];
    this.utterance=utterance;utterance.lang='en-US';utterance.rate=profile.rate;utterance.pitch=profile.pitch;utterance.volume=1;
    try{utterance.voice=chooseStoryVoice(this.synth.getVoices(),speaker)??null;}catch{this.state('unavailable');return;}
    const finish=(state:VoiceState)=>{if(token!==this.generation)return;clearTimeout(this.timer);this.utterance=undefined;this.duck(false);this.state(state);};
    utterance.onstart=()=>{if(token!==this.generation)return;clearTimeout(this.timer);this.duck(true);this.state('speaking');this.timer=window.setTimeout(()=>{if(token===this.generation){this.stop();this.state('unavailable');}},90000);};
    utterance.onend=()=>finish('ready');utterance.onerror=()=>finish('unavailable');
    this.state('ready');this.timer=window.setTimeout(()=>{if(token===this.generation){this.stop();this.state('unavailable');}},8000);
    try{this.synth.speak(utterance);}catch{finish('unavailable');}
  }
}
