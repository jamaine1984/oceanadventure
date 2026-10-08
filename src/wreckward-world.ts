import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REACH_SITE } from './wreckward';
export class WreckwardWorld {
  readonly root=new T.Group();loaded=false;
  private loading?:Promise<void>;private retryAt=0;
  private physics?:RAPIER.World;private controller?:RAPIER.KinematicCharacterController;private body?:RAPIER.Collider;
  private lamp?:T.MeshStandardMaterial;private recovered?:boolean;
  private prone=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);private orientation=new T.Quaternion();
  constructor(scene:T.Scene,readonly floor:number){this.root.name='Wreckward Reach authored freighter';this.root.position.set(REACH_SITE.x,floor,REACH_SITE.z);scene.add(this.root);}
  async load(){
    if(this.loaded)return;if(this.loading)return this.loading;
    this.loading=new GLTFLoader().loadAsync('/models/wreckward_freighter.glb').then(asset=>this.attach(asset.scene)).catch(error=>{this.retryAt=performance.now()+10000;throw error;}).finally(()=>{this.loading=undefined;});return this.loading;
  }
  attach(asset:T.Group){
      if(this.loaded)throw new Error('Freighter already loaded.');this.root.add(asset);this.root.updateMatrixWorld(true);
      const physics=new RAPIER.World({x:0,y:0,z:0});const bounds=new T.Box3(),size=new T.Vector3(),center=new T.Vector3();let colliders=0;
      asset.traverse(node=>{
        if(node instanceof T.Mesh&&node.userData.physicsCollider){node.visible=false;bounds.setFromObject(node);bounds.getSize(size);bounds.getCenter(center);physics.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setTranslation(center.x,center.y,center.z));colliders++;}
        if(node instanceof T.Mesh&&node.name==='Freighter_finish_Recorder_standby_phosphor'&&node.material instanceof T.MeshStandardMaterial)this.lamp=node.material;
      });
      if(colliders<10){physics.free();this.root.remove(asset);throw new Error('Freighter collision data incomplete.');}
      this.physics=physics;this.body=physics.createCollider(RAPIER.ColliderDesc.capsule(.55,.36).setSensor(true));this.controller=physics.createCharacterController(.015);this.controller.disableAutostep();this.controller.disableSnapToGround();this.controller.setApplyImpulsesToDynamicBodies(false);physics.step();this.loaded=true;
  }
  update(position:T.Vector3,recovered:boolean){this.root.visible=Math.hypot(position.x-REACH_SITE.x,position.z-REACH_SITE.z)<170;if(this.root.visible&&!this.loaded&&!this.loading&&performance.now()>=this.retryAt)void this.load().catch(()=>{});if(this.lamp&&this.recovered!==recovered){this.lamp.emissiveIntensity=recovered?0:1.6;this.recovered=recovered;}}
  resolveDiver(position:T.Vector3,previous:T.Vector3,rotation?:T.Quaternion){
    if(!this.loaded||Math.min(position.x,previous.x)>REACH_SITE.x+20||Math.max(position.x,previous.x)<REACH_SITE.x-20||Math.min(position.z,previous.z)>REACH_SITE.z+25||Math.max(position.z,previous.z)<REACH_SITE.z-25||Math.min(position.y,previous.y)>this.floor+12)return;
    if(rotation)this.orientation.copy(rotation).multiply(this.prone);else this.orientation.copy(this.prone);this.body!.setRotation(this.orientation);this.body!.setTranslation(previous);this.physics!.step();this.controller!.computeColliderMovement(this.body!,{x:position.x-previous.x,y:position.y-previous.y,z:position.z-previous.z},RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);const movement=this.controller!.computedMovement();position.set(previous.x+movement.x,previous.y+movement.y,previous.z+movement.z);
  }
  dispose(){this.physics?.free();this.root.traverse(node=>{if(node instanceof T.Mesh){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();}});this.root.removeFromParent();}
}
