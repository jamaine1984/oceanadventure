import { createElement, Map, Compass, BookOpen, Download, Upload, X, Flag, Trash2, Navigation, MapPin, CircleHelp, type IconNode } from 'lucide';
import { CONTRACTS, DISTRICTS, LANDMARKS, CLIENTS, CHART_BOUNDS, contractAvailable, districtUnlocked, nextStoryContract, contractById, type DistrictKey } from './voyage-catalog';
import { exportProgress, readProgressImport, recoveryArchives, researchDiscount, type PlayerProgress } from './progression';
import { waypointLocation, contractReputationReward } from './voyage-state';
import { layoutChartMarkers,chartMarkerHeight } from './chart-markers';
type AtlasView = 'chart' | 'contracts' | 'log' | 'saves';
const glyph=(icon:IconNode)=>createElement(icon,{width:20,height:20,'aria-hidden':'true'});
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
export class VoyageAtlas {
  readonly dialog=document.createElement('dialog');
  private view:AtlasView='chart';
  private district:DistrictKey='bay';
  private contents=element('div',undefined,'atlas__contents');
  private message=element('p',undefined,'atlas__message');
  private origin?:HTMLElement;
  private busy=false;
  private chartObserver?:ResizeObserver;
  constructor(private getProgress:()=>PlayerProgress,private position:()=>{x:number;z:number;yaw?:number},
    private canDepart:()=>boolean,private depart:(id:string)=>Promise<boolean>,
    private update:(next:PlayerProgress)=>boolean,private restore:(next:PlayerProgress)=>boolean,
    private changed:(open:boolean)=>void) {
    this.dialog.className='atlas';this.dialog.setAttribute('aria-labelledby','atlas-title');
    const header=element('header'),title=element('div');title.append(element('span','Ocean Adventure','hud__eyebrow'),element('h2','Voyage atlas'));title.querySelector('h2')!.id='atlas-title';
    const close=element('button');close.type='button';close.title='Close voyage atlas';close.setAttribute('aria-label','Close voyage atlas');close.append(glyph(X));close.onclick=()=>this.dialog.close();header.append(title,close);
    const nav=element('nav',undefined,'atlas__tabs');nav.setAttribute('aria-label','Voyage atlas views');
    for(const [id,label,icon] of [['chart','Chart',Map],['contracts','Contracts',Compass],['log','Campaign',BookOpen],['saves','Saves',Download]] as const){const button=element('button');button.type='button';button.dataset.atlasView=id;button.append(glyph(icon),document.createTextNode(label));button.onclick=()=>{this.view=id;this.render();this.contents.scrollTop=0;};nav.append(button);}
    this.message.setAttribute('role','status');this.dialog.append(header,nav,this.message,this.contents);document.querySelector('#game-root')!.append(this.dialog);
    this.dialog.addEventListener('cancel',event=>{if(this.busy)event.preventDefault();});
    this.dialog.addEventListener('close',()=>{
      this.chartObserver?.disconnect();this.changed(false);
      const visible=(node:HTMLElement)=>node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
      const target=this.origin&&visible(this.origin)?this.origin:Array.from(document.querySelectorAll<HTMLButtonElement>('[data-atlas-toggle],[data-action-menu-toggle]')).find(visible);target?.focus();
    });
  }
  get open(){return this.dialog.open;}
  show(view:AtlasView='chart'){if(this.open)return;this.origin=document.activeElement as HTMLElement;this.view=view;this.message.textContent='';this.render();this.contents.scrollTop=0;this.changed(true);this.dialog.showModal();}
  private button(label:string,handler:()=>void,icon?:IconNode){const button=element('button');button.type='button';if(icon)button.append(glyph(icon));button.append(document.createTextNode(label));button.onclick=handler;return button;}
  render(){
    this.chartObserver?.disconnect();
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-atlas-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.atlasView===this.view)));
    this.contents.replaceChildren();
    if(this.view==='chart')this.renderChart();else if(this.view==='contracts')this.renderContracts();else if(this.view==='log')this.renderLog();else this.renderSaves();
  }
  private commit(next:PlayerProgress){if(!this.update(next)){this.message.textContent='The change could not be saved. Your previous voyage is unchanged.';return false;}this.message.textContent='Voyage updated.';this.render();return true;}
  private renderChart(){
    const progress=this.getProgress(),state=progress.voyage,summary=element('div',undefined,'atlas__summary');
    summary.append(element('strong',`${state.discoveries.length}/${LANDMARKS.length} landmarks charted`),element('span',waypointLocation(state)?.name??'No active waypoint'));this.contents.append(summary);
    const north=element('span',undefined,'atlas__north');north.append(glyph(Compass),document.createTextNode('N'));summary.append(north);
    const chart=element('div',undefined,'atlas__chart'),canvas=element('canvas');canvas.width=1000;canvas.height=700;canvas.setAttribute('aria-label','Chart of the current research bay');chart.append(canvas);
    const ctx=canvas.getContext('2d')!,sx=(x:number)=>(x-CHART_BOUNDS.minX)/(CHART_BOUNDS.maxX-CHART_BOUNDS.minX)*1000,sz=(z:number)=>(z-CHART_BOUNDS.minZ)/(CHART_BOUNDS.maxZ-CHART_BOUNDS.minZ)*700;
    const point=this.position(),inside=point.x>=CHART_BOUNDS.minX&&point.x<=CHART_BOUNDS.maxX&&point.z>=CHART_BOUNDS.minZ&&point.z<=CHART_BOUNDS.maxZ;
    const markers:{id:string;x:number;z:number;button:HTMLButtonElement}[]=[];
    if(inside){const player=this.button('',()=>{this.message.textContent=`Your position: ${Math.round(point.x)} east / ${Math.round(-point.z)} north.`;},Navigation);player.className='atlas__marker';player.dataset.markerKind='player';player.setAttribute('aria-label','Your position');player.title='Your position';player.querySelector('svg')!.style.transform=`rotate(${(point.yaw??0)*180/Math.PI-45}deg)`;markers.push({id:'player',x:point.x,z:point.z,button:player});chart.append(player);}
    const places=[...LANDMARKS.map(place=>({...place,known:state.discoveries.includes(place.id)})),...state.pins.map(pin=>({...pin,known:true}))];
    for(const place of places){const personal=place.id.startsWith('pin-'),button=this.button('',()=>{if(!place.known){this.message.textContent='Sail closer to chart this landmark.';return;}const next=structuredClone(progress);next.voyage.activeWaypoint=place.id;if(this.commit(next))this.message.textContent=`Course set: ${place.name}.`;},personal?Flag:place.known?MapPin:CircleHelp);button.className='atlas__marker';button.dataset.markerKind=personal?'pin':place.known?'known':'unknown';button.dataset.chartMarker=place.id;button.title=place.known?place.name:'Uncharted landmark';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(place.id===state.activeWaypoint));markers.push({id:place.id,x:place.x,z:place.z,button});chart.append(button);}
    const draw=()=>{
      const width=chart.clientWidth,height=chart.clientHeight;if(width<44||height<44)return;
      const capacity=chartMarkerHeight(markers.length,width),required=Math.max(240,capacity+chart.offsetHeight-chart.clientHeight);if(chart.style.minHeight!==`${required}px`)chart.style.minHeight=`${required}px`;if(height<capacity)return;
      ctx.fillStyle='#0d343e';ctx.fillRect(0,0,1000,700);ctx.lineWidth=1;ctx.strokeStyle='#244c55';
      for(let x=0;x<=1000;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,700);ctx.stroke();}for(let y=0;y<=700;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}
      for(const district of DISTRICTS){ctx.strokeStyle=district.color;ctx.fillStyle=district.color+'18';ctx.beginPath();ctx.ellipse(sx(district.x),sz(district.z),district.radius/(CHART_BOUNDS.maxX-CHART_BOUNDS.minX)*1000,district.radius/(CHART_BOUNDS.maxZ-CHART_BOUNDS.minZ)*700,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.fillStyle='#a9b798';ctx.beginPath();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,r=33+Math.sin(a*3+.6)*3.2+Math.cos(a*7)*1.5-Math.exp(-Math.pow(((a>Math.PI?a-Math.PI*2:a)+1.15)/.28,2))*6;const x=sx(-53+Math.cos(a)*r),y=sz(43+Math.sin(a)*r/.91);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();
      const target=waypointLocation(state);if(target&&inside){ctx.strokeStyle='#e4c983';ctx.lineWidth=1000/width;ctx.setLineDash([12,8]);ctx.beginPath();ctx.moveTo(sx(point.x),sz(point.z));ctx.lineTo(sx(target.x),sz(target.z));ctx.stroke();ctx.setLineDash([]);}
      const placed=layoutChartMarkers(markers.map(marker=>({id:marker.id,x:sx(marker.x)/1000*width,y:sz(marker.z)/700*height})),width,height);
      placed.forEach((display,index)=>{const marker=markers[index];marker.button.style.left=`${display.x/width*100}%`;marker.button.style.top=`${display.y/height*100}%`;ctx.strokeStyle='#6e9599';ctx.lineWidth=1000/width;ctx.beginPath();ctx.moveTo(sx(marker.x),sz(marker.z));ctx.lineTo(display.x/width*1000,display.y/height*700);ctx.stroke();ctx.fillStyle=marker.id==='player'?'#8bdfdf':'#aec5bb';ctx.beginPath();ctx.arc(sx(marker.x),sz(marker.z),3*1000/width,0,Math.PI*2);ctx.fill();});
    };
    this.chartObserver=new ResizeObserver(draw);this.chartObserver.observe(chart);
    this.contents.append(chart);
    const legend=element('div',undefined,'atlas__legend');for(const district of DISTRICTS){const item=element('span'),swatch=element('i');swatch.style.background=district.color;item.append(swatch,document.createTextNode(district.name));legend.append(item);}this.contents.append(legend);
    const landmarks=element('div',undefined,'atlas__landmarks');for(const place of LANDMARKS){const known=state.discoveries.includes(place.id),row=element('div');row.append(element('span',known?place.name:'Uncharted landmark'),element('small',known?'Charted':'Not visited'));landmarks.append(row);}this.contents.append(landmarks);
    const actions=element('div',undefined,'atlas__actions');
    const mark=this.button('Mark current location',()=>{if(state.pins.length>=12){this.message.textContent='Twelve pins already charted. Remove a pin before adding another.';return;}const next=structuredClone(progress);next.voyage.pins.push({id:`pin-${crypto.randomUUID()}`,x:point.x,z:point.z,name:`Waypoint ${state.pins.length+1}`});this.commit(next);},Flag);
    mark.disabled=point.x<CHART_BOUNDS.minX||point.x>CHART_BOUNDS.maxX||point.z<CHART_BOUNDS.minZ||point.z>CHART_BOUNDS.maxZ;if(mark.disabled)mark.title='Position is outside the current research chart';actions.append(mark);
    const clear=this.button('Clear course',()=>{const next=structuredClone(progress);next.voyage.activeWaypoint=undefined;this.commit(next);},X);clear.disabled=!state.activeWaypoint;actions.append(clear);this.contents.append(actions);
    if(state.pins.length){const list=element('div',undefined,'atlas__pins');for(const pin of state.pins){const row=element('div'),name=element('input');name.value=pin.name;name.maxLength=36;name.setAttribute('aria-label','Waypoint name');name.onchange=()=>{const next=structuredClone(this.getProgress()),target=next.voyage.pins.find(item=>item.id===pin.id);if(target){target.name=name.value.replace(/[<>\x00-\x1f]/g,'').trim().slice(0,36)||'Waypoint';this.commit(next);}};const remove=this.button('',()=>{const next=structuredClone(this.getProgress());next.voyage.pins=next.voyage.pins.filter(item=>item.id!==pin.id);if(next.voyage.activeWaypoint===pin.id)next.voyage.activeWaypoint=undefined;this.commit(next);},Trash2);remove.setAttribute('aria-label',`Remove ${pin.name}`);remove.title=`Remove ${pin.name}`;row.append(name,remove);list.append(row);}this.contents.append(list);}
  }
  private renderContracts(){
    const progress=this.getProgress(),state=progress.voyage,filters=element('div',undefined,'atlas__filters');
    for(const district of DISTRICTS){const button=this.button(district.name,()=>{this.district=district.id;this.render();});button.setAttribute('aria-pressed',String(this.district===district.id));filters.append(button);}this.contents.append(filters);
    const district=DISTRICTS.find(item=>item.id===this.district)!;this.contents.append(element('p',district.description,'atlas__description'));
    if(!districtUnlocked(this.district,state.completed)){const required=contractById(district.requires);this.contents.append(element('p',`Complete ${required?.title} to unlock these contracts.`,'atlas__locked'));}
    const list=element('div',undefined,'atlas__contracts');
    for(const contract of CONTRACTS.filter(item=>item.district===this.district)){
      const article=element('article',undefined,'atlas__contract'),head=element('div',undefined,'atlas__contract-head');
      head.append(element('span',contract.story?`Campaign ${contract.story}/${CONTRACTS.filter(item=>item.story).length}`:contract.family),element('span',`${CLIENTS[contract.client].name} / +${contractReputationReward(contract,state.completed)} reputation`));
      article.append(head,element('h3',contract.title),element('p',contract.briefing));
      const objectives=[contract.photoGoal?`${contract.photoGoal} photographs`:null,contract.samples?'2 samples':null,contract.readings?'3 readings':null,contract.recovery?'Sensor recovery':null,contract.repair?'3 isolated circuits':null,contract.interior?'Freighter entry, latch, cassette and separate exit':null,contract.remote?'ROV / 3 terminal archives':null].filter(Boolean);
      article.append(element('small',objectives.join(' / ')));
      const completed=state.completions[contract.id]??0,active=progress.expedition.contractId===contract.id&&!progress.expedition.sold,available=contractAvailable(contract,state.completed);
      const action=this.button(active?'Active expedition':!available?'Locked':completed?`Repeat / ${completed} completed`:'Accept contract',()=>{void this.accept(contract.id);},Compass);action.dataset.acceptContract=contract.id;
      if(contract.remote&&!progress.rov?.owned)action.textContent='Sentry ROV required';
      action.disabled=this.busy||active||!available||!!contract.remote&&!progress.rov?.owned||!this.canDepart()||!progress.expedition.sold&&progress.expedition.stage!=='briefing';
      article.append(action);list.append(article);
    }
    this.contents.append(list);if(!this.canDepart())this.contents.append(element('p','Contracts can be accepted at the research harbor.','atlas__locked'));else if(!progress.expedition.sold&&progress.expedition.stage!=='briefing')this.contents.append(element('p','Finish and sell your active expedition before accepting another.','atlas__locked'));
  }
  private async accept(id:string){if(this.busy)return;this.busy=true;this.render();try{if(await this.depart(id))this.dialog.close();else this.message.textContent='Departure could not be saved. Your current expedition is unchanged.';}finally{this.busy=false;if(this.open)this.render();}}
  private renderLog(){
    const state=this.getProgress().voyage,story=CONTRACTS.filter(contract=>contract.story).sort((a,b)=>a.story-b.story),next=nextStoryContract(state.completed);
    this.contents.append(element('h3','The Silent Array'),element('p',next?`Next chapter: ${next.title}`:'Campaign complete. Follow-up contracts remain available.','atlas__description'));
    const list=element('div',undefined,'atlas__log');
    for(const contract of story){const completed=state.completed.includes(contract.id),known=completed||contractAvailable(contract,state.completed);const entry=element('article');entry.append(element('span',`Chapter ${contract.story} / ${completed?'Archived':known?'Available':'Unresolved'}`),element('h3',known?contract.title:'Unresolved transmission'),element('p',completed?contract.debrief:known?contract.briefing:'The previous expedition must resolve this bearing.'));if(completed&&contract.blueprint)entry.append(element('small',contract.blueprint==='survey-anchor'?'Blueprint archived: survey anchor':'Blueprint archived: scooter drive'));list.append(entry);}this.contents.append(list);
    const reputation=element('div',undefined,'atlas__reputation');for(const [id,client]of Object.entries(CLIENTS)){const row=element('div');row.append(element('strong',client.name),element('span',client.role),element('b',`${state.reputation[id as keyof typeof CLIENTS]} reputation`));reputation.append(row);}const discount=researchDiscount(this.getProgress());this.contents.append(element('h3','Research partners'),reputation,element('p',`${Math.round(discount*100)}% outfitter discount / ${discount>=.12?'maximum research tier':`next tier at ${50-(Object.values(state.reputation).reduce((sum,value)=>sum+value,0)%50)} more reputation`}`,'atlas__description'));
  }
  private renderSaves(){
    const progress=this.getProgress();this.contents.append(element('h3','Your voyage, protected'),element('p',`${progress.expeditions} expeditions / ${progress.credits.toLocaleString()} credits / ${progress.voyage.completed.length} contracts logged`,'atlas__description'));
    const actions=element('div',undefined,'atlas__actions');
    actions.append(this.button('Export voyage',()=>{const url=URL.createObjectURL(new Blob([exportProgress(progress)],{type:'application/json'})),link=element('a');link.href=url;link.download=`ocean-adventure-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.message.textContent='Voyage exported.';},Download));
    const input=element('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.dataset.voyageImport='';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('This save file is too large.');const next=readProgressImport(await file.text());this.confirmRestore(next);}catch(error){this.message.textContent=error instanceof Error?error.message:'The save file could not be read.';}finally{input.value='';}};
    actions.append(this.button('Import voyage',()=>input.click(),Upload),input);this.contents.append(actions);
    const backups=recoveryArchives();this.contents.append(element('h3','Recovery checkpoints'));if(!backups.length)this.contents.append(element('p','No recovery checkpoint yet. A checkpoint is recorded after your next successful save.'));
    for(const archive of backups){let checkpoint:PlayerProgress;try{checkpoint=readProgressImport(JSON.stringify(archive));}catch{continue;}const count=`${checkpoint.expeditions} expedition${checkpoint.expeditions===1?'':'s'}`,row=element('div',undefined,'atlas__backup'),summary=element('div');summary.append(element('strong',`${checkpoint.credits.toLocaleString()} credits / ${count}`),element('span',new Date(archive.exportedAt).toLocaleString()));row.append(summary);const restore=this.button('Review recovery',()=>this.confirmRestore(checkpoint));restore.setAttribute('aria-label',`Review recovery with ${checkpoint.credits} credits and ${count}`);row.append(restore);this.contents.append(row);}
  }
  private confirmRestore(next:PlayerProgress){
    this.contents.replaceChildren();this.contents.append(element('h3','Replace this voyage?'),element('p',`Imported voyage: ${next.expeditions} expeditions, ${next.credits.toLocaleString()} credits, ${next.voyage.completed.length} contracts. Your current voyage will be retained as a recovery checkpoint. The game will reload.`,'atlas__description'));
    const actions=element('div',undefined,'atlas__actions');actions.append(this.button('Restore and reload',()=>{if(!this.restore(next))this.message.textContent='Restore failed. Your current voyage has not been replaced.';},Upload),this.button('Cancel',()=>this.render(),X));this.contents.append(actions);
  }
}
