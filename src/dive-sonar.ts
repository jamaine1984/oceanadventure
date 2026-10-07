import * as T from 'three';
import { SONAR_RANGE, SONAR_DURATION, type SonarContact } from './field-equipment';

export class DiveSonar {
  private root=new T.Group();
  private pulse:T.LineLoop<T.BufferGeometry,T.LineBasicMaterial>;
  private markers:Array<T.Group>=[];
  private started=-Infinity;
  constructor(scene:T.Scene){
    this.root.name='Research sonar contacts';this.root.visible=false;scene.add(this.root);
    const circle=Array.from({length:80},(_,index)=>new T.Vector3(Math.cos(index/80*Math.PI*2),0,Math.sin(index/80*Math.PI*2)));
    this.pulse=new T.LineLoop(new T.BufferGeometry().setFromPoints(circle),new T.LineBasicMaterial({color:0x90f2d8,transparent:true,depthWrite:false}));this.root.add(this.pulse);
    const cross=new T.BufferGeometry().setFromPoints([new T.Vector3(-.45,0,0),new T.Vector3(.45,0,0),new T.Vector3(0,-.45,0),new T.Vector3(0,.45,0),new T.Vector3(0,0,-.45),new T.Vector3(0,0,.45)]);
    for(let i=0;i<5;i++){const marker=new T.Group(),material=new T.LineBasicMaterial({color:0xffd479,transparent:true,depthWrite:false});marker.add(new T.LineSegments(cross,material));marker.visible=false;this.root.add(marker);this.markers.push(marker);}
  }
  emit(position:T.Vector3,contacts:SonarContact[],time:number){
    this.started=time;this.root.visible=true;this.pulse.position.copy(position);this.pulse.scale.setScalar(.05);
    this.markers.forEach((marker,index)=>{const contact=contacts[index];marker.visible=false;if(contact)marker.position.set(contact.x,contact.y,contact.z);marker.userData.distance=contact?.distance;});
  }
  update(time:number,swimming:boolean){
    const age=time-this.started;this.root.visible=swimming&&age<SONAR_DURATION;if(!this.root.visible)return;
    const radius=Math.min(SONAR_RANGE,age*35);this.pulse.scale.setScalar(Math.max(.05,radius));this.pulse.material.opacity=Math.max(0,.48*(1-age/2));
    this.markers.forEach(marker=>{marker.visible=Number.isFinite(marker.userData.distance)&&radius>=marker.userData.distance;(marker.children[0]as T.LineSegments<T.BufferGeometry,T.LineBasicMaterial>).material.opacity=Math.min(.85,(SONAR_DURATION-age)*.6);});
  }
  clear(){this.started=-Infinity;this.root.visible=false;}
}
