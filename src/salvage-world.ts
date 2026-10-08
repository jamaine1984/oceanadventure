import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FIELD_POSTS,SALVAGE_CACHES,cacheAvailable,type SalvageProgress} from './salvage';
import type {ScanIdentification} from './scan-identification';
export class SalvageWorld{
  readonly root=new T.Group();loaded=false;private loading?:Promise<void>;private retryAt=0;
  private caches=new Map<string,T.Object3D>();private colliders=new Map<string,RAPIER.Collider>();private pod?:T.Object3D;private buoy?:T.Object3D;private cable?:T.Line;private podBody?:RAPIER.Collider;private lamp?:T.MeshStandardMaterial;
  private physics?:RAPIER.World;private controller?:RAPIER.KinematicCharacterController;private diver?:RAPIER.Collider;private rov?:RAPIER.Collider;private prone=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);private rotation=new T.Quaternion();
  constructor(scene:T.Scene,readonly floor:(x:number,z:number)=>number,private surface?:T.Texture){this.root.name='Reclaimed field equipment';scene.add(this.root);}
  async load(){if(this.loaded)return;if(this.loading)return this.loading;this.loading=new GLTFLoader().loadAsync('/models/calypso_field_kit.glb').then(g=>this.attach(g.scene)).catch(e=>{this.retryAt=performance.now()+10000;throw e;}).finally(()=>{this.loading=undefined;});return this.loading;}
  attach(asset:T.Group){
    const prototypes=new Map<string,T.Object3D>();asset.traverse(n=>{for(const name of ['Calypso_pod','Calypso_buoy','Supply_alloy','Supply_copper','Supply_cell'])if(n.name===name)prototypes.set(name,n);if(n instanceof T.Mesh&&n.material instanceof T.MeshStandardMaterial){if(n.material.name==='Calypso enamel'&&this.surface){n.material.map=this.surface;n.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec3 originalPaint = diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb = mix(originalPaint, diffuseColor.rgb, 0.16);');};n.material.customProgramCacheKey=()=> 'calypso-enamel-v1';}if(n.material.name==='Calypso status')this.lamp=n.material;}});
    if(prototypes.size!==5)throw Error('The field kit is missing an authored component.');
    this.physics=new RAPIER.World({x:0,y:0,z:0});this.controller=this.physics.createCharacterController(.015);this.controller.disableAutostep();this.controller.disableSnapToGround();this.controller.setApplyImpulsesToDynamicBodies(false);
    this.diver=this.physics.createCollider(RAPIER.ColliderDesc.capsule(.55,.36).setSensor(true));this.rov=this.physics.createCollider(RAPIER.ColliderDesc.ball(1.12).setSensor(true));
    for(const c of SALVAGE_CACHES){const model=prototypes.get(`Supply_${c.material}`)!.clone(true);model.position.set(c.x,this.floor(c.x,c.z),c.z);model.visible=false;this.root.add(model);this.caches.set(c.id,model);const collider=this.physics.createCollider(RAPIER.ColliderDesc.cuboid(c.material==='alloy'?.85:.65,c.material==='copper'?.60:.46,.52).setTranslation(c.x,model.position.y+(c.material==='copper'?.6:.42),c.z));collider.setEnabled(false);this.colliders.set(c.id,collider);}
    this.pod=prototypes.get('Calypso_pod')!.clone(true);this.buoy=prototypes.get('Calypso_buoy')!.clone(true);this.pod.visible=this.buoy.visible=false;this.root.add(this.pod,this.buoy);
    this.podBody=this.physics.createCollider(RAPIER.ColliderDesc.cuboid(1.95,1.12,.83));this.podBody.setEnabled(false);
    this.cable=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0x92a9a6}));this.cable.visible=false;this.root.add(this.cable);this.physics.step();this.loaded=true;
  }
  update(p:SalvageProgress,position:T.Vector3,time:number,surface:(x:number,z:number,time:number)=>number){
    const relevant=p.voyage.completed.includes('bay-signal')&&FIELD_POSTS.some(s=>Math.hypot(position.x-s.x,position.z-s.z)<(p.salvage?.pod.site===s.id?170:100));
    if(relevant&&!this.loaded&&!this.loading&&performance.now()>=this.retryAt)void this.load().catch(()=>{});if(!this.loaded)return;
    for(const c of SALVAGE_CACHES){const enabled=cacheAvailable(p,c.id),model=this.caches.get(c.id)!;model.visible=enabled&&Math.hypot(position.x-c.x,position.z-c.z)<100;this.colliders.get(c.id)!.setEnabled(enabled);}
    const site=FIELD_POSTS.find(s=>s.id===p.salvage?.pod.site);this.pod!.visible=this.buoy!.visible=this.cable!.visible=!!site;
    this.podBody!.setEnabled(!!site);
    if(site){const y=this.floor(site.x,site.z);this.pod!.position.set(site.x,y,site.z);this.podBody!.setTranslation({x:site.x,y:y+1.12,z:site.z});this.buoy!.position.set(site.x,surface(site.x,site.z,time),site.z);const a=this.cable!.geometry.attributes.position as T.BufferAttribute;a.setXYZ(0,site.x,y+2.1,site.z);a.setXYZ(1,site.x,this.buoy!.position.y-.25,site.z);a.needsUpdate=true;this.cable!.geometry.computeBoundingSphere();this.lamp?.emissive.set((p.salvage?.pod.air??0)+(p.salvage?.pod.energy??0)>0?0x22a969:0xc05b0b);}
  }
  contacts(p:SalvageProgress,position:T.Vector3):ScanIdentification[]{
    const targets=SALVAGE_CACHES.filter(c=>cacheAvailable(p,c.id)).map(c=>({id:c.id,name:c.name,x:c.x,y:this.floor(c.x,c.z)+.7,z:c.z,note:`Reclaimable research supplies / ${c.amount} units. Wildlife and active instruments are not salvage.`,action:'Cutter / release the marked supply case'}));
    const site=FIELD_POSTS.find(s=>s.id===p.salvage?.pod.site);if(site)targets.push({id:'calypso-service',name:'Calypso Survey Anchor',x:site.x,y:this.floor(site.x,site.z)+2.8,z:site.z+3,note:`Air ${p.salvage!.pod.air}/400 / power ${p.salvage!.pod.energy}/300`,action:'Service / replenish at the connector plate'});
    return targets.map(t=>({...t,kind:'Research instrument' as const,distance:Math.hypot(t.x-position.x,t.y-position.y,t.z-position.z),bearing:Math.atan2(t.x-position.x,-(t.z-position.z)),vertical:t.y-position.y})).filter(t=>t.distance<=65).sort((a,b)=>a.distance-b.distance);
  }
  resolve(position:T.Vector3,previous:T.Vector3,orientation?:T.Quaternion){if(!this.loaded)return;const body=orientation?this.diver!:this.rov!;if(orientation){this.rotation.copy(orientation).multiply(this.prone);body.setRotation(this.rotation);}body.setTranslation(previous);this.physics!.step();this.controller!.computeColliderMovement(body,{x:position.x-previous.x,y:position.y-previous.y,z:position.z-previous.z},RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);const m=this.controller!.computedMovement();position.set(previous.x+m.x,previous.y+m.y,previous.z+m.z);}
  dispose(){this.physics?.free();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.root.traverse(n=>{if(n instanceof T.Mesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.cable?.geometry.dispose();(this.cable?.material as T.Material|undefined)?.dispose();this.root.removeFromParent();}
}
