import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {PELAGIC_SITE} from './pelagic';
import {RESEARCH_ROV} from './research-rov';
export class PelagicWorld{
  readonly root=new T.Group();loaded=false;private loading?:Promise<void>;private retryAt=0;
  private physics?:RAPIER.World;private controller?:RAPIER.KinematicCharacterController;private rov?:RAPIER.Collider;private diver?:RAPIER.Collider;
  private lamps:T.MeshStandardMaterial[]=[];private prone=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);private orientation=new T.Quaternion();
  constructor(scene:T.Scene,readonly floor:number,private surface?:T.Texture){this.root.position.set(PELAGIC_SITE.x,floor,PELAGIC_SITE.z);this.root.name='Pelagic Observatory';scene.add(this.root);}
  async load(){
    if(this.loaded)return;if(this.loading)return this.loading;
    this.loading=new GLTFLoader().loadAsync('/models/pelagic_observatory.glb').then(asset=>this.attach(asset.scene)).catch(error=>{this.retryAt=performance.now()+10000;throw error;}).finally(()=>{this.loading=undefined;});return this.loading;
  }
  attach(asset:T.Group){
    this.root.add(asset);this.root.updateMatrixWorld(true);const physics=new RAPIER.World({x:0,y:0,z:0}),bounds=new T.Box3(),size=new T.Vector3(),center=new T.Vector3();let count=0;
    asset.traverse(node=>{
      if(!(node instanceof T.Mesh))return;
      if(node.userData.physicsCollider){node.visible=false;bounds.setFromObject(node);bounds.getSize(size);bounds.getCenter(center);const shape=node.userData.cylinderCollider?RAPIER.ColliderDesc.cylinder(size.y/2,Math.max(size.x,size.z)/2):RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2);physics.createCollider(shape.setTranslation(center.x,center.y,center.z));count++;return;}
      if(node.material instanceof T.MeshStandardMaterial){
        if(node.material.name==='Observatory enamel'&&this.surface){
          node.material.map=this.surface;node.material.side=T.DoubleSide;
          // Reuse the existing wear map without letting corrosion obscure painted structure.
          node.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','vec3 intactPaint = diffuseColor.rgb;\n#include <map_fragment>\ndiffuseColor.rgb = mix(intactPaint, diffuseColor.rgb, 0.18);');};
          node.material.customProgramCacheKey=()=> 'observatory-paint-wear-v1';
        }
        const match=/^Observatory port (\d)$/.exec(node.material.name);if(match)this.lamps[Number(match[1])]=node.material;
      }
    });
    if(count<10||this.lamps.filter(Boolean).length!==3){physics.free();this.root.remove(asset);throw Error('Observatory collision or terminal data is incomplete.');}
    this.physics=physics;this.controller=physics.createCharacterController(.015);this.controller.disableAutostep();this.controller.disableSnapToGround();this.controller.setApplyImpulsesToDynamicBodies(false);
    this.rov=physics.createCollider(RAPIER.ColliderDesc.ball(RESEARCH_ROV.radius).setSensor(true));this.diver=physics.createCollider(RAPIER.ColliderDesc.capsule(.55,.36).setSensor(true));physics.step();this.loaded=true;
  }
  update(position:T.Vector3,records:number){
    this.root.visible=Math.hypot(position.x-PELAGIC_SITE.x,position.z-PELAGIC_SITE.z)<170;
    if(this.root.visible&&!this.loaded&&!this.loading&&performance.now()>=this.retryAt)void this.load().catch(()=>{});
    this.lamps.forEach((m,i)=>{m.emissive.set(i<records?0x45b998:0xd94711);m.color.copy(m.emissive);});
  }
  resolve(position:T.Vector3,previous:T.Vector3,rotation?:T.Quaternion){
    if(!this.loaded||Math.min(position.x,previous.x)>PELAGIC_SITE.x+18||Math.max(position.x,previous.x)<PELAGIC_SITE.x-18||Math.min(position.z,previous.z)>PELAGIC_SITE.z+18||Math.max(position.z,previous.z)<PELAGIC_SITE.z-18||Math.min(position.y,previous.y)>this.floor+10)return;
    const body=rotation?this.diver!:this.rov!;if(rotation){this.orientation.copy(rotation).multiply(this.prone);body.setRotation(this.orientation);}body.setTranslation(previous);this.physics!.step();
    this.controller!.computeColliderMovement(body,{x:position.x-previous.x,y:position.y-previous.y,z:position.z-previous.z},RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);const d=this.controller!.computedMovement();position.set(previous.x+d.x,previous.y+d.y,previous.z+d.z);
  }
  dispose(){this.physics?.free();this.root.traverse(n=>{if(n instanceof T.Mesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});this.root.removeFromParent();}
}
