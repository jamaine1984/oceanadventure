import * as T from 'three';
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';

export class ScooterGrip {
  private solver:CCDIKSolver;
  private targets:T.Bone[]=[];
  private palms:T.Bone[]=[];
  private anchors:T.Object3D[]=[];
  private blend=0;
  private point=new T.Vector3();
  maxError=0;
  constructor(private character:T.Group,drive:T.Group){
    const bones:T.Bone[]=[];character.traverse(node=>{if((node as T.Bone).isBone)bones.push(node as T.Bone);});
    const find=(suffix:string)=>{const index=bones.findIndex(bone=>bone.name.endsWith(suffix));if(index<0)throw new Error(`Dive grip joint missing: ${suffix}`);return index;};
    const chains=['Left','Right'].map(side=>{
      const anchor=drive.getObjectByName(`Manta_grip_${side.toLowerCase()}`);if(!anchor)throw new Error('Dive drive grip anchor missing.');this.anchors.push(anchor);
      const effector=find(`${side}HandMiddle1`),hand=find(`${side}Hand`),forearm=find(`${side}ForeArm`),arm=find(`${side}Arm`);
      this.palms.push(bones[effector]);const target=new T.Bone();target.name=`Dive drive ${side} grip`;this.targets.push(target);character.add(target);
      return {target:bones.length+this.targets.length-1,effector,links:[{index:hand},{index:forearm},{index:arm}],iteration:10,maxAngle:.3};
    });
    // The solver proxy references the cloned rig; its targets never alter skin
    // indices, inverse bind matrices or the supplied GLB's skeleton definition.
    const proxy=new T.SkinnedMesh();proxy.skeleton=new T.Skeleton([...bones,...this.targets]);this.solver=new CCDIKSolver(proxy,chains);
  }
  update(enabled:boolean,delta:number){
    this.blend=T.MathUtils.damp(this.blend,enabled?1:0,10,delta);if(this.blend<.001){this.maxError=0;return;}
    this.character.updateWorldMatrix(true,true);
    this.targets.forEach((target,index)=>{this.anchors[index].getWorldPosition(this.point);target.position.copy(this.character.worldToLocal(this.point));target.updateMatrixWorld(true);});
    this.solver.update(this.blend);this.maxError=0;
    this.palms.forEach((palm,index)=>{palm.getWorldPosition(this.point);this.maxError=Math.max(this.maxError,this.point.distanceTo(this.anchors[index].getWorldPosition(new T.Vector3())));});
  }
}
