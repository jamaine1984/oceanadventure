import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function fabric(color:number){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#999';ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const v=127+Math.sin(x*2.8+y*.7)*12+Math.sin(y*2.3)*8;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
  const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(3,3);
  return new T.MeshStandardMaterial({color,roughness:.88,bumpMap:map,bumpScale:.006});
}
function add(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,p:[number,number,number]=[0,0,0]){
  const item=new T.Mesh(g,m);item.position.set(...p);item.castShadow=item.receiveShadow=true;parent.add(item);return item;
}
function loft(sections:[number,number,number,number][],material:T.Material,parent:T.Object3D){
  const v:number[]=[],uv:number[]=[],ix:number[]=[],n=32;
  for(let row=0;row<sections.length;row++){const [y,rx,rz,z]=sections[row];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;v.push(Math.sin(a)*rx,y,z+Math.cos(a)*rz);uv.push(i/n,row/(sections.length-1));}}
  for(let row=0;row<sections.length-1;row++)for(let i=0;i<n;i++){const k=row*(n+1)+i;ix.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return add(parent,g,material);
}
function oval(parent:T.Object3D,material:T.Material,p:[number,number,number],scale:[number,number,number]){const m=add(parent,new T.SphereGeometry(1,24,16),material,p);m.scale.set(...scale);return m;}
function panel(parent:T.Object3D,mat:T.Material,p:[number,number,number],s:[number,number,number]){return add(parent,new RoundedBoxGeometry(...s,3,.008),mat,p);}
function seam(parent:T.Object3D,mat:T.Material,points:T.Vector3[],radius=.004){return add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points),20,radius,5,false),mat);}

export function createResearchWalker(){
  const root=new T.Group();root.name='Articulated dockside marine researcher';
  const jacket=fabric(0x283d4d),trousers=fabric(0x656b4e),rubber=fabric(0x252c2d);
  const skin=new T.MeshStandardMaterial({color:0xb98765,roughness:.64});const hair=fabric(0x30251e);
  const piping=new T.MeshStandardMaterial({color:0x6f929f,roughness:.8});const dark=new T.MeshStandardMaterial({color:0x22282a,roughness:.7});
  const metal=new T.MeshStandardMaterial({color:0x939e99,metalness:.5,roughness:.4});
  loft([[.84,.16,.115,0],[.96,.175,.12,0],[1.08,.18,.125,0],[1.23,.215,.14,0],[1.36,.245,.12,0],[1.40,.16,.105,0]],jacket,root);
  loft([[1.39,.11,.085,0],[1.46,.085,.07,0],[1.48,.074,.07,0]],jacket,root);
  oval(root,skin,[0,1.47,0],[.061,.075,.058]);
  const head=add(root,new T.SphereGeometry(1,40,28),skin,[0,1.615,-.002]);
  const p=head.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const jaw=1-T.MathUtils.smoothstep(-y,.15,.75)*.22;p.setXYZ(i,x*.087*jaw,y*.122,z*.078-(y<-.25?.006:0));}head.geometry.computeVertexNormals();
  for(const side of [-1,1]){
    oval(root,skin,[side*.087,1.613,0],[.012,.026,.017]);
    oval(root,new T.MeshStandardMaterial({color:0xdcd9cc,roughness:.3}),[side*.032,1.636,-.073],[.016,.008,.006]);
    oval(root,dark,[side*.032,1.636,-.079],[.005,.005,.003]);
    seam(root,hair,[new T.Vector3(side*.014,1.652,-.075),new T.Vector3(side*.032,1.656,-.077),new T.Vector3(side*.049,1.653,-.072)],.003);
  }
  oval(root,skin,[0,1.615,-.079],[.015,.027,.017]);
  oval(root,new T.MeshStandardMaterial({color:0x926553,roughness:.8}),[0,1.58,-.074],[.026,.004,.005]);
  const scalp=add(root,new T.SphereGeometry(1,36,18,0,Math.PI*2,0,1.8),hair,[0,1.623,.002]);scalp.scale.set(.090,.121,.083);
  for(let i=0;i<18;i++)seam(root,hair,[new T.Vector3(-.07+i*.008,1.685,-.045),new T.Vector3(-.05+i*.006,1.739,-.005),new T.Vector3(-.055+i*.006,1.72,.055)],.005);
  panel(root,dark,[0,.91,-.002],[.35,.042,.255]);panel(root,metal,[0,.91,-.138],[.052,.035,.01]);
  seam(root,metal,[new T.Vector3(0,.97,-.127),new T.Vector3(0,1.2,-.143),new T.Vector3(0,1.40,-.10)],.003);
  panel(root,metal,[0,1.28,-.147],[.008,.02,.01]);
  for(const side of [-1,1]){
    seam(root,piping,[new T.Vector3(side*.14,1.39,-.095),new T.Vector3(side*.21,1.34,-.104),new T.Vector3(side*.22,1.25,-.113)],.004);
    panel(root,jacket,[side*.11,1.12,-.125],[.082,.13,.015]);
  }
  const legs:T.Group[]=[],knees:T.Group[]=[],arms:T.Group[]=[],elbows:T.Group[]=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.092,.89,0);root.add(leg);legs.push(leg);
    loft([[0,.077,.096,0],[-.12,.078,.088,0],[-.31,.062,.071,.008],[-.43,.060,.065,.006]],trousers,leg);
    const knee=new T.Group();knee.position.set(0,-.43,.006);leg.add(knee);knees.push(knee);
    loft([[0,.061,.066,0],[-.09,.060,.07,.018],[-.24,.047,.052,.008],[-.34,.046,.048,0]],trousers,knee);
    panel(leg,trousers,[side*.075,-.20,-.002],[.025,.13,.11]);
    panel(knee,trousers,[0,-.065,-.064],[.10,.10,.02]);
    const shoe=panel(knee,rubber,[0,-.378,-.042],[.112,.105,.245]);shoe.geometry.computeVertexNormals();
    panel(knee,dark,[0,-.429,-.042],[.119,.03,.253]);
    for(let i=0;i<4;i++)seam(knee,piping,[new T.Vector3(-.035,-.33,-.06-i*.017),new T.Vector3(.035,-.33,-.06-i*.017)],.002);
    const arm=new T.Group();arm.position.set(side*.23,1.35,0);arm.rotation.z=side*.13;root.add(arm);arms.push(arm);
    loft([[.015,.072,.076,0],[-.10,.070,.072,0],[-.23,.053,.055,0],[-.29,.05,.051,0]],jacket,arm);
    const elbow=new T.Group();elbow.position.y=-.29;arm.add(elbow);elbows.push(elbow);
    loft([[0,.052,.052,0],[-.10,.050,.05,0],[-.20,.038,.039,0]],jacket,elbow);
    panel(elbow,piping,[0,-.2,0],[.080,.015,.080]);
    oval(elbow,skin,[0,-.225,0],[.035,.037,.033]);
    oval(elbow,skin,[0,-.283,-.004],[.038,.055,.022]);
    for(let finger=0;finger<4;finger++)oval(elbow,skin,[-.027+finger*.018,-.343,-.003],[.007,.028-finger*.002,.008]);
    oval(elbow,skin,[-side*.039,-.285,-.016],[.012,.026,.011]);
    if(side===-1){panel(elbow,dark,[0,-.21,0],[.078,.035,.074]);panel(elbow,metal,[0,-.21,-.041],[.030,.025,.009]);}
  }
  let phase=0;
  return {root,animate(delta:number,speed:number){
    const motion=T.MathUtils.clamp(speed/2.3,0,1);phase+=delta*(speed>2.6?10:7)*motion;
    legs.forEach((leg,i)=>{const a=phase+i*Math.PI;leg.rotation.x=Math.sin(a)*.48*motion;knees[i].rotation.x=Math.max(0,-Math.sin(a))*.6*motion;arms[i].rotation.x=-Math.sin(a)*.35*motion;elbows[i].rotation.x=-.15-motion*.12;});
    root.children[0].position.y=Math.abs(Math.sin(phase))*.012*motion;
  }};
}
