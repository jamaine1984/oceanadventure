import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CLIENTS } from './voyage-catalog';
import type { Speaker } from './story-state';
export class ResearchPartners {
  readonly group=new T.Group();private figures=new Map<Speaker,T.Group>();
  constructor(scene:T.Scene,ground:(x:number,z:number)=>number){
    this.group.name='Temporary research partner NPCs';scene.add(this.group);
    for(const [id,x,z,color]of [['mara',-32.5,35,0x568577],['ivo',-32.5,46,0xb7bdbb],['selene',-36.5,35,0xdddccc]]as const){
      const root=new T.Group();root.name=CLIENTS[id].name;root.userData.standin=true;root.position.set(x,ground(x,z),z);this.group.add(root);this.figures.set(id,root);
      const jacket=new T.MeshStandardMaterial({color,roughness:.85}),cloth=new T.MeshStandardMaterial({color:0x26383c,roughness:.92}),skin=new T.MeshStandardMaterial({color:id==='selene'?0x65432f:id==='mara'?0xb38160:0xc99373,roughness:.85});
      const part=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;root.add(mesh);return mesh;};
      part(new T.CapsuleGeometry(.25,.44,4,10),jacket,0,1.22,0);part(new T.SphereGeometry(.18,12,10),skin,0,1.79,0).scale.set(1,1.22,.95);
      part(new T.SphereGeometry(.186,12,8),cloth,0,1.91,.01).scale.set(1,.65,1);
      for(const side of [-1,1])part(new T.SphereGeometry(.018,6,6),cloth,side*.06,1.8,-.168);
      for(const side of [-1,1]){part(new T.CapsuleGeometry(.10,.52,4,8),cloth,side*.13,.47,0);part(new T.CapsuleGeometry(.075,.39,4,8),jacket,side*.32,1.12,0).rotation.z=side*.1;part(new T.SphereGeometry(.075,8,6),skin,side*.35,.82,0);part(new T.BoxGeometry(.18,.13,.32),cloth,side*.13,.10,-.07);}
      part(new T.BoxGeometry(.08,.09,.015),new T.MeshStandardMaterial({color:0xddc58b,roughness:.6}),.12,1.37,-.24).name='Research badge';
      const batches=new Map<T.Material,T.Mesh[]>();
      for(const child of root.children)if(child instanceof T.Mesh){const material=child.material as T.Material;batches.set(material,[...(batches.get(material)??[]),child]);}
      for(const [material,parts]of batches){
        const geometries=parts.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
        const combined=mergeGeometries(geometries);geometries.forEach(geometry=>geometry.dispose());
        if(combined){parts.forEach(mesh=>{root.remove(mesh);mesh.geometry.dispose();});const batch=new T.Mesh(combined,material);batch.name='Partner finish';root.add(batch);}
      }
    }
  }
  nearest(position:T.Vector3){return [...this.figures].map(([id,root])=>({id,distance:position.distanceTo(root.position)})).filter(item=>item.distance<3).sort((a,b)=>a.distance-b.distance)[0]?.id;}
  replace(id:Speaker,model:T.Object3D){const slot=this.figures.get(id);if(!slot)return;slot.traverse(obj=>{if(obj instanceof T.Mesh){obj.geometry.dispose();for(const material of Array.isArray(obj.material)?obj.material:[obj.material])material.dispose();}});slot.clear();slot.userData.standin=false;slot.add(model);}
  update(time:number,position:T.Vector3,underwater:boolean){this.group.visible=!underwater&&Math.hypot(position.x+33,position.z-43)<180;for(const [id,root]of this.figures){root.rotation.y=0;if(root.userData.standin&&root.children[0])root.children[0].rotation.z=Math.sin(time*.6+(id==='mara'?0:id==='ivo'?2:4))*.008;}}
}
