import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';
const result=await build({stdin:{contents:"export * from './src/scooter-grip.ts';",resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {ScooterGrip}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
function fixture(){
  const world=new T.Group(),character=new T.Group(),drive=new T.Group();world.add(character,drive);
  const bones=[];
  for(const [side,sign]of [['Left',-1],['Right',1]]){
    const arm=new T.Bone(),forearm=new T.Bone(),hand=new T.Bone(),palm=new T.Bone();
    arm.name=`mixamorig${side}Arm`;forearm.name=`mixamorig${side}ForeArm`;hand.name=`mixamorig${side}Hand`;palm.name=`mixamorig${side}HandMiddle1`;
    arm.position.set(sign*.19,.21,-.34);forearm.position.set(sign*.07,-.14,-.21);hand.position.set(0,-.15,-.19);palm.position.set(0,0,-.14);
    character.add(arm);arm.add(forearm);forearm.add(hand);hand.add(palm);bones.push(arm,forearm,hand,palm);
    const anchor=new T.Object3D();anchor.name=`Manta_grip_${side.toLowerCase()}`;anchor.position.set(sign*.27,-.108,-.579);drive.add(anchor);
  }
  return{world,character,drive,bones};
}
test('supplied-style arm chains reach both authored grip anchors while preserving rig topology',()=>{
  const {world,character,drive,bones}=fixture(),parents=bones.map(bone=>bone.parent),grip=new ScooterGrip(character,drive);
  for(let i=0;i<90;i++){bones.forEach(bone=>bone.quaternion.identity());world.updateMatrixWorld(true);grip.update(true,1/60);}
  assert(grip.maxError<.015,`Hand contact error ${grip.maxError}`);
  bones.forEach((bone,index)=>{assert.equal(bone.parent,parents[index]);assert(bone.quaternion.toArray().every(Number.isFinite));assert(Math.abs(bone.quaternion.length()-1)<1e-6);});
});
test('grip contact follows translated, pitched and fully rotated swimmers',()=>{
  const {world,character,drive,bones}=fixture(),grip=new ScooterGrip(character,drive);world.position.set(100,-20,-50);world.rotation.set(.35,Math.PI*1.75,.05);
  for(let i=0;i<90;i++){bones.forEach(bone=>bone.quaternion.identity());world.updateMatrixWorld(true);grip.update(true,1/60);}
  assert(grip.maxError<.015,`Rotated hand contact error ${grip.maxError}`);
});
test('unused drive leaves animation alone and missing rig/anchors fail explicitly',()=>{
  const {world,character,drive,bones}=fixture(),grip=new ScooterGrip(character,drive);const before=bones.map(bone=>bone.quaternion.toArray());world.updateMatrixWorld(true);grip.update(false,1/60);assert.deepEqual(bones.map(bone=>bone.quaternion.toArray()),before);assert.throws(()=>new ScooterGrip(new T.Group(),drive),/joint missing/);assert.throws(()=>new ScooterGrip(character,new T.Group()),/anchor missing/);
});
test('authored GLB has two grip anchors, a rotor, finite transforms and bounded mesh batches',async()=>{
  const bytes=await readFile(new URL('../../public/models/manta_dive_drive.glb',import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert(gltf.meshes.length<=10);assert(bytes.length<500000);
  for(const name of ['Manta grip left','Manta grip right','Manta rotor'])assert(gltf.nodes.some(node=>node.name===name),`Missing authored anchor: ${name}`);
  for(const node of gltf.nodes)for(const key of ['translation','rotation','scale','matrix'])if(node[key])assert(node[key].every(Number.isFinite));
  assert((await stat(new URL('../../assets/blender/manta_dive_drive.blend',import.meta.url))).size>1000);
});
