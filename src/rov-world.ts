import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RESEARCH_ROV} from './research-rov';
import RAPIER from '@dimforge/rapier3d-compat';
export class RovWorld{
  readonly root=new T.Group();readonly tether:T.Line;readonly lamp=new T.SpotLight(0xbce7e9,0,22,.52,.65,1.6);
  loaded=false;private loading?:Promise<void>;private rotors:T.Object3D[]=[];
  private cable=new Float32Array(6);private tetherAnchor?:T.Object3D;private target=new T.Object3D();private tetherEnd=new T.Vector3();
  private controller:RAPIER.KinematicCharacterController;private collider:RAPIER.Collider;
  constructor(scene:T.Scene,private physics:RAPIER.World){
    this.collider=physics.createCollider(RAPIER.ColliderDesc.ball(RESEARCH_ROV.radius).setTranslation(0,-1000,0).setSensor(true));
    this.controller=physics.createCharacterController(.02);this.controller.disableAutostep();this.controller.disableSnapToGround();this.controller.setApplyImpulsesToDynamicBodies(false);
    this.root.name=RESEARCH_ROV.name;this.root.visible=false;
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.cable,3));
    this.tether=new T.Line(geometry,new T.LineBasicMaterial({color:0xe4c159,transparent:true,opacity:.8}));this.tether.visible=false;this.tether.frustumCulled=false;
    this.lamp.position.set(0,0,-.65);this.target.position.set(0,0,-10);this.root.add(this.lamp,this.target);this.lamp.target=this.target;
    scene.add(this.root,this.tether);
  }
  resolve(position:T.Vector3,previous:T.Vector3){
    this.collider.setTranslation(previous);this.controller.computeColliderMovement(this.collider,{x:position.x-previous.x,y:position.y-previous.y,z:position.z-previous.z},RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const d=this.controller.computedMovement();position.set(previous.x+d.x,previous.y+d.y,previous.z+d.z);
  }
  recover(){this.root.visible=false;this.tether.visible=false;this.lamp.intensity=0;this.collider.setTranslation({x:0,y:-1000,z:0});}
  async load(){
    if(this.loaded)return;if(this.loading)return this.loading;
    this.loading=new GLTFLoader().loadAsync(RESEARCH_ROV.model).then(asset=>{
      const rotors:T.Object3D[]=[];asset.scene.traverse(node=>{if(node.userData.rovRotor)rotors.push(node);});
      if(rotors.length!==6||!asset.scene.getObjectByName('Sentry_anchor_camera')||!asset.scene.getObjectByName('Sentry_anchor_tether'))throw Error('ROV model is incomplete.');
      this.rotors=rotors;this.tetherAnchor=asset.scene.getObjectByName('Sentry_anchor_tether');this.root.add(asset.scene);this.loaded=true;
    }).finally(()=>{this.loading=undefined;});return this.loading;
  }
  update(delta:number,anchor:T.Vector3,moving:boolean,lights:boolean){
    for(const rotor of this.rotors)rotor.rotateY(delta*(moving?24:4));
    this.lamp.intensity=this.root.visible&&lights?6:0;this.tether.visible=this.root.visible;
    if(this.root.visible){
      const end=this.tetherAnchor?.getWorldPosition(this.tetherEnd)??this.root.position;
      this.cable[0]=anchor.x;this.cable[1]=anchor.y;this.cable[2]=anchor.z;this.cable[3]=end.x;this.cable[4]=end.y;this.cable[5]=end.z;this.tether.geometry.attributes.position.needsUpdate=true;
    }
  }
}
