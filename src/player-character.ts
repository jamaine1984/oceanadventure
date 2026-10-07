import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type PlayerCharacter = {
  root:T.Group;
  source:'supplied';
  animate(delta:number,speed:number,jogIntent?:boolean):void;
};
const sourceAssets=new Map<string,Promise<GLTF>>();
export class CharacterLoadError extends Error {}
export function preloadPlayerCharacter(){return loadAsset();}
function loadAsset(){
  const path='/models/ocean-player-character.glb?v=shared-player-5';
  let promise=sourceAssets.get(path);if(!promise){promise=new GLTFLoader().loadAsync(path).then(asset=>{
    asset.animations.forEach(clip=>clip.optimize());return asset;
  }).catch(error=>{sourceAssets.delete(path);throw error;});sourceAssets.set(path,promise);}return promise;
}

export async function createPlayerCharacter(kind:'walk'|'swim'):Promise<PlayerCharacter>{
  try{
    const asset=await loadAsset(),model=clone(asset.scene),root=new T.Group(),upright=new T.Group();
    root.name=kind==='walk'?'Supplied Ocean researcher':'Supplied Ocean research diver';root.add(upright);upright.add(model);
    model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model),height=bounds.max.y-bounds.min.y;
    if(!Number.isFinite(height)||height<.01)throw new Error('Invalid character dimensions');
    const scale=1.75/height,center=bounds.getCenter(new T.Vector3());
    model.scale.setScalar(scale);model.rotation.y=Math.PI;model.position.set(center.x*scale,-bounds.min.y*scale,center.z*scale);
    model.traverse(node=>{if(node instanceof T.Mesh){
      // Share mesh/texture buffers, but keep per-mode lighting settings independent.
      node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
      node.castShadow=node.receiveShadow=true;const materials=Array.isArray(node.material)?node.material:[node.material];
      materials.forEach(m=>{if(m instanceof T.MeshStandardMaterial){m.envMapIntensity=.65;if(m.map)m.map.anisotropy=4;}});
    }});
    if(kind==='swim'){
      // Library clips already contain the prone swimming pose. Anchor the
      // supplied rig's hips to the collision controller rather than rotating
      // the whole character a second time or adding duplicate equipment.
      upright.updateMatrixWorld(true);let hips:T.Object3D|undefined;
      model.traverse(node=>{if((node as T.Bone).isBone&&node.name.replace(/[^a-z]/gi,'').endsWith('Hips'))hips=node;});
      if(!hips)throw new Error('Diver hip joint missing');
      upright.position.y=-hips.getWorldPosition(new T.Vector3()).y;
    }
    const mixer=new T.AnimationMixer(model),actions=new Map<string,T.AnimationAction>();
    for(const clip of asset.animations){const action=mixer.clipAction(clip);action.play();action.setEffectiveWeight(0);actions.set(clip.name.toLowerCase(),action);}
    if(!actions.has(kind==='walk'?'idle':'swimidle')||!actions.has(kind==='walk'?'walk':'swim'))throw new Error('Required character animations missing');
    let motion=0,running=0;
    const animate=(delta:number,speed:number,jogIntent=false)=>{
      const movement=T.MathUtils.smoothstep(Math.abs(speed),.08,.8);motion=T.MathUtils.damp(motion,movement,9,delta);
      running=T.MathUtils.damp(running,kind==='walk'&&jogIntent?movement:0,9,delta);
      for(const [name,action]of actions){const weight=name===(kind==='walk'?'idle':'swimidle')?1-motion:name==='walk'&&kind==='walk'?motion*(1-running):name==='run'&&kind==='walk'?motion*running:name==='swim'&&kind==='swim'?motion:0;action.setEffectiveWeight(weight);}
      // Match playback to measured planted-foot travel at this character's
      // 1.75 m scale, keeping the step cadence aligned with controller speed.
      actions.get('walk')?.setEffectiveTimeScale(T.MathUtils.clamp(speed/.69,.4,2.2));
      actions.get('run')?.setEffectiveTimeScale(T.MathUtils.clamp(speed/1.64,.6,1.4));
      actions.get('swim')?.setEffectiveTimeScale(.65+.45*Math.min(1.3,Math.abs(speed)/3));
      actions.get('swimidle')?.setEffectiveTimeScale(.22);
      mixer.update(delta);
    };
    animate(0,0);return {root,source:'supplied',animate};
  }catch(error){
    throw new CharacterLoadError('The player GLB could not load. Please retry.',{cause:error});
  }
}
