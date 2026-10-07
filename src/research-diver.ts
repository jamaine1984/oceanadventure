import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function createResearchDiver() {
  const root=new T.Group();root.name='Research diver';
  const clothCanvas=document.createElement('canvas');clothCanvas.width=clothCanvas.height=128;
  const ctx=clothCanvas.getContext('2d')!;ctx.fillStyle='#b8bec2';ctx.fillRect(0,0,128,128);
  ctx.strokeStyle='#6f7d86';ctx.lineWidth=.5;
  for(let i=0;i<128;i+=3){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}
  const cloth=new T.CanvasTexture(clothCanvas);cloth.wrapS=cloth.wrapT=T.RepeatWrapping;cloth.repeat.set(4,4);
  const suit=new T.MeshStandardMaterial({color:0x182b3b,roughness:.84,roughnessMap:cloth,bumpMap:cloth,bumpScale:.003});
  const rubber=new T.MeshStandardMaterial({color:0x182226,roughness:.65});
  const blue=new T.MeshStandardMaterial({color:0x467d97,roughness:.63});
  const metal=new T.MeshStandardMaterial({color:0x9ca7a6,roughness:.29,metalness:.67});
  const skin=new T.MeshStandardMaterial({color:0xb48c70,roughness:.65});
  const attach=(g:T.BufferGeometry,m:T.Material,parent:T.Object3D=root,p=new T.Vector3())=>{const object=new T.Mesh(g,m);object.position.copy(p);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;};
  const tube=(points:T.Vector3[],radius:number,mat:T.Material,parent:T.Object3D=root)=>attach(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,radius,12,false),mat,parent);
  const fittedLimb=(points:T.Vector3[],radii:number[],parent:T.Object3D)=>{
    const path=new T.CatmullRomCurve3(points),g=new T.TubeGeometry(path,40,1,24,false),p=g.getAttribute('position');
    for(let row=0;row<=40;row++){const t=row/40,center=path.getPointAt(t),scaled=t*(radii.length-1),index=Math.min(radii.length-2,Math.floor(scaled));
      const radius=T.MathUtils.lerp(radii[index],radii[index+1],scaled-index)*(1+Math.sin(t*65)*.017);
      for(let j=0;j<=24;j++){const i=row*25+j;p.setXYZ(i,center.x+(p.getX(i)-center.x)*radius,center.y+(p.getY(i)-center.y)*radius,center.z+(p.getZ(i)-center.z)*radius);}}
    g.computeVertexNormals();return attach(g,suit,parent);
  };
  const ellipsoid=(x:number,y:number,z:number,scale:T.Vector3,m:T.Material,parent:T.Object3D=root)=>{const g=new T.SphereGeometry(1,24,16);g.scale(scale.x,scale.y,scale.z);return attach(g,m,parent,new T.Vector3(x,y,z));};
  const rounded=(p:T.Vector3,size:T.Vector3,m:T.Material,parent:T.Object3D=root)=>attach(new RoundedBoxGeometry(size.x,size.y,size.z,3,Math.min(.025,size.x*.2,size.y*.2,size.z*.2)),m,parent,p);
  const torso=new T.BufferGeometry();const verts:number[]=[],uv:number[]=[],ix:number[]=[];
  const stations=[[-.49,.19,.12],[-.38,.27,.15],[-.20,.25,.17],[0,.20,.15],[.22,.19,.15],[.37,.20,.13]];
  stations.forEach(([z,w,h],row)=>{for(let j=0;j<=28;j++){const a=j/28*Math.PI*2;verts.push(Math.cos(a)*w,Math.sin(a)*h,z);uv.push(j/28,row/5);if(row<5&&j<28){const n=row*29+j;ix.push(n,n+1,n+30,n,n+30,n+29);}}});
  torso.setAttribute('position',new T.Float32BufferAttribute(verts,3));torso.setAttribute('uv',new T.Float32BufferAttribute(uv,2));torso.setIndex(ix);torso.computeVertexNormals();attach(torso,suit);
  // Separate shoulder straps, side bladders, buckles and a waist belt.
  for(const side of [-1,1]){
    tube([new T.Vector3(side*.20,-.12,-.43),new T.Vector3(side*.25,.04,-.44),new T.Vector3(side*.19,.23,-.23),new T.Vector3(side*.13,.19,.18)],.039,rubber);
    ellipsoid(side*.235,0,.02,new T.Vector3(.082,.112,.245),rubber);
    rounded(new T.Vector3(side*.20,-.13,-.26),new T.Vector3(.085,.033,.07),metal);
    rounded(new T.Vector3(side*.20,-.149,-.26),new T.Vector3(.048,.012,.038),rubber);
    tube([new T.Vector3(side*.17,-.13,-.45),new T.Vector3(side*.23,-.15,-.12),new T.Vector3(side*.13,-.11,.31)],.009,blue);
  }
  const belt=attach(new T.TorusGeometry(.21,.025,8,32),rubber);belt.rotation.x=Math.PI/2;belt.scale.y=.75;belt.position.z=.24;
  rounded(new T.Vector3(0,-.145,.24),new T.Vector3(.10,.035,.075),metal);
  // The pelvis closes the tailored torso and overlaps both upper thighs.
  ellipsoid(0,0,.305,new T.Vector3(.225,.132,.19),suit);
  const seam=new T.MeshStandardMaterial({color:0x3d5261,roughness:.94});
  for(const side of [-1,1])tube([new T.Vector3(side*.225,-.08,-.39),new T.Vector3(side*.226,-.105,-.13),new T.Vector3(side*.18,-.105,.17),new T.Vector3(side*.12,-.09,.37)],.004,seam);
  tube([new T.Vector3(0,-.148,-.41),new T.Vector3(0,-.159,-.13),new T.Vector3(0,-.134,.24)],.004,seam);
  ellipsoid(0,0,-.53,new T.Vector3(.09,.095,.17),skin);
  const headStart=root.children.length;
  const headGeo=new T.SphereGeometry(.205,36,24);const hp=headGeo.getAttribute('position');
  for(let i=0;i<hp.count;i++){const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i);hp.setXYZ(i,x*(y<-.04?.75:.87),y,z*(z<0?.87:1.02));}headGeo.computeVertexNormals();attach(headGeo,skin,root,new T.Vector3(0,.025,-.76));
  // Hair sits over the back of the head; the face remains visible through a mask.
  const hairGeo=new T.SphereGeometry(.207,30,18,0,Math.PI*2,0,Math.PI*.59);hairGeo.scale(.87,.9,1.02);attach(hairGeo,new T.MeshStandardMaterial({color:0x382b24,roughness:.86}),root,new T.Vector3(0,.026,-.742));
  ellipsoid(0,.13,-.64,new T.Vector3(.10,.10,.10),rubber);
  for(const side of [-1,1])ellipsoid(side*.175,.02,-.74,new T.Vector3(.028,.06,.035),skin);
  ellipsoid(0,-.008,-.948,new T.Vector3(.034,.055,.039),skin);
  const glass=new T.MeshPhysicalMaterial({color:0xb2d5d5,roughness:.10,metalness:.1,transparent:true,opacity:.28,clearcoat:1,depthWrite:false});
  for(const side of [-1,1]){
    const eye=ellipsoid(side*.069,.072,-.919,new T.Vector3(.023,.017,.018),new T.MeshStandardMaterial({color:0xe1d5bf,roughness:.46}));
    ellipsoid(side*.069,.071,eye.position.z-.015,new T.Vector3(.010,.012,.006),rubber);
    const frame=[new T.Vector3(side*.013,.11,-.963),new T.Vector3(side*.13,.12,-.961),new T.Vector3(side*.155,.01,-.964),new T.Vector3(side*.06,-.033,-.973),new T.Vector3(side*.013,.0,-.967)];
    tube([...frame,frame[0]],.012,metal);
    rounded(new T.Vector3(side*.080,.047,-.951),new T.Vector3(.135,.14,.008),glass);
  }
  tube([new T.Vector3(-.16,.04,-.95),new T.Vector3(-.188,.035,-.76),new T.Vector3(0,.04,-.555),new T.Vector3(.188,.035,-.76),new T.Vector3(.16,.04,-.95)],.015,rubber);
  const regulator=attach(new T.CylinderGeometry(.055,.065,.065,24),rubber,root,new T.Vector3(0,-.105,-.947));regulator.rotation.x=Math.PI/2;
  const headGroup=new T.Group();root.add(headGroup);headGroup.position.set(0,.025,-.76);
  // Preserve facial and mask detail together while correcting the head-to-body proportion.
  for(const child of root.children.slice(headStart,-1)){child.position.sub(headGroup.position);headGroup.add(child);}headGroup.scale.setScalar(.81);
  tube([new T.Vector3(0,-.105,-.97),new T.Vector3(.28,-.10,-.9),new T.Vector3(.4,.08,-.5),new T.Vector3(.12,.30,-.35)],.018,rubber);
  const tankPoints=[new T.Vector2(0,0),new T.Vector2(.075,0),new T.Vector2(.115,.07),new T.Vector2(.115,.68),new T.Vector2(.10,.73),new T.Vector2(.045,.78)];
  const tank=attach(new T.LatheGeometry(tankPoints,30),new T.MeshStandardMaterial({color:0xcbbb57,metalness:.3,roughness:.4}),root,new T.Vector3(0,.26,.39));tank.rotation.x=-Math.PI/2;
  for(const z of [.23,-.20]){const band=attach(new T.TorusGeometry(.118,.015,8,28),rubber,root,new T.Vector3(0,.26,z));}
  rounded(new T.Vector3(0,.27,-.42),new T.Vector3(.10,.08,.08),metal);
  rounded(new T.Vector3(0,-.20,-.28),new T.Vector3(.095,.065,.060),rubber);const lens=attach(new T.CylinderGeometry(.028,.031,.02,16),glass,root,new T.Vector3(0,-.20,-.322));lens.rotation.x=Math.PI/2;
  for(const side of [-1,1]){
    const leg=new T.Group();leg.name=side<0?'diver_left_leg':'diver_right_leg';leg.position.set(side*.125,0,.30);root.add(leg);
    fittedLimb([new T.Vector3(0,0,-.055),new T.Vector3(side*.025,-.008,.21),new T.Vector3(side*.045,-.015,.45),new T.Vector3(side*.052,-.035,.79)],[.095,.094,.088,.076,.071,.052],leg);
    ellipsoid(side*.045,-.085,.42,new T.Vector3(.075,.025,.13),rubber,leg);
    tube([new T.Vector3(side*.05,0,.08),new T.Vector3(side*.083,0,.44),new T.Vector3(side*.08,-.017,.71)],.006,blue,leg);
    ellipsoid(side*.05,-.04,.83,new T.Vector3(.071,.054,.139),rubber,leg);
    const shape=new T.Shape();shape.moveTo(-.058,0);shape.bezierCurveTo(-.065,.15,-.115,.37,-.132,.69);shape.lineTo(-.060,.72);shape.quadraticCurveTo(0,.675,.060,.72);shape.lineTo(.132,.69);shape.bezierCurveTo(.115,.37,.065,.15,.058,0);shape.closePath();
    const finGeo=new T.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2,steps:1,curveSegments:20});finGeo.rotateX(Math.PI/2);
    const finP=finGeo.getAttribute('position');for(let i=0;i<finP.count;i++){const z=finP.getZ(i),x=finP.getX(i);finP.setY(i,finP.getY(i)+Math.sin(z*2.9)*.024+Math.sin(x*45)*.004*Math.max(0,z));}finGeo.computeVertexNormals();attach(finGeo,new T.MeshStandardMaterial({color:0x091d23,roughness:.84,bumpMap:cloth,bumpScale:.001}),leg,new T.Vector3(side*.05,-.071,.85));
    for(const offset of [-.07,-.035,0,.035,.07])tube([new T.Vector3(side*.05+offset*.55,-.070,.94),new T.Vector3(side*.05+offset*.94,-.054,1.20),new T.Vector3(side*.05+offset*1.35,-.049,1.52)],.0035,offset?rubber:blue,leg);
    for(const offset of [-.114,.114])tube([new T.Vector3(side*.05+offset*.55,-.071,.94),new T.Vector3(side*.05+offset*.87,-.053,1.2),new T.Vector3(side*.05+offset,-.051,1.53)],.004,blue,leg);
    const bootStrap=attach(new T.TorusGeometry(.070,.012,8,28),rubber,leg,new T.Vector3(side*.05,-.02,.83));bootStrap.scale.y=.7;
    rounded(new T.Vector3(side*.13,-.02,.83),new T.Vector3(.035,.025,.045),metal,leg);
    const arm=new T.Group();arm.name=side<0?'diver_left_arm':'diver_right_arm';arm.position.set(side*.24,0,-.35);root.add(arm);
    fittedLimb([new T.Vector3(0,0,0),new T.Vector3(side*.14,-.08,.22),new T.Vector3(side*.16,-.19,.48)],[.077,.072,.060,.062,.039],arm);
    tube([new T.Vector3(side*.052,-.055,.06),new T.Vector3(side*.12,-.13,.28),new T.Vector3(side*.135,-.22,.47)],.005,blue,arm);
    ellipsoid(side*.16,-.19,.54,new T.Vector3(.044,.027,.058),rubber,arm);
    for(let digit=0;digit<4;digit++){const x=side*.16+(digit-1.5)*.020;tube([new T.Vector3(x,-.19,.579),new T.Vector3(x,-.195,.623),new T.Vector3(x,-.207,.65+(digit%2)*.012)],.0075,rubber,arm);ellipsoid(x,-.199,.597,new T.Vector3(.008,.010,.013),suit,arm);}
    tube([new T.Vector3(side*.124,-.19,.53),new T.Vector3(side*.103,-.21,.568),new T.Vector3(side*.115,-.222,.594)],.010,rubber,arm);
    tube([new T.Vector3(side*.126,-.213,.53),new T.Vector3(side*.16,-.216,.567),new T.Vector3(side*.19,-.210,.53)],.003,seam,arm);
    if(side<0){rounded(new T.Vector3(side*.16,-.235,.44),new T.Vector3(.072,.025,.065),metal,arm);rounded(new T.Vector3(side*.16,-.252,.44),new T.Vector3(.055,.005,.047),new T.MeshBasicMaterial({color:0x376875}),arm);}
  }
  root.traverse(n=>{if(n instanceof T.Mesh){n.castShadow=true;n.receiveShadow=true;}});
  return root;
}
