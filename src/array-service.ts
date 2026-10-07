import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createElement, X } from 'lucide';
import { ARRAY_SITE, ARRAY_SOURCES, ARRAY_RECEIVERS, circuitDiagnostics, type ArrayCircuit } from './array-repair';

export class ArrayService {
  readonly dialog=document.createElement('dialog');
  readonly root=new T.Group();
  readonly position:T.Vector3;
  loaded=false;
  private loading?:Promise<void>;
  private retryAt=0;
  private lamp?:T.MeshStandardMaterial;
  private restored?:boolean;
  private cabinet:T.Box3;
  private circuits:ArrayCircuit[]=[];
  private diagnostics:boolean[]=[];
  private content=document.createElement('div');
  private status=document.createElement('p');
  private busy=false;
  private origin?:HTMLElement;
  constructor(scene:T.Scene,floor:number,private finish:(circuits:readonly ArrayCircuit[])=>boolean,private changed:(open:boolean)=>void){
    this.root.name='Authored array service station';this.root.position.set(ARRAY_SITE.x,floor,ARRAY_SITE.z);scene.add(this.root);
    this.position=new T.Vector3(ARRAY_SITE.x,floor+1.8,ARRAY_SITE.z+1.65);
    this.cabinet=new T.Box3(new T.Vector3(ARRAY_SITE.x-1.35,floor+.65,ARRAY_SITE.z-.95),new T.Vector3(ARRAY_SITE.x+1.35,floor+2.95,ARRAY_SITE.z+.57));
    this.dialog.className='array-service';this.dialog.dataset.arrayService='';this.dialog.setAttribute('aria-labelledby','array-service-title');
    const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.id='array-service-title';title.textContent='Array commissioning';close.type='button';close.title='Close service panel';close.setAttribute('aria-label',close.title);close.append(createElement(X,{width:20,height:20,'aria-hidden':'true'}));close.onclick=()=>this.close();header.append(title,close);
    const description=document.createElement('p');description.textContent='Ivo: The cabinet is isolated. Match the receiver plate frequencies and polarities before bringing the feed online.';
    this.status.setAttribute('role','status');this.status.className='array-service__status';this.dialog.append(header,description,this.content,this.status);document.querySelector('#game-root')!.append(this.dialog);
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>{this.changed(false);if(this.origin?.getClientRects().length)this.origin.focus();});
  }
  get open(){return this.dialog.open;}
  async load(){
    if(this.loaded)return;if(this.loading)return this.loading;
    this.loading=new GLTFLoader().loadAsync('/models/array_service_station.glb').then(asset=>{this.root.add(asset.scene);asset.scene.traverse(node=>{if(node instanceof T.Mesh&&node.name==='Array_finish_Array_standby_lamp'&&node.material instanceof T.MeshStandardMaterial)this.lamp=node.material;});this.loaded=true;}).catch(error=>{this.retryAt=performance.now()+10000;throw error;}).finally(()=>{this.loading=undefined;});return this.loading;
  }
  update(position:T.Vector3,restored:boolean){
    this.root.visible=position.distanceToSquared(this.root.position)<180*180;
    if(this.root.visible&&!this.loaded&&!this.loading&&performance.now()>=this.retryAt)void this.load().catch(()=>{});
    if(this.lamp&&this.restored!==restored){this.lamp.color.set(restored?0x49be96:0xed642b);this.lamp.emissive.copy(this.lamp.color);this.restored=restored;}
  }
  resolveDiver(position:T.Vector3,previous:T.Vector3){if(!this.loaded||!this.cabinet.containsPoint(position))return;if(!this.cabinet.containsPoint(previous))position.copy(previous);else position.z=this.cabinet.max.z+.01;}
  show(){if(this.open||!this.loaded)return;this.origin=document.activeElement instanceof HTMLElement?document.activeElement:undefined;this.circuits=ARRAY_RECEIVERS.map(()=>({source:0,reversed:false}));this.diagnostics=[];this.status.textContent='Feed isolated';this.render();this.dialog.showModal();this.changed(true);}
  close(){if(!this.busy)this.dialog.close();}
  private render(){
    this.content.replaceChildren();
    const list=document.createElement('div');list.className='array-service__circuits';
    ARRAY_RECEIVERS.forEach((receiver,index)=>{
      const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${receiver.name} / ${receiver.hz} Hz / ${receiver.reversed?'reversed':'normal'}`;row.append(legend);
      const label=document.createElement('label'),select=document.createElement('select');label.textContent='Source';select.setAttribute('aria-label',`${receiver.name} source`);
      ARRAY_SOURCES.forEach((source,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${source.name} / ${source.hz} Hz`;select.append(option);});select.value=String(this.circuits[index].source);select.onchange=()=>{this.circuits[index].source=Number(select.value);this.invalidate();};label.append(select);
      const polarity=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=this.circuits[index].reversed;check.setAttribute('aria-label',`${receiver.name} reversed polarity`);check.onchange=()=>{this.circuits[index].reversed=check.checked;this.invalidate();};polarity.append(check,document.createTextNode('Reverse polarity'));
      const lamp=document.createElement('output');lamp.textContent=this.diagnostics.length?(this.diagnostics[index]?'Verified':'Fault'):'Untested';lamp.dataset.circuitLamp=String(index);lamp.className=this.diagnostics[index]?'is-verified':'';row.append(label,polarity,lamp);list.append(row);
    });
    const actions=document.createElement('div');actions.className='array-service__actions';
    const test=document.createElement('button');test.type='button';test.textContent='Test isolated circuits';test.onclick=()=>{this.diagnostics=circuitDiagnostics(this.circuits);this.status.textContent=this.diagnostics.every(Boolean)?'All channels verified. Feed ready.':'Verification failed. Feed remains isolated.';this.render();this.content.querySelector<HTMLButtonElement>('[data-commission-array]')?.focus();};
    const restore=document.createElement('button');restore.type='button';restore.textContent='Restore array feed';restore.dataset.commissionArray='';restore.disabled=!this.diagnostics.length||!this.diagnostics.every(Boolean)||this.busy;restore.onclick=()=>{if(this.busy)return;this.busy=true;try{if(this.finish(this.circuits)){this.busy=false;this.dialog.close();}else this.status.textContent='Commissioning could not be saved. Feed remains isolated; retry.';}catch{this.status.textContent='Commissioning failed. Your expedition is unchanged.';}finally{this.busy=false;}};actions.append(test,restore);this.content.append(list,actions);
  }
  private invalidate(){this.diagnostics=[];this.status.textContent='Circuit changed. Feed isolated.';this.content.querySelector<HTMLButtonElement>('[data-commission-array]')!.disabled=true;this.content.querySelectorAll<HTMLOutputElement>('[data-circuit-lamp]').forEach(lamp=>{lamp.textContent='Untested';lamp.className='';});}
}
