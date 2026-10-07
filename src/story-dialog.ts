import { createElement, X, Radio } from 'lucide';
import { CLIENTS } from './voyage-catalog';
import { nextStoryScene, sceneById, storyAvailable, type Speaker, type StoryContext, type StoryScene } from './story-state';
const portraits:Record<Speaker,string>={mara:new URL('../assets/concepts/full-game-v1/mara-velez.png',import.meta.url).href,ivo:new URL('../assets/concepts/full-game-v1/ivo-chen.png',import.meta.url).href,selene:new URL('../assets/concepts/full-game-v1/selene-okoro.png',import.meta.url).href};
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string){const result=document.createElement(tag);if(text)result.textContent=text;if(className)result.className=className;return result;}
export class StoryDialog {
  readonly dialog=node('dialog',undefined,'story-radio');
  private scene?:StoryScene;private origin?:HTMLElement;private reply?:string;private busy=false;
  private dismissed=new Set<string>();
  private content=node('div',undefined,'story-radio__content');private status=node('p',undefined,'story-radio__status');
  constructor(private progress:()=>StoryContext,private finish:(id:string,choice:string)=>Promise<boolean>,private changed:(open:boolean)=>void){
    this.dialog.setAttribute('aria-labelledby','story-radio-title');this.dialog.dataset.storyDialog='';
    const header=node('header'),label=node('span','Expedition radio');label.prepend(createElement(Radio,{width:16,height:16,'aria-hidden':'true'}));
    const close=node('button');close.type='button';close.title='Close conversation';close.setAttribute('aria-label','Close conversation');close.append(createElement(X,{width:20,height:20,'aria-hidden':'true'}));close.onclick=()=>this.close();header.append(label,close);
    const nav=node('nav');nav.setAttribute('aria-label','Research partners');
    for(const [id,name]of [['mara','Mara'],['ivo','Ivo'],['selene','Selene']]as const){const button=node('button',name);button.type='button';button.dataset.storyPartner=id;button.onclick=()=>this.show(id);nav.append(button);}
    this.status.setAttribute('role','status');this.dialog.append(header,nav,this.content,this.status);document.querySelector('#game-root')!.append(this.dialog);
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>{this.changed(false);const visible=(el:HTMLElement)=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';const target=this.origin&&visible(this.origin)?this.origin:Array.from(document.querySelectorAll<HTMLButtonElement>('[data-story-toggle],[data-action-menu-toggle]')).find(visible);target?.focus();});
  }
  get open(){return this.dialog.open;}
  poll(){if(!this.open){const scene=nextStoryScene(this.progress(),[...this.dismissed]);if(scene)this.show(scene.id);}}
  show(id?:string){
    if(this.busy)return;const scene=id?sceneById(id):nextStoryScene(this.progress())??sceneById('mara');
    if(!scene||!storyAvailable(this.progress(),scene.id))return;
    if(this.open&&this.scene)this.dismissed.add(this.scene.id);
    this.scene=scene;this.reply=undefined;this.status.textContent='';
    if(!this.open){this.origin=document.activeElement instanceof HTMLButtonElement?document.activeElement:undefined;this.dialog.showModal();this.changed(true);}
    this.render();this.content.querySelector<HTMLButtonElement>('button')?.focus();
  }
  close(){if(!this.busy){if(this.scene)this.dismissed.add(this.scene.id);this.dialog.close();}}
  private render(){
    if(!this.scene)return;const scene=this.scene,speaker=CLIENTS[scene.speaker];this.content.replaceChildren();
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-story-partner]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.storyPartner===scene.speaker));button.disabled=this.busy;});
    const body=node('div',undefined,'story-radio__body'),portrait=node('div',undefined,'story-radio__portrait'),image=node('img');image.src=portraits[scene.speaker];image.alt=speaker.name;portrait.append(image);
    const copy=node('div');copy.append(node('small',speaker.name.toUpperCase()));const title=node('h2',scene.title);title.id='story-radio-title';copy.append(title,node('p',this.reply??scene.text));body.append(portrait,copy);this.content.append(body);
    const choices=node('div',undefined,'story-radio__choices');
    for(const choice of scene.choices){if(this.reply&&choice.reply)continue;const button=node('button',choice.label);button.type='button';button.dataset.storyChoice=choice.id;button.disabled=this.busy;button.onclick=async()=>{
      if(this.busy)return;if(choice.reply){this.reply=choice.reply;this.render();this.content.querySelector<HTMLButtonElement>('button')?.focus();return;}
      this.busy=true;this.render();try{if(await this.finish(scene.id,choice.id)){this.busy=false;this.dialog.close();}else this.status.textContent='The conversation could not be saved. Your voyage is unchanged. Allow storage, then retry.';}
      catch{this.status.textContent='The conversation could not be saved. Your voyage is unchanged.';}
      finally{this.busy=false;if(this.open){this.render();this.content.querySelector<HTMLButtonElement>(`[data-story-choice="${choice.id}"]`)?.focus();}}
    };choices.append(button);}
    if(this.reply){const back=node('button','Back');back.type='button';back.disabled=this.busy;back.onclick=()=>{this.reply=undefined;this.render();};choices.append(back);}this.content.append(choices);
  }
}
