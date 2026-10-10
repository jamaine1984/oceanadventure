import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=await build({stdin:{contents:"export * from './src/adaptive-resolution.ts';export * from './src/story-voice.ts';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {resolutionStep,StoryVoice,chooseStoryVoice}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('desktop Balanced trades resolution before falling below a smooth frame budget',()=>{assert.equal(resolutionStep(1,58,1,false).scale,.94);assert.equal(resolutionStep(.7,59.5,1,false).scale,.7);});
test('detail recovery requires three healthy samples and increases only slowly',()=>{let s={scale:.8,healthy:0};for(let n=0;n<2;n++)s=resolutionStep(s.scale,60,1,false,s.healthy);assert.equal(s.scale,.8);s=resolutionStep(s.scale,60,1,false,s.healthy);assert.equal(s.scale,.8150000000000001);assert.equal(s.healthy,0);});
test('noise resets recovery; constrained/mobile and invalid samples remain bounded',()=>{assert.equal(resolutionStep(.7,59,1,false,2).healthy,0);assert.equal(resolutionStep(.52,20,.8,true).scale,.52);assert.equal(resolutionStep(.8,60,.8,true,2).scale,.8);assert.equal(resolutionStep(.7,NaN,1,false).scale,.7);assert.equal(resolutionStep(.7,40,.8,true).scale,.7);});
const voice=(name,lang='en-US',localService=true)=>({name,lang,localService});
test('characters select English local voices before remote/default options',()=>{const voices=[voice('Remote Aria','en-US',false),voice('David'),voice('Zira'),voice('Hazel'),voice('French','fr-FR')];assert.equal(chooseStoryVoice(voices,'mara').name,'Zira');assert.equal(chooseStoryVoice(voices,'ivo').name,'David');assert.equal(chooseStoryVoice(voices,'selene').name,'Hazel');assert.equal(chooseStoryVoice([],'mara'),undefined);});
function harness(){
  globalThis.window=globalThis;globalThis.localStorage={getItem:()=>null,setItem:()=>{}};globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  const states=[],ducks=[],queue=[];let cancels=0;
  const synth={getVoices:()=>[voice('Zira'),voice('David'),voice('Hazel')],cancel:()=>cancels++,speak:u=>queue.push(u)};
  const controller=new StoryVoice(s=>states.push(s),s=>ducks.push(s),synth);
  return {controller,synth,states,ducks,queue,get cancels(){return cancels;}};
}
test('voice requires a gesture and never changes story/game progression',()=>{const h=harness();h.controller.speak('hello','mara');assert.equal(h.queue.length,0);assert.equal(h.states.at(-1),'gesture');h.controller.unlock();h.controller.speak('hello','mara');assert.equal(h.queue[0].text,'hello');h.controller.stop();});
test('speech ducks only after start; end and explicit stop restore music',()=>{const h=harness();h.controller.unlock();h.controller.speak('hello','ivo');h.queue[0].onstart();assert.equal(h.ducks.at(-1),true);h.queue[0].onend();assert.equal(h.ducks.at(-1),false);assert.equal(h.states.at(-1),'ready');h.controller.stop();});
test('old callbacks cannot unduck or override a newer line',()=>{const h=harness();h.controller.unlock();h.controller.speak('first','mara');const old=h.queue[0];h.controller.speak('second','selene');h.queue[1].onstart();old.onend();old.onerror();assert.equal(h.states.at(-1),'speaking');assert.equal(h.ducks.at(-1),true);h.controller.stop();assert.equal(h.ducks.at(-1),false);});
test('muting cancels and persists separately from music',()=>{const h=harness(),writes=[];globalThis.localStorage.setItem=(...p)=>writes.push(p);h.controller.unlock();h.controller.speak('hello','mara');h.controller.toggle();assert.equal(h.controller.enabled,false);assert.deepEqual(writes,[['ocean-adventure-voice','off']]);assert.equal(h.states.at(-1),'off');h.controller.speak('no','ivo');assert.equal(h.queue.length,1);});
test('unsupported or failing speech retains a usable unavailable state',()=>{const h=harness();h.controller.unlock();h.synth.speak=()=>{throw Error('disabled');};h.controller.speak('hello','mara');assert.equal(h.states.at(-1),'unavailable');assert.equal(h.ducks.at(-1),false);h.controller.stop();});
