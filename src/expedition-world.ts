import * as T from 'three';
import { projectedSubjectBounds } from './photo-framing';
import { spatialLod } from './spatial-lod';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { REEF_SITE, WRECK_SITE, SAMPLE_SITES, LAGOON_SITE, TRANSECT_SITE, LAGOON_SAMPLES, TRANSECT_STATIONS, GARDEN_SITE, PASSAGE_SITE, PASSAGE_SAMPLES, PASSAGE_STATIONS, expeditionPlan, type ExpeditionRecord, type SpeciesKey } from './expedition-state';
import { IslandWalk, trailDistance } from './island-walk';
import { wildlifePose } from './wildlife-motion';

type RockBounds = { center: T.Vector3; radii: T.Vector3 };
type Animal = { key: SpeciesKey; root: T.Group; home: T.Vector3; radius: number; pace: number; phase: number; parts: T.Object3D[] };
const UP = new T.Vector3(0, 1, 0);
const rnd = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function noise(x:number,y:number){const ix=Math.floor(x),iy=Math.floor(y);const sx=x-ix,sy=y-iy;const u=sx*sx*(3-2*sx),v=sy*sy*(3-2*sy);return T.MathUtils.lerp(T.MathUtils.lerp(rnd(ix+iy*99),rnd(ix+1+iy*99),u),T.MathUtils.lerp(rnd(ix+(iy+1)*99),rnd(ix+1+(iy+1)*99),u),v);}

export function expeditionFloor(x: number, z: number) {
  const deep = T.MathUtils.smoothstep(-z, 110, 158);
  const reef = Math.exp(-((x / 58) ** 2 + ((z + 91) / 57) ** 2));
  const lagoon = Math.exp(-(((x-LAGOON_SITE.x) / 48) ** 2 + ((z-LAGOON_SITE.z) / 52) ** 2));
  const lagoonBank = Math.exp(-(((x+134) / 14) ** 2 + ((z+78) / 18) ** 2));
  const garden = Math.exp(-(((x-GARDEN_SITE.x) / 30) ** 2 + ((z-GARDEN_SITE.z) / 31) ** 2));
  return -21 - deep * 6.5 + reef * 8.7 + lagoon * 10 + lagoonBank * 3.4 + garden * 7.6 + Math.sin(x * .12) * .45 + Math.cos(z * .09) * .55;
}
export function limestoneArchBounds(): RockBounds[] {
  const floor = expeditionFloor(PASSAGE_SITE.x, PASSAGE_SITE.z);
  return Array.from({ length: 19 }, (_, index) => {
    const a = index / 18 * Math.PI;
    return { center: new T.Vector3(PASSAGE_SITE.x + Math.cos(a) * 6.8, floor + 3 + Math.sin(a) * 7.6, PASSAGE_SITE.z), radii: new T.Vector3(1.95, 1.65, 8.2) };
  });
}
export function passageClearanceHeight() {
  return Math.max(...limestoneArchBounds().map(bound=>bound.center.y+bound.radii.y+.55))+1;
}
function islandRadius(angle: number) {
  // Two shallow coves interrupt the outer limestone headland.
  const cove = Math.exp(-Math.pow((angle + 1.15) / .28, 2)) * 6;
  return 33 + Math.sin(angle * 3 + .6) * 3.2 + Math.cos(angle * 7) * 1.5 - cove;
}
function islandRadial(x: number, z: number) {
  return Math.hypot(x + 53, (z - 43) * .91) / islandRadius(Math.atan2((z - 43) * .91, x + 53));
}
export function islandHeight(x: number, z: number) {
  const a = Math.atan2((z - 43) * .91, x + 53), r = islandRadial(x, z);
  const beach = T.MathUtils.smoothstep(Math.cos(a - .6), -.1, .6);
  const inland = 4.1 + noise(x * .08, z * .08) * 1.8;
  const cliff = inland * (1 - T.MathUtils.smoothstep(r, .70, .91));
  const slope = inland * Math.pow(Math.max(0, 1 - r), 1.25);
  let height = T.MathUtils.lerp(cliff, slope, beach);
  height -= T.MathUtils.smoothstep(r, .90, 1.04) * 1.5;
  const terrace = T.MathUtils.smoothstep(x, -47, -39) * T.MathUtils.smoothstep(z, 20, 28) * (1 - T.MathUtils.smoothstep(z, 57, 66));
  height = T.MathUtils.lerp(height, 1.10, terrace * (1 - T.MathUtils.smoothstep(r, 1.0, 1.1)));
  return height + (noise(x * .7, z * .7) - .5) * .13 * (1 - terrace);
}

const surfaceTextureSources=new Map<string,HTMLCanvasElement>();
function surfaceTexture(kind: 'sand' | 'stone' | 'timber' | 'rust' | 'shell' | 'skin' | 'canvas' | 'plaster' | 'soil') {
  const cached=surfaceTextureSources.get(kind);
  if(cached){const map=new T.CanvasTexture(cached);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;return map;}
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d')!; const pixels = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const grain = rnd(x + y * 512) * 16 - 8;
    let r = 0, g = 0, b = 0;
    if (kind === 'sand') {
      const v = grain*.5 + Math.sin(y * .10 + noise(x/68,y/120) * 7) * 5 +(noise(x/65,y/65)-.5)*18;
      r = 202 + v; g = 188 + v; b = 151 + v;
    } else if (kind === 'stone') {
      const strata = (noise(x/75,y/67)-.5)*40+(noise(x/18,y/24)-.5)*25+(noise(x/5,y/5)-.5)*15;
      const pores = rnd(x * 2 + y * 1711) > .963 ? -45 : 0;
      r = 150 + grain + strata + pores; g = 151 + grain + strata + pores; b = 132 + grain + strata + pores;
    } else if (kind === 'timber') {
      const lines = Math.sin(x * .22 + Math.sin(y * .01) * 2) * 14;
      const seam = x % 64 < 3 || (y % 256 < 2 && Math.floor(x / 64) % 2 === Math.floor(y / 256) % 2) ? -55 : 0;
      r = 121 + grain + lines + seam; g = 88 + grain + lines + seam; b = 57 + grain + lines + seam;
    } else if (kind === 'rust') {
      const patch = Math.sin(x * .036 + Math.sin(y * .033) * 3) + Math.sin(y * .021);
      r = patch > .1 ? 123 + grain : 57 + grain; g = patch > .1 ? 71 + grain : 94 + grain; b = patch > .1 ? 38 + grain : 108 + grain;
    } else if (kind === 'shell') {
      const v=grain*.45+(noise(x/44,y/40)-.5)*28;
      r=105+v;g=112+v;b=67+v;
    } else if (kind === 'skin') {
      const row=Math.floor(y/22),xx=(x+(row%2)*12)%24,yy=y%22;
      const edge=Math.min(xx,24-xx,yy,22-yy);
      const v=grain*.45+(noise(x/19,y/17)-.5)*23;
      r=(edge<1.8?186:113)+v;g=(edge<1.8?185:133)+v;b=(edge<1.8?144:102)+v;
    } else if(kind==='soil') {
      const v=(noise(x/60,y/60)-.5)*30+(noise(x/11,y/11)-.5)*18+grain;
      r=218+v;g=211+v;b=191+v;
    } else if (kind === 'plaster') {
      const stains=(noise(x/55,y/94)-.5)*15+Math.max(0,(y-350)/162)*noise(x/31,y/17)*32;
      r=244+grain*.4-stains;g=240+grain*.4-stains;b=227+grain*.4-stains;
    } else { r = 30 + grain; g = 87 + grain; b = 110 + grain; }
    const i = (y * 512 + x) * 4; pixels.data[i] = r; pixels.data[i + 1] = g; pixels.data[i + 2] = b; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  if(kind==='shell') {
    const scute=(outline:number[][],seed:number)=>{
      const center=outline.reduce((p,v)=>[p[0]+v[0]/outline.length,p[1]+v[1]/outline.length],[0,0]);
      ctx.save();ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
      const fill=ctx.createRadialGradient(center[0],center[1],2,center[0],center[1],86);
      fill.addColorStop(0,'rgba(186,164,97,.36)');fill.addColorStop(1,'rgba(42,63,35,.28)');ctx.fillStyle=fill;ctx.fillRect(0,0,512,512);
      for(let ray=0;ray<38;ray++) {
        const a=ray/38*Math.PI*2,r=36+rnd(ray+seed)*16;
        ctx.strokeStyle=ray%3?'rgba(54,72,35,.28)':'rgba(191,178,113,.32)';ctx.lineWidth=.7+rnd(ray+8)*1.4;
        ctx.beginPath();ctx.moveTo(center[0]+Math.cos(a)*r*.4,center[1]+Math.sin(a)*r*.4);
        ctx.quadraticCurveTo(center[0]+Math.cos(a+.08)*r,center[1]+Math.sin(a+.08)*r,center[0]+Math.cos(a)*140,center[1]+Math.sin(a)*140);ctx.stroke();
      }
      ctx.restore();ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
      ctx.strokeStyle='#52613c';ctx.lineWidth=2.4;ctx.stroke();ctx.strokeStyle='rgba(215,202,148,.65)';ctx.lineWidth=.8;ctx.stroke();
    };
    for(let i=0;i<5;i++) {
      const x=78+i*86;scute([[x-43,256],[x-22,202],[x+22,202],[x+43,256],[x+22,310],[x-22,310]],i*97);
    }
    for(const side of [-1,1])for(let i=0;i<4;i++) {
      const x=98+i*103,edge=Math.sqrt(Math.max(0,1-((x-256)/256)**2))*220;
      scute([[x-47,256+side*55],[x+34,256+side*55],[x+54,256+side*(edge-12)],[x-5,256+side*edge],[x-50,256+side*(edge-22)]],i*51+side*23);
    }
  }
  surfaceTextureSources.set(kind,c);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping; map.anisotropy = 4;
  return map;
}

function material(color: T.ColorRepresentation, roughness = .75, map?: T.Texture) {
  return new T.MeshStandardMaterial({ color, roughness, map: map ?? null });
}
function mesh(geometry: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) {
  const item = new T.Mesh(geometry, mat); item.position.set(x, y, z); item.receiveShadow = true; parent.add(item); return item;
}
function box(parent: T.Object3D, mat: T.Material, pos: [number, number, number], size: [number, number, number], radius = .03) {
  return mesh(new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(v => v * .2))), mat, parent, ...pos);
}
function pipe(parent: T.Object3D, mat: T.Material, points: T.Vector3[], radius: number, segments = 16) {
  return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), segments, radius, 6, false), mat, parent);
}
function shapeMesh(vertices: number[], indices: number[], mat: T.Material, parent: T.Object3D) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  // The survey hull and gables are authored meshes; mapped materials need real coordinates.
  g.computeBoundingBox();const size=new T.Vector3();g.boundingBox!.getSize(size);
  const uv:number[]=[];for(let i=0;i<vertices.length;i+=3)uv.push((size.z>size.x?vertices[i+2]:vertices[i])*.25,vertices[i+1]*.25);
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return mesh(g, mat, parent);
}
function colored(geometry: T.BufferGeometry, color: T.ColorRepresentation) {
  const c = new T.Color(color); const n = geometry.getAttribute('position').count;
  geometry.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3)); return geometry;
}
function finGeometry(outline: T.Vector3[], thickness = .022) {
  outline = new T.CatmullRomCurve3(outline,true,'centripetal').getPoints(outline.length*4).slice(0,-1);
  const vertices: number[] = []; const indices: number[] = [];
  const center = outline.reduce((v, p) => v.add(p), new T.Vector3()).divideScalar(outline.length);
  vertices.push(center.x, center.y, center.z - thickness, center.x, center.y, center.z + thickness);
  outline.forEach(p => vertices.push(p.x, p.y, p.z));
  for (let i = 0; i < outline.length; i++) { const a = i + 2, b = ((i + 1) % outline.length) + 2; indices.push(0, b, a, 1, a, b); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  g.setAttribute('uv', new T.Float32BufferAttribute(Array.from({ length: vertices.length / 3 }, (_, i) => [i / (outline.length + 2), i % 2]).flat(), 2)); return g;
}

export class ExpeditionWorld {
  readonly group = new T.Group();
  private readonly undersea = new T.Group();
  readonly walking = new IslandWalk(islandHeight);
  readonly rockBounds: RockBounds[] = [];
  readonly animals: Animal[] = [];
  readonly sites = new Map<string, T.Group>();
  readonly wreck = new T.Group();
  readonly passageClearance=passageClearanceHeight();
  private readonly time = { value: 0 };
  private readonly underwater = { value: 0 };
  private readonly grasses: T.InstancedMesh[] = [];
  private grassGeometry: T.BufferGeometry;
  private readonly animatedMaterials: T.MeshStandardMaterial[] = [];
  private turtleMaterials?: { shell:T.MeshStandardMaterial; skin:T.MeshStandardMaterial };
  private readonly coralGeometryCache=new Map<string,T.BufferGeometry>();
  private readonly v = new T.Vector3();
  private readonly projected = new T.Vector3();
  private readonly photoRay = new T.Raycaster();
  readonly diveLight = new T.SpotLight(0xe1f6ff, 36, 38, .47, .6, 1.2);
  readonly navBuoys: T.Group[] = [];

  constructor(private scene: T.Scene) {
    this.group.name = 'Authored expedition bay'; scene.add(this.group);
    this.createSeabed(); this.createReef(); this.createLagoon(); this.createPassage(); this.createWildlife(); this.createWreck();
    const submerged=[...this.group.children];
    this.createHarbor();
    const surface=new Set(this.group.children);
    this.createResearchSites();
    submerged.push(...this.group.children.filter(child=>!surface.has(child)));
    this.undersea.name='Submerged expedition environment';this.group.add(this.undersea);
    for(const child of submerged)this.undersea.add(child);
    this.createLagoonSites();
    scene.add(this.diveLight, this.diveLight.target); this.diveLight.visible = false;
  }

  private caustics(mat: T.MeshStandardMaterial) {
    mat.onBeforeCompile = shader => {
      shader.uniforms.expeditionTime = this.time; shader.uniforms.expeditionUnderwater = this.underwater;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 expeditionWorldPos;').replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 expeditionVertex = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          expeditionVertex = instanceMatrix * expeditionVertex;
        #endif
        expeditionWorldPos = (modelMatrix * expeditionVertex).xyz;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 expeditionWorldPos; uniform float expeditionTime; uniform float expeditionUnderwater;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float ripple = sin(expeditionWorldPos.x * 2.7 + sin(expeditionWorldPos.z * 2.2 + expeditionTime * .8)) + sin(expeditionWorldPos.z * 3.4 - expeditionTime * .95 + cos(expeditionWorldPos.x * 2.0));
        float caustic = smoothstep(1.35, 1.85, ripple) * .22 * expeditionUnderwater;
        outgoingLight += vec3(.10, .28, .30) * caustic;
        #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'expedition-caustics-v2';return mat;
  }

  private createSeabed() {
    const geo = new T.PlaneGeometry(720, 660, 180, 170); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -110);
    const p = geo.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, expeditionFloor(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals(); const tex = surfaceTexture('sand'); tex.repeat.set(100, 90);
    const sand = this.caustics(material(0xe2e0cb, .94, tex)); sand.bumpMap = tex; sand.bumpScale = .035;
    const bed = mesh(geo, sand, this.group); bed.name = 'Contoured sand channels';
  }

  private rockGeometry(seed: number, detail = 1) {
    const geo = new T.SphereGeometry(1, Math.max(10, Math.round(32 * detail)), Math.max(8, Math.round(22 * detail))); const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
      const layers = Math.sin(y * 18 + a * 1.8 + seed) * .055 + Math.sin(a * 5 + y * 7) * .085;
      const deform = 1 + layers + Math.sin(x * 8 + z * 6 + seed) * .038;
      const shelf=T.MathUtils.lerp(y,Math.floor(y*5)/5,.38);
      p.setXYZ(i, x * deform, shelf + Math.sin(a * 3 + seed) * .09, z * deform);
    } geo.computeVertexNormals(); return geo;
  }

  private coastRockGeometry(seed:number){
    const geo=new T.SphereGeometry(1,28,22),p=geo.getAttribute('position');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const ax=Math.sign(x)*Math.pow(Math.abs(x),.69),az=Math.sign(z)*Math.pow(Math.abs(z),.66);
      const erode=noise(ax*5+seed,az*5+seed*3)-.5;
      const ledge=Math.sin(y*15+seed)*.05;
      const height=T.MathUtils.clamp(y,-.75,.62)+noise(ax*3+seed,az*3)*.18;
      p.setXYZ(i,ax*(.90+erode*.23+ledge)+height*.14,height,az*(.88+erode*.19+ledge)+Math.sin(seed)*height*.11);
    }geo.computeVertexNormals();return geo;
  }

  private createReef() {
    const stoneMap = new T.TextureLoader().load('/textures/expedition/coastal-limestone.png');stoneMap.colorSpace=T.SRGBColorSpace;stoneMap.wrapS=stoneMap.wrapT=T.RepeatWrapping;stoneMap.anisotropy=4;stoneMap.repeat.set(2,2);
    const stone = this.caustics(material(0xd4d5be, .9, stoneMap)); stone.bumpMap = stoneMap; stone.bumpScale = .12;
    for (let template = 0; template < 4; template++) {
      const instances = new T.InstancedMesh(this.rockGeometry(template * 2.3), stone, 22); const matrix = new T.Matrix4(); const q = new T.Quaternion();
      for (let i = 0; i < 22; i++) {
        const n = template * 22 + i; const z = -51 - rnd(n + 90) * 113;
        const channelX = Math.sin((z + 90) * .05) * 6;
        const side = n % 2 ? -1 : 1; const x = channelX + side * (16 + rnd(n + 8) * 34);
        const radii = new T.Vector3(2.3 + rnd(n + 4) * 3.8, 1.3 + rnd(n + 2) * 2.8, 2.1 + rnd(n + 5) * 3.7);
        const position = new T.Vector3(x, expeditionFloor(x, z) + radii.y * .45, z);
        matrix.compose(position, q.setFromAxisAngle(UP, rnd(n + 87) * 6.28), radii); instances.setMatrixAt(i, matrix);
        this.rockBounds.push({ center: position.clone(), radii: radii.clone().multiplyScalar(.87) });
      } instances.computeBoundingSphere(); instances.receiveShadow = true; instances.name = 'Weathered limestone shelves'; this.group.add(spatialLod(instances,[instances.geometry,this.rockGeometry(template*2.3,.55),this.rockGeometry(template*2.3,.32)]));
    }
    const coralTypes = [this.branchCoral(), this.plateCoral(), this.brainCoral(), this.seaFan()];
    const coralMedium = [this.branchCoral(.55), this.plateCoral(.55), this.brainCoral(.55), this.seaFan(.55)];
    const coralLow = [this.branchCoral(.3), this.plateCoral(.3), this.brainCoral(.3), this.seaFan(.3)];
    const coralMap=new T.TextureLoader().load('/textures/expedition/living-coral.png');coralMap.colorSpace=T.SRGBColorSpace;coralMap.wrapS=coralMap.wrapT=T.RepeatWrapping;coralMap.anisotropy=4;
    const coralColors = [0x9a7950, 0xb59e62, 0xa99a57, 0xb26876];
    coralTypes.forEach((geo, kind) => {
      const mat = this.caustics(material(kind===2?0xffffff:coralColors[kind], .86,kind===2?coralMap:undefined));mat.bumpMap=coralMap;mat.bumpScale=kind===2?.06:.012;if (kind === 3) mat.side = T.DoubleSide;
      const batch = new T.InstancedMesh(geo, mat, 22); const matrix = new T.Matrix4(); const q = new T.Quaternion();
      for (let i = 0; i < 22; i++) {
        const n = kind * 38 + i; const bound = this.rockBounds[(n * 7) % this.rockBounds.length];
        const x = bound.center.x + (rnd(n + 780) - .5) * bound.radii.x; const z = bound.center.z + (rnd(n + 567) - .5) * bound.radii.z;
        const scale = .75 + rnd(n + 222) * 1.4;
        matrix.compose(new T.Vector3(x, bound.center.y + bound.radii.y * .7, z), q.setFromAxisAngle(UP, rnd(n + 47) * 6.28), new T.Vector3(scale, scale, scale)); batch.setMatrixAt(i, matrix);
        batch.setColorAt(i, new T.Color(coralColors[kind]).multiplyScalar(.78 + rnd(n) * .4));
      } batch.computeBoundingSphere(); batch.name = ['Branching staghorn', 'Layered plate coral', 'Ridged brain coral', 'Delicate sea fans'][kind]; this.group.add(spatialLod(batch,[geo,coralMedium[kind],coralLow[kind]]));
    });
    // Authored close-range reef gardens frame the sample route while leaving its center open.
    const gardens=[[-10,-82],[-12,-90],[-7,-98],[5,-80],[14,-90],[17,-101],[0,-108]];
    gardens.forEach(([x,z],garden)=>{
      const floor=expeditionFloor(x,z),radii=new T.Vector3(2.7+rnd(garden)*1.5,1.0+rnd(garden+73)*.8,2.3+rnd(garden+15)*1.5);
      const rock=mesh(this.rockGeometry(garden+940),stone,this.group,x,floor+radii.y*.20,z);rock.scale.copy(radii);rock.rotation.y=garden*.82;
      this.rockBounds.push({center:rock.position.clone(),radii:radii.clone().multiplyScalar(.85)});
      for(let type=0;type<4;type++){
        const mat=this.caustics(material(type===2?0xffffff:coralColors[type],.88,type===2?coralMap:undefined));mat.bumpMap=coralMap;mat.bumpScale=type===2?.045:.013;if(type===3)mat.side=T.DoubleSide;
        const colony=new T.InstancedMesh(coralTypes[type],mat,9),matrix=new T.Matrix4(),q=new T.Quaternion();
        for(let i=0;i<9;i++){const angle=i*2.4+type*.9,r=.25+rnd(i+garden*19+type*73)*(1.6+rnd(garden+type*11)*.9),cx=x+Math.cos(angle)*r,cz=z+Math.sin(angle)*r;
          const top=rock.position.y+radii.y*Math.sqrt(Math.max(0,1-((cx-x)/radii.x)**2-((cz-z)/radii.z)**2))*.86;
          const cy=Math.max(floor+.045,top-.065),s=.48+rnd(i+type*93+garden*43)*.68;
          matrix.compose(new T.Vector3(cx,cy,cz),q.setFromEuler(new T.Euler((rnd(i+7)-.5)*.14,angle,(rnd(i+51)-.5)*.12)),new T.Vector3(s*(.88+rnd(i+4)*.2),s,s));colony.setMatrixAt(i,matrix);colony.setColorAt(i,new T.Color(0xffffff).multiplyScalar(.80+rnd(i+type*55)*.24));}
        colony.computeBoundingSphere();colony.receiveShadow=true;colony.castShadow=true;this.group.add(spatialLod(colony,[coralTypes[type],coralMedium[type],coralLow[type]]));
      }
      const rubble=new T.InstancedMesh(this.rockGeometry(garden+134),stone,28),rm=new T.Matrix4();
      for(let i=0;i<28;i++){const a=i*2.4,r=2.5+rnd(i+garden*83)*2,cx=x+Math.cos(a)*r,cz=z+Math.sin(a)*r,s=.09+rnd(i+25)*.25;rm.compose(new T.Vector3(cx,expeditionFloor(cx,cz)+s*.2,cz),new T.Quaternion().setFromAxisAngle(UP,a),new T.Vector3(s,s*.45,s*.8));rubble.setMatrixAt(i,rm);}rubble.computeBoundingSphere();rubble.receiveShadow=true;this.group.add(spatialLod(rubble,[rubble.geometry,this.rockGeometry(garden+134,.32)]));
    });
    const blades: T.BufferGeometry[] = [];
    for (let blade = 0; blade < 9; blade++) {
      const verts: number[] = []; const indices: number[] = []; const a = blade * 2.4; const length = .55 + rnd(blade) * 1.2;
      for (let j = 0; j <= 18; j++) {
        const t = j / 18; const w = .023 * Math.pow(Math.sin(Math.PI * Math.max(.02, t)),.65);
        for (const side of [-1,0,1]) verts.push(Math.cos(a)*t*t*(.65+rnd(blade+33)*.7)+Math.cos(a+1.57)*w*side,length*(t-.30*t*t)+w*(1-Math.abs(side))*.6,Math.sin(a)*t*t*(.65+rnd(blade+33)*.7)+Math.sin(a+1.57)*w*side);
        if (j < 18)for(let edge=0;edge<2;edge++) { const k = j * 3+edge; indices.push(k,k+1,k+4,k,k+4,k+3); }
      } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); g.setIndex(indices); g.computeVertexNormals(); blades.push(g);
    }
    const grassGeo = mergeGeometries(blades)!; this.grassGeometry=grassGeo; const grassMat = this.caustics(material(0x44754b, .8)); grassMat.side = T.DoubleSide;
    grassMat.onBeforeCompile = ((original) => shader => {
      original(shader); shader.uniforms.expeditionTime = this.time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float expeditionTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(expeditionTime * 1.2 + position.y * 2.0) * position.y * .08;');
    })(grassMat.onBeforeCompile.bind(grassMat));
    const grass = new T.InstancedMesh(grassGeo, grassMat, 480); const mat = new T.Matrix4(); const q = new T.Quaternion();
    for (let i = 0; i < 480; i++) {
      const x = (rnd(i + 577) - .5) * 109; const z = -35 - rnd(i + 1201) * 132;
      const s = .5 + rnd(i + 911) * .75; mat.compose(new T.Vector3(x, expeditionFloor(x, z) + .03, z), q.setFromAxisAngle(UP, i * 2.4), new T.Vector3(s, s, s)); grass.setMatrixAt(i, mat);
    } grass.computeBoundingSphere(); grass.name = 'Current-swept seagrass'; this.group.add(spatialLod(grass,[grassGeo]));
  }

  private createLagoon() {
    const grassMat = this.caustics(material(0x5b8052,.82)); grassMat.side=T.DoubleSide;
    grassMat.customProgramCacheKey=()=> 'lagoon-eelgrass-v1';
    grassMat.onBeforeCompile = ((original) => shader => {
      original(shader); shader.uniforms.expeditionTime=this.time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float expeditionTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(expeditionTime*.8+position.y*2.0)*position.y*.13;');
    })(grassMat.onBeforeCompile.bind(grassMat));
    const grass=new T.InstancedMesh(this.grassGeometry,grassMat,480), matrix=new T.Matrix4(), q=new T.Quaternion();
    const beds=[[-125,-91],[-113,-79],[-94,-98],[-105,-117],[-133,-112]];
    let count=0;
    for(let i=0;i<480;i++) {
      const bed=beds[i%beds.length],a=rnd(i+4701)*Math.PI*2, r=Math.sqrt(rnd(i+6601))*(8+i%3*2);
      const x=bed[0]+Math.cos(a)*r,z=bed[1]+Math.sin(a)*r,scale=.7+rnd(i+91)*.6;
      // Keep the diagonal survey channel and collection sites clear between beds.
      if(Math.abs((x+115)*.62-(z+101)*.78)<2.4||Object.values(LAGOON_SAMPLES).some(p=>Math.hypot(x-p.x,z-p.z)<3.5))continue;
      matrix.compose(new T.Vector3(x,expeditionFloor(x,z)+.03,z),q.setFromAxisAngle(UP,a),new T.Vector3(scale,scale*1.35,scale));
      grass.setMatrixAt(count,matrix);grass.setColorAt(count,new T.Color().setHSL(.23+rnd(i+77)*.05,.25,.34+rnd(i+88)*.15));count++;
    }
    grass.count=count;
    grass.name='Western eelgrass meadow';this.group.add(spatialLod(grass,[this.grassGeometry]));
    const map=new T.TextureLoader().load('/textures/expedition/coastal-limestone.png');map.colorSpace=T.SRGBColorSpace;
    const stone=this.caustics(material(0xbcc7b4,.9,map));
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6,r=38+rnd(i+9001)*5,x=LAGOON_SITE.x+Math.cos(a)*r,z=LAGOON_SITE.z+Math.sin(a)*r;
      const boulder=mesh(this.coastRockGeometry(i+111),stone,this.group,x,expeditionFloor(x,z)+.7,z);
      boulder.scale.set(2.5+rnd(i+61)*3,1.4,2.5+rnd(i+71)*2);boulder.rotation.y=a;
      this.rockBounds.push({center:boulder.position.clone(),radii:new T.Vector3(boulder.scale.x*.75,1,boulder.scale.z*.75)});
    }
    for(let i=0;i<6;i++) {
      const x=-137+i*2.3,z=-80+Math.sin(i*.8)*3,scale=1.8+rnd(i+610)*1.6;
      const ledge=mesh(this.coastRockGeometry(i+650),stone,this.group,x,expeditionFloor(x,z)+.35,z);
      ledge.scale.set(scale,.7+rnd(i+98)*.7,scale*.8);ledge.rotation.y=i*.62;
      this.rockBounds.push({center:ledge.position.clone(),radii:new T.Vector3(scale*.75,ledge.scale.y*.7,scale*.65)});
    }
  }

  private createPassage() {
    const map = new T.TextureLoader().load('/textures/expedition/coastal-limestone.png');
    map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(3,2);map.anisotropy=4;
    const stone=this.caustics(material(0xd2d4c4,.91,map));stone.bumpMap=map;stone.bumpScale=.10;
    const shelfPositions:T.Vector3[]=[];
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5,x=GARDEN_SITE.x+Math.cos(a)*(12+rnd(i+34)*4),z=GARDEN_SITE.z+Math.sin(a)*15;
      if(Object.values(PASSAGE_SAMPLES).some(site=>Math.hypot(site.x-x,site.z-z)<5))continue;
      const scale=new T.Vector3(2.6+rnd(i+71)*1.5,1.1+rnd(i+81)*.6,2.6+rnd(i+21)),p=new T.Vector3(x,expeditionFloor(x,z)+.4,z);
      const rock=mesh(this.rockGeometry(i+801,.65),stone,this.group,x,p.y,z);rock.scale.copy(scale);rock.rotation.y=a;
      this.rockBounds.push({center:p,radii:scale.clone().multiplyScalar(.85)});
      shelfPositions.push(new T.Vector3(x,p.y+scale.y*.78,z));
    }
    const floor=expeditionFloor(PASSAGE_SITE.x,PASSAGE_SITE.z),vertices:number[]=[],uv:number[]=[],indices:number[]=[];
    const segments=64,rings=20;
    // A continuous eroded vault, not a solid collider across the swim-through opening.
    for(let row=0;row<=segments;row++)for(let col=0;col<=rings;col++) {
      const a=row/segments*Math.PI,b=col/rings*Math.PI*2,radial=Math.cos(b);
      const erosion=noise(Math.cos(a)*8+Math.sin(b)*2,Math.sin(a)*9+Math.cos(b)*2)-.5;
      vertices.push(PASSAGE_SITE.x+(6.8+radial*(1.75+erosion*.27))*Math.cos(a),floor+3+(7.6+radial*(1.5+erosion*.22))*Math.sin(a),PASSAGE_SITE.z+Math.sin(b)*(8+erosion*.28));
      uv.push(row/segments*4,col/rings);
      if(row<segments&&col<rings){const n=row*(rings+1)+col;indices.push(n,n+rings+2,n+1,n,n+rings+1,n+rings+2);}
    }
    const vault=new T.BufferGeometry();vault.setAttribute('position',new T.Float32BufferAttribute(vertices,3));vault.setAttribute('uv',new T.Float32BufferAttribute(uv,2));vault.setIndex(indices);vault.computeVertexNormals();
    const arch=mesh(vault,stone,this.group);arch.name='Eroded limestone swim-through arch';
    this.rockBounds.push(...limestoneArchBounds());
    for(const side of [-1,1]) {
      const x=PASSAGE_SITE.x+side*6.8,z=PASSAGE_SITE.z;
      const foot=mesh(this.rockGeometry(side+911,.65),stone,this.group,x,floor+1,z);foot.scale.set(2.4,2.7,8.5);
      this.rockBounds.push({center:foot.position.clone(),radii:new T.Vector3(2.2,2.4,8.3)});
      for(let i=0;i<4;i++)shelfPositions.push(new T.Vector3(x+side*.7,floor+2.7+i*.35,z-2+i*1.3));
    }
    for(const [kind,color] of [[0,0xb69972],[1,0xa46e84]] as const) {
      const geometry=kind===0?this.plateCoral(.55):this.seaFan(.55),low=kind===0?this.plateCoral(.3):this.seaFan(.3);
      const mat=this.caustics(material(color,.86));if(kind===1)mat.side=T.DoubleSide;
      const colony=new T.InstancedMesh(geometry,mat,shelfPositions.length*3),matrix=new T.Matrix4(),q=new T.Quaternion();
      shelfPositions.forEach((p,shelf)=>{for(let i=0;i<3;i++) {
        const index=shelf*3+i,scale=.55+rnd(index+kind*31)*.7,a=i*2.4+shelf;
        matrix.compose(p.clone().add(new T.Vector3(Math.cos(a)*.6,0,Math.sin(a)*.7)),q.setFromAxisAngle(UP,a),new T.Vector3(scale,scale,scale));
        colony.setMatrixAt(index,matrix);colony.setColorAt(index,new T.Color().setHSL(kind===0?.12:.94,.23,.55+rnd(index)*.13));
      }});
      colony.name=kind===0?'Eastern coral terraces':'Passage sea fans';this.group.add(spatialLod(colony,[geometry,low]));
    }
  }

  private branchCoral(detail = 1) {
    const geometries: T.BufferGeometry[] = [];
    const grow = (from: T.Vector3, direction: T.Vector3, length: number, radius: number, depth: number, seed: number) => {
      const tip = from.clone().addScaledVector(direction, length); const middle = from.clone().lerp(tip, .5).add(new T.Vector3(Math.sin(seed) * .15, .05, Math.cos(seed) * .13));
      const geometry = new T.TubeGeometry(new T.CatmullRomCurve3([from, middle, tip]), Math.max(3, Math.round(12*detail)), radius, Math.max(4, Math.round(10*detail)), false); geometries.push(geometry);
      const cap = new T.SphereGeometry(radius, Math.max(6, Math.round(12*detail)), Math.max(4, Math.round(8*detail))); cap.translate(tip.x, tip.y, tip.z); geometries.push(cap);
      if (depth > 0) for (let i = 0; i < 3; i++) grow(tip, new T.Vector3(Math.sin(seed + i * 2.1) * .65, .8, Math.cos(seed + i * 2.1) * .65).normalize(), length * .62, radius * .57, depth - 1, seed + i + 3.7);
    };
    for (let i = 0; i < 5; i++) grow(new T.Vector3(Math.sin(i)*.13,0,Math.cos(i)*.13),new T.Vector3(Math.sin(i*2.4)*.5,1,Math.cos(i*2.4)*.5).normalize(),.75+rnd(i)*.30,.115,2,i*4.1);
    return mergeGeometries(geometries)!;
  }

  private plateCoral(detail = 1) {
    const key=`plate:${detail}`,cached=this.coralGeometryCache.get(key);if(cached)return cached;
    const geos: T.BufferGeometry[] = [];
    for (let layer = 0; layer < 4; layer++) {
      const geo = new T.SphereGeometry(1, Math.max(16,Math.round(64*detail)), Math.max(6,Math.round(14*detail)), 0, Math.PI * 2, 0, Math.PI * .60); const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); const s = 1 - layer * .14;
        const lobes=1+Math.sin(a*5+layer)*.11+Math.sin(a*11+layer*.7)*.04;
        p.setXYZ(i, x*s*lobes+layer*.13,layer*.24+(1-p.getY(i))*.09+Math.sin(a*9+layer)*r*.035,z*s*lobes);
      } geo.computeVertexNormals(); geos.push(geo);
    } const geometry=mergeGeometries(geos)!;this.coralGeometryCache.set(key,geometry);return geometry;
  }

  private brainCoral(detail = 1) {
    const key=`brain:${detail}`,cached=this.coralGeometryCache.get(key);if(cached)return cached;
    const geo = new T.SphereGeometry(.95, Math.max(16,Math.round(48*detail)), Math.max(10,Math.round(24*detail)), 0, Math.PI * 2, 0, Math.PI * .58); const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ridge = Math.sin(Math.atan2(z, x) * 25 + Math.sin(y * 16) * 2.8) * .045;
      p.setXYZ(i, x * (1 + ridge), y * .72 + ridge * .5, z * (1 + ridge));
    } geo.computeVertexNormals();this.coralGeometryCache.set(key,geo);return geo;
  }

  private seaFan(detail = 1) {
    const key=`fan:${detail}`,cached=this.coralGeometryCache.get(key);if(cached)return cached;
    const geos: T.BufferGeometry[] = [];
    const grow=(start:T.Vector3,angle:number,length:number,radius:number,depth:number,seed:number)=>{
      const end=start.clone().add(new T.Vector3(Math.sin(angle)*length,Math.cos(angle)*length,.025*Math.sin(seed))),mid=start.clone().lerp(end,.48).add(new T.Vector3(.035*Math.sin(seed),.025,.03*Math.cos(seed)));
      geos.push(new T.TubeGeometry(new T.CatmullRomCurve3([start,mid,end]),Math.max(3,Math.round(8*detail)),radius,Math.max(4,Math.round(6*detail)),false));
      if(depth>0){const spread=.22+rnd(seed)*.26;grow(end,angle-spread,length*(.62+rnd(seed+5)*.14),radius*.68,depth-1,seed+4.7);grow(end,angle+spread,length*(.64+rnd(seed+7)*.12),radius*.68,depth-1,seed+12.3);}
    };
    for(let i=0;i<7;i++)grow(new T.Vector3(),(i-3)*.25,.52+rnd(i+5)*.25,.031,3,i*8.3);
    const geometry=mergeGeometries(geos)!;this.coralGeometryCache.set(key,geometry);return geometry;
  }

  private fishBody(shark: boolean, color: T.ColorRepresentation, species:SpeciesKey) {
    const verts: number[] = [], uv: number[] = [], indices: number[] = [], cols: number[] = [];
    const c = new T.Color(color); const rows = shark ? 64 : 48, rings = 40;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows; const x = (t - .5) * (shark ? 4.7 : 1.05);
      const profile = Math.pow(Math.sin(Math.PI * t), .7) * (shark ? .38 : species==='anthias'?.18:.25);
      for (let j = 0; j <= rings; j++) { const a = j / rings * Math.PI * 2;
        const y = Math.sin(a) * profile * (shark ? .85 : 1.18); const z = Math.cos(a) * profile * (shark ? 1 : .34);
        verts.push(x, y, z); uv.push(t, j / rings);
        const belly = y < -.07; const stripe = !shark && Math.sin(t * 35) > .55;
        let cc = belly && shark ? new T.Color(0xd7d6ba) : c.clone().multiplyScalar(stripe ? .75 : .9 + Math.sin(a) * .14);
        if(species==='tang'&&t>.23&&t<.78&&y>.015+.07*Math.sin((t-.23)/.55*Math.PI)&&Math.abs(z)>.022)cc=new T.Color(0x102944);
        if(species==='butterflyfish'&&((t>.73&&t<.83)||(t>.16&&t<.24)))cc=new T.Color(0x333d3a);
        cc.multiplyScalar(.96+(noise(t*34,j*.65)-.5)*.12);cols.push(cc.r, cc.g, cc.b);
        if (i < rows && j < rings) { const n = i * (rings + 1) + j; indices.push(n, n + rings + 2, n + 1, n, n + rings + 1, n + rings + 2); }
      }
    } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }

  private createFish(key: SpeciesKey) {
    const shark = key === 'reefshark' || key === 'hammerhead'; const root = new T.Group();
    const color = key === 'tang' ? 0x2264ac : key === 'anthias' ? 0xde7657 : key === 'butterflyfish' ? 0xdbbb56 : 0x849b9d;
    const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .56, metalness: 0 });
    const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle=shark?'#c2c6c5':'#d2c9b0';ctx.fillRect(0,0,512,256);
    const skinGradient=ctx.createLinearGradient(0,0,0,256);skinGradient.addColorStop(0,'#c3c5be');skinGradient.addColorStop(.25,'#a8b2a7');skinGradient.addColorStop(.55,'#e4d7ba');skinGradient.addColorStop(1,'#b5baa8');ctx.fillStyle=skinGradient;ctx.fillRect(0,0,512,256);
    ctx.strokeStyle=shark?'#959f9b':'#887f69';ctx.lineWidth=1.1;
    for(let row=0;row<40;row++)for(let col=0;col<70;col++){const x=col*8+(row%2)*4,y=row*7;ctx.beginPath();ctx.arc(x,y,4,-.9,.9);ctx.stroke();ctx.strokeStyle='rgba(242,238,214,.35)';ctx.beginPath();ctx.arc(x+1,y,3.4,-.9,.9);ctx.stroke();ctx.strokeStyle=shark?'#959f9b':'#887f69';}
    for(let i=0;i<3500;i++){ctx.fillStyle=i%3?'rgba(63,83,76,.10)':'rgba(242,237,212,.19)';ctx.fillRect(rnd(i+21)*512,rnd(i+55)*256,1,1);}
    const skin=new T.CanvasTexture(c);skin.colorSpace=T.SRGBColorSpace;skin.anisotropy=4;mat.map=skin;mat.bumpMap=skin;mat.bumpScale=shark?.009:.006;
    const parts = [this.fishBody(shark, color,key)];
    const fin = (v: [number, number, number][], c: number) => {
      const g=finGeometry(v.map(p => new T.Vector3(...p)));parts.push(colored(g,c));
      // Fin rays converge at the attachment and follow the thin membrane.
      const anchor=new T.Vector3(...v[0]);for(let edge=1;edge<v.length-1;edge++)for(let j=0;j<4;j++){
        const tip=new T.Vector3(...v[edge]).lerp(new T.Vector3(...v[edge+1]),j/4),mid=anchor.clone().lerp(tip,.55);mid.z+=.004;
        const ray=new T.TubeGeometry(new T.CatmullRomCurve3([anchor,mid,tip]),5,shark?.003:.0018,4,false);parts.push(colored(ray,new T.Color(c).multiplyScalar(.58).getHex()));
      }
    };
    const s = shark ? 1 : .26;
    fin([[-2.15*s,0,0],[-2.85*s,1.05*s,0],[-2.55*s,.12*s,0],[-2.86*s,-.75*s,0],[-2.10*s,-.05*s,0]], shark ? 0x546966 : 0xe4c35b);
    fin([[.1*s,.28*s,0],[-.7*s,1.25*s,0],[-1.02*s,.19*s,0]], shark ? 0x3b4e50 : color);
    for (const side of [-1,1]) {
      fin([[.5*s,-.08*s,side*.18*s],[-.8*s,-.28*s,side*1.15*s],[-.35*s,-.12*s,side*.30*s]], color);
      const eye = colored(new T.SphereGeometry(shark ? .047 : .016, 24, 16), 0x111d1e); eye.translate(shark ? 1.85 : .39, .10*s, side * (shark ? .23 : .051)); parts.push(eye);
      const glint = colored(new T.SphereGeometry(shark ? .014 : .004, 6, 4), 0xe5f2e8); glint.translate(shark ? 1.86 : .397, .11*s, side * (shark ? .265 : .064)); parts.push(glint);
      if (shark) for (let g = 0; g < 5; g++) {
        const gill = new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(1.20-g*.12,.16,side*.30),new T.Vector3(1.25-g*.12,-.13,side*.29)]),3,.012,4,false); parts.push(colored(gill,0x455d5d));
      }
      if(!shark){
        const operculum=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.25,.14,side*.052),new T.Vector3(.21,.01,side*.077),new T.Vector3(.27,-.13,side*.044)]),12,.006,6,false);parts.push(colored(operculum,0x3e5351));
        for(let ray=0;ray<9;ray++){const k=ray/8;const finRay=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.54,0,side*.009),new T.Vector3(-.71+k*.04,(k-.5)*.38,side*.012)]),2,.0015,4,false);parts.push(colored(finRay,0xc5b579));}
      }
    }
    if (key === 'hammerhead') {
      const head = colored(new T.SphereGeometry(1, 24, 12), color); head.scale(.47,.23,1.0); head.translate(1.70,0,0); parts.push(head);
      for (const side of [-1, 1]) { const eye = colored(new T.SphereGeometry(.052,12,8),0x111b19); eye.translate(1.91,.07,side*.87); parts.push(eye); }
    }
    const geometry = mergeGeometries(parts)!;
    mat.onBeforeCompile = shader => {
      shader.uniforms.expeditionTime = this.time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float expeditionTime;').replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.z += sin(expeditionTime * ${shark ? '2.6' : '6.4'} + position.x * 2.5) * pow(max(0.0, -position.x / ${shark ? '2.85' : '.75'}), 1.7) * ${shark ? '.23' : '.10'};`);
    }; mat.customProgramCacheKey = () => `fish-bend-${shark}`;
    mesh(geometry, mat, root).name = `${key} anatomical body and fins`; this.animatedMaterials.push(mat); return { root, parts: [] as T.Object3D[] };
  }

  private createTurtle() {
    const root = new T.Group();
    if(!this.turtleMaterials) {
      const shellMap=surfaceTexture('shell'),skinMap=surfaceTexture('skin');
      const shell=material(0xffffff,.58,shellMap);shell.bumpMap=shellMap;shell.bumpScale=.026;
      const skin=material(0xffffff,.65,skinMap);skin.bumpMap=skinMap;skin.bumpScale=.008;
      this.turtleMaterials={shell,skin};
    }
    const {shell,skin}=this.turtleMaterials;
    const carapace = new T.SphereGeometry(1,48,28,0,Math.PI*2,0,Math.PI*.57); carapace.scale(1.25,.46,.87);
    const points=carapace.getAttribute('position'),shellUv=carapace.getAttribute('uv');
    for(let i=0;i<points.count;i++)shellUv.setXY(i,.5+points.getX(i)/2.5,.5+points.getZ(i)/1.74);
    mesh(carapace,shell,root,0,.18,0).name='Patterned carapace';
    const plastron = new T.SphereGeometry(1,24,16); plastron.scale(1.17,.20,.81); mesh(plastron,material(0xd8c799),root,0,-.06,0);
    const neck=new T.SphereGeometry(1,20,12);neck.scale(.42,.21,.24);mesh(neck,skin,root,1.1,.07,0);
    const head = new T.SphereGeometry(1,32,22); head.scale(.37,.25,.29); mesh(head,skin,root,1.48,.12,0);
    const beak=new T.SphereGeometry(1,20,12);beak.scale(.13,.12,.20);mesh(beak,material(0xc5ba8d,.63),root,1.78,.035,0);
    const dark=material(0x1d302b,.42),rim=material(0xadb499,.67);
    for(const side of [-1,1]) {
      const lid=new T.SphereGeometry(.067,16,10);lid.scale(1,.70,.45);mesh(lid,rim,root,1.59,.22,side*.242);
      mesh(new T.SphereGeometry(.043,16,10),dark,root,1.60,.22,side*.258);
      mesh(new T.SphereGeometry(.011,8,6),material(0xe1e8d7,.28),root,1.617,.234,side*.287);
      mesh(new T.SphereGeometry(.015,8,6),dark,root,1.796,.153,side*.095);
      pipe(root,dark,[new T.Vector3(1.82,.015,side*.12),new T.Vector3(1.68,-.015,side*.20),new T.Vector3(1.49,-.028,side*.22)],.005,12);
      pipe(root,rim,[new T.Vector3(1.16,.15,side*.78),new T.Vector3(.60,.11,side*.86),new T.Vector3(-.40,.08,side*.85),new T.Vector3(-1.1,.11,side*.44)],.017,24);
    }
    const tail=new T.SphereGeometry(1,16,10);tail.scale(.29,.08,.09);mesh(tail,skin,root,-1.22,-.04,0);
    const parts:T.Object3D[]=[];
    for(const side of [-1,1]) for(const front of [true,false]) {
      const pivot = new T.Group(); pivot.position.set(front?.65:-.72,0,side*.60); root.add(pivot);
      const points = front ? [[.2,0,0],[.48,-.07,side*.66],[-.50,-.09,side*1.08],[-.22,0,side*.22]] : [[.16,0,0],[-.43,-.05,side*.46],[-.67,-.06,side*.52],[-.4,0,0]];
      const fin=finGeometry(points.map(p=>new T.Vector3(...p)),.055),position=fin.getAttribute('position'),uv=fin.getAttribute('uv');
      for(let i=0;i<position.count;i++)uv.setXY(i,.5+position.getX(i)*.8,.5+position.getZ(i)*.8);
      mesh(fin,skin,pivot);parts.push(pivot);
    }
    return {root,parts};
  }

  private createRay() {
    const root = new T.Group(); const verts:number[]=[], indices:number[]=[], colors:number[]=[], uv:number[]=[];
    for(let row=0;row<=24;row++) for(let col=0;col<=32;col++) {
      const x=(row/24-.5)*2.4, t=col/32*2-1; const width=.14+Math.pow(Math.sin(row/24*Math.PI),.8)*1.95;
      const z=t*width, y=.20*Math.pow(1-t*t,2)*Math.sin(row/24*Math.PI)+.025*Math.sin(t*Math.PI); verts.push(x,y,z);uv.push(row/24,col/32);
      const spot=rnd(row*37+col)> .92; const c=new T.Color(spot?0xe4dfc3:0x4d6264); colors.push(c.r,c.g,c.b);
      if(row<24&&col<32){const n=row*33+col;indices.push(n,n+1,n+34,n,n+34,n+33);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const spotted=document.createElement('canvas');spotted.width=spotted.height=512;const spotCtx=spotted.getContext('2d')!;
    const dorsal=spotCtx.createLinearGradient(0,0,0,512);dorsal.addColorStop(0,'#7a8580');dorsal.addColorStop(.5,'#455d61');dorsal.addColorStop(1,'#7a8580');spotCtx.fillStyle=dorsal;spotCtx.fillRect(0,0,512,512);
    for(let i=0;i<260;i++){const x=rnd(i*4+19)*512,y=rnd(i*7+43)*512,r=2+rnd(i+9)*3;spotCtx.fillStyle='#d6dac9';spotCtx.beginPath();spotCtx.ellipse(x,y,r,r*.8,rnd(i)*3,0,Math.PI*2);spotCtx.fill();spotCtx.strokeStyle='rgba(221,226,211,.3)';spotCtx.lineWidth=1;spotCtx.stroke();}
    for(let i=0;i<4000;i++){spotCtx.fillStyle='rgba(24,46,46,.10)';spotCtx.fillRect(rnd(i+91)*512,rnd(i+143)*512,1,1);}
    const spotMap=new T.CanvasTexture(spotted);spotMap.colorSpace=T.SRGBColorSpace;spotMap.anisotropy=4;
    const mat=new T.MeshStandardMaterial({color:0xffffff,map:spotMap,bumpMap:spotMap,bumpScale:.004,roughness:.72,side:T.DoubleSide});
    mat.customProgramCacheKey=()=> 'spotted-eagle-ray-v3';
    mat.onBeforeCompile=shader=>{shader.uniforms.expeditionTime=this.time;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float expeditionTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += sin(expeditionTime * 2.1 + abs(position.z) * .7) * pow(abs(position.z) / 2.0, 1.5) * .43;');shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(!gl_FrontFacing) diffuseColor.rgb=vec3(.55,.60,.55);');};
    mesh(geo,mat,root);pipe(root,material(0x354849),[new T.Vector3(-.9,0,0),new T.Vector3(-2.3,.05,0),new T.Vector3(-4.1,.15,.25)],.026,22);
    const head = new T.SphereGeometry(1,32,18); head.scale(.4,.22,.30);mesh(head,material(0x83938c,.59),root,1.07,.08,0);
    const snout=new T.SphereGeometry(1,24,12);snout.scale(.25,.07,.28);mesh(snout,material(0xa0aba0,.61),root,1.34,-.015,0);
    const detail=material(0x354845,.70);
    for(const side of [-1,1]) {
      const lid=new T.SphereGeometry(.080,16,10);lid.scale(1,.52,.6);mesh(lid,material(0x81918b,.61),root,1.12,.245,side*.23);
      mesh(new T.SphereGeometry(.043,16,10),material(0x12201c,.3),root,1.16,.25,side*.254);
      const spiracle=new T.SphereGeometry(.048,12,8);spiracle.scale(1,.15,.65);mesh(spiracle,detail,root,.96,.272,side*.22);
      for(let i=0;i<5;i++)pipe(root,detail,[new T.Vector3(.65-i*.12,-.02,side*.18),new T.Vector3(.64-i*.12,-.035,side*.30)],.006,4);
    }
    pipe(root,detail,[new T.Vector3(1.36,-.07,-.12),new T.Vector3(1.38,-.08,0),new T.Vector3(1.36,-.07,.12)],.006,10);
    return {root,parts:[] as T.Object3D[]};
  }

  private createWildlife() {
    const arrangements: Array<[SpeciesKey,number,number,number,number,number]> = [
      ['turtle',2,-8.5,-88,9,.055],['ray',-6,-10,-95,15,.08],['reefshark',20,-9,-114,23,.055],['hammerhead',95,-20,-174,29,.045],
      ['butterflyfish',-4,-8,-82,6,.16],['tang',4,-9,-94,8,.13],['anthias',-3,-7.5,-96,9,.18],
    ];
    arrangements.push(['turtle',-108,-7.5,-94,8,.045],['ray',-120,-8.4,-104,11,.055]);
    arrangements.push(['turtle',146,-9,-91,7,.038],['tang',146,-10,-96,5,.13],['anthias',155,-11,-94,4,.16]);
    for (const [habitat,[key,x,y,z,radius,pace]] of arrangements.entries()) {
      const count = ['turtle','ray','reefshark','hammerhead'].includes(key) ? 1 : 7;
      const model = key === 'turtle' ? this.createTurtle() : key === 'ray' ? this.createRay() : this.createFish(key);
      for(let i=0;i<count;i++) {
        const root = i===0 ? model.root : model.root.clone(); root.name=key;this.group.add(root);
        if(count>1)root.scale.setScalar(key==='anthias'?.40:key==='tang'?(x>100?.68:.52):.57);
        this.animals.push({key,root,home:new T.Vector3(x+i*.42,y+(i%3)*.22,z+i*.38),radius:radius+i*.18,pace,phase: i*.15 + habitat*.77,parts:i===0?model.parts:[]});
      }
    }
  }

  private createWreck() {
    this.wreck.name='Lost survey launch wreck'; this.wreck.position.set(WRECK_SITE.x,-26.2,WRECK_SITE.z); this.wreck.rotation.set(.065,-.5,.10);this.group.add(this.wreck);
    const rustMap=new T.TextureLoader().load('/textures/expedition/oxidized-marine-steel.png');rustMap.colorSpace=T.SRGBColorSpace;rustMap.wrapS=rustMap.wrapT=T.RepeatWrapping;rustMap.repeat.set(1,1);rustMap.anisotropy=4;
    const steel=this.caustics(material(0xe3ddd0,.91,rustMap));steel.bumpMap=rustMap;steel.bumpScale=.045;
    const rib=material(0x685a46,.9); const dark=material(0x273e3c,.82); const verts:number[]=[],indices:number[]=[];
    for(let row=0;row<=28;row++){const t=row/28,z=(t-.5)*21;const w=3.4*Math.pow(Math.sin(Math.PI*t),.42);
      const ring=[[-w*.92,2.8,z],[-w,1.7,z],[-w*.72,.25,z],[0,0,z],[w*.72,.25,z],[w,1.7,z],[w*.92,2.8,z]];
      ring.forEach(p=>verts.push(...p));if(row<28)for(let j=0;j<6;j++){if(row>=14&&row<=20&&j<2)continue;const n=row*7+j;indices.push(n,n+7,n+8,n,n+8,n+1);}
    } const hull=shapeMesh(verts,indices,steel,this.wreck);hull.material.side=T.DoubleSide;
    // A second inset shell gives the abandoned launch real plate thickness at its gunwale.
    const inner=verts.map((v,i)=>i%3===0?v*.973:i%3===1?v+.075:v);shapeMesh(inner,indices,steel,this.wreck);
    for(const side of [-1,1]){
      const rim:T.Vector3[]=[];for(let row=1;row<28;row++){const t=row/28;rim.push(new T.Vector3(side*3.4*Math.pow(Math.sin(Math.PI*t),.42)*.92,2.8,(t-.5)*21));}
      pipe(this.wreck,steel,rim,.095,54);
      // Weld seams, fasteners, rubbing strakes and an irregular torn plate on the accessible side.
      for(let row=3;row<27;row+=3){const t=row/28,z=(t-.5)*21,w=3.4*Math.pow(Math.sin(Math.PI*t),.42);pipe(this.wreck,rib,[new T.Vector3(side*w*.94,2.62,z),new T.Vector3(side*(w+.025),1.7,z),new T.Vector3(side*w*.73,.35,z)],.013,14);
        for(const yy of [1.0,1.7,2.4]){const bolt=mesh(new T.SphereGeometry(.032,8,6),rib,this.wreck,side*w*(yy<1.3?.85:.98),yy,z+.075);bolt.scale.x=.4;}}
      const strake:T.Vector3[]=[];for(let row=2;row<27;row++){const t=row/28;strake.push(new T.Vector3(side*3.4*Math.pow(Math.sin(Math.PI*t),.42),1.73,(t-.5)*21));}pipe(this.wreck,rib,strake,.034,48);
    }
    const torn=new T.Shape();torn.moveTo(0,0);torn.lineTo(1.25,.06);torn.lineTo(1.11,.38);torn.lineTo(.83,.29);torn.lineTo(.94,.70);torn.lineTo(.45,.56);torn.lineTo(.29,.86);torn.lineTo(0,.63);torn.closePath();
    const tornPanel=mesh(new T.ExtrudeGeometry(torn,{depth:.065,bevelEnabled:false}),steel,this.wreck,-3.05,1.7,1.5);tornPanel.rotation.set(.12,-Math.PI/2,-.24);
    box(this.wreck,steel,[0,2.12,-3.9],[5.0,.18,7]);box(this.wreck,steel,[0,2.12,6.6],[4.1,.18,2]);box(this.wreck,steel,[1.7,2.12,2.5],[1.2,.18,5.8]);
    // Curled fracture remnants surround a large visible breach; exposed ribs sit behind it.
    for(let row=14;row<=21;row++){const t=row/28,z=(t-.5)*21,w=3.4*Math.pow(Math.sin(Math.PI*t),.42);
      const tab=box(this.wreck,steel,[-w*.95,1.05,z],[.065,.35+rnd(row)*.3,.52]);tab.rotation.set(.08,.30+rnd(row+9)*.6,.25+rnd(row+39)*.55);}
    for(let z=-7;z<=7;z+=1.4){pipe(this.wreck,rib,[new T.Vector3(-2.7,2.55,z),new T.Vector3(-2.6,.9,z),new T.Vector3(0,.4,z),new T.Vector3(2.6,.9,z),new T.Vector3(2.7,2.55,z)],.07,12);}
    // Open broken wheelhouse, window frames and roof panels. The mission remains outside.
    box(this.wreck,steel,[0,2.65,-3],[4.4,1.05,4.8]);
    for(const x of [-2.15,2.15])for(const z of [-5.3,-3.1,-.7])box(this.wreck,rib,[x,4.0,z],[.11,2.5,.11]);
    for(const y of [3.15,5.15])box(this.wreck,rib,[0,y,-5.3],[4.4,.12,.12]);
    const roof=box(this.wreck,steel,[.30,4.70,-3.2],[3.8,.16,4.0]);roof.rotation.set(.16,.10,-.24);
    // Partial wall panels and a collapsed roof keep the wheelhouse from reading as a scaffold.
    for(const side of [-1,1]){box(this.wreck,steel,[side*2.14,3.35,-3.15],[.10,.50,4.25]);box(this.wreck,steel,[side*2.14,4.65,-3.15],[.10,.30,4.25]);
      for(const zz of [-4.15,-1.8]){const glass=box(this.wreck,material(0x254648,.94),[side*2.12,4.03,zz],[.08,.92,1.52]);glass.rotation.z=side*.08;}}
    const fallen=box(this.wreck,steel,[.8,3.25,1.2],[3.4,.10,3.0]);fallen.rotation.set(.16,.18,-.28);
    const hatch=box(this.wreck,rib,[0,2.27,4.3],[1.65,.18,1.8]);hatch.rotation.z=.12;box(this.wreck,dark,[0,2.38,4.3],[1.3,.025,1.45]);
    for(const side of [-1,1])pipe(this.wreck,steel,[new T.Vector3(side*.55,2.45,4.12),new T.Vector3(side*.55,2.58,4.12),new T.Vector3(side*.55,2.58,4.48)],.025,6);
    for(let i=0;i<46;i++){const n=i*2.399,z=-8+rnd(i+203)*16,w=3.1*Math.pow(Math.sin((z/21+.5)*Math.PI),.42),side=i%2?-1:1;const growth=mesh(this.brainCoral(),material(i%3?0x72794e:0xa99a75,.98),this.wreck,side*w*.95,.8+rnd(i+9)*1.8,z);growth.scale.set(.10+rnd(i)*.18,.08,.11+rnd(i+6)*.13);growth.rotation.z=side*1.1;}
    // Burial uses the seabed's world UV coordinates and color, without a separate skirt.
    const siltMap=surfaceTexture('sand');siltMap.repeat.set(100,90);
    const silt=this.caustics(material(0xe2e0cb,.94,siltMap));silt.bumpMap=siltMap;silt.bumpScale=.035;
    const burial=new T.PlaneGeometry(15,29,60,116);burial.rotateX(-Math.PI/2);const burialPos=burial.getAttribute('position'),burialUv=burial.getAttribute('uv');
    this.wreck.updateMatrixWorld(true);
    for(let i=0;i<burialPos.count;i++){const lx=burialPos.getX(i),lz=burialPos.getZ(i),world=new T.Vector3(lx,0,lz).applyMatrix4(this.wreck.matrixWorld),r=Math.sqrt((lx/7.5)**2+(lz/14.5)**2);const blend=Math.max(0,1-r*r);
      const rise=.16*blend*blend*(.8+noise(world.x*.6,world.z*.6)*.35);burialPos.setXYZ(i,world.x,expeditionFloor(world.x,world.z)+.002+rise,world.z);burialUv.setXY(i,(world.x+360)/720,(220-world.z)/660);}
    burial.computeVertexNormals();mesh(burial,silt,this.group).name='Sand burial blended into contoured seabed';
    for(let i=0;i<14;i++){const debris=box(this.wreck,i%2?steel:rib,[-3.6-rnd(i+17)*2,.02+rnd(i)*.12,-1+rnd(i+31)*6],[.6+rnd(i)*.8,.07,.4+rnd(i+42)]);debris.rotation.set(.10*rnd(i),i*2.4,.10);}
    for(const side of [-1,1])for(let z=-8;z<8;z+=1.5){pipe(this.wreck,rib,[new T.Vector3(side*2.5,2.4,z),new T.Vector3(side*2.5,3.6,z)],.026,2);}
    for(const side of [-1,1])pipe(this.wreck,rib,[new T.Vector3(side*2.5,3.6,-8),new T.Vector3(side*2.6,3.7,0),new T.Vector3(side*2.3,3.5,8)],.03,24);
    pipe(this.wreck,rib,[new T.Vector3(0,3.8,-3),new T.Vector3(.1,4.8,-3),new T.Vector3(.6,6.4,-3.2)],.07,8);
    box(this.wreck,dark,[0,3.4,-4.2],[2.9,.8,.65]);
    for(let i=0;i<21;i++){const fan=mesh(this.seaFan(),material(i%2?0x885c69:0xa48a61),this.wreck,(rnd(i+5)-.5)*5,2.2,-8+rnd(i+80)*16);fan.scale.setScalar(.25+rnd(i+18)*.4);fan.rotation.y=i*2.1;}
    const rockMat=this.caustics(material(0xa5b2a8,.91,surfaceTexture('stone')));
    for(let i=0;i<15;i++){const a=i*2.4,x=94+Math.sin(a)*(14+rnd(i)*7),z=-168+Math.cos(a)*(15+rnd(i+4)*8),scale=1.2+rnd(i+44)*2;const rock=mesh(this.rockGeometry(i),rockMat,this.group,x,expeditionFloor(x,z)+scale*.5,z);rock.scale.set(scale,scale*.6,scale);this.rockBounds.push({center:rock.position.clone(),radii:new T.Vector3(scale,scale*.6,scale)});}
  }

  private createHarbor() {
    const harbor=new T.Group();harbor.name='Research harbor and island';this.group.add(harbor);
    const timberMap=new T.TextureLoader().load('/textures/expedition/weathered-teak.png');timberMap.colorSpace=T.SRGBColorSpace;timberMap.wrapS=timberMap.wrapT=T.RepeatWrapping;timberMap.anisotropy=4;timberMap.repeat.set(1,1);const timber=material(0xc1b9a4,.82,timberMap);timber.bumpMap=timberMap;timber.bumpScale=.018;
    const stoneMap=new T.TextureLoader().load('/textures/expedition/coastal-limestone.png');stoneMap.colorSpace=T.SRGBColorSpace;stoneMap.wrapS=stoneMap.wrapT=T.RepeatWrapping;stoneMap.repeat.set(2,2);stoneMap.anisotropy=4;
    const stone=material(0xe2d4bb,.91,stoneMap);stone.bumpMap=stoneMap;stone.bumpScale=.12;
    const metal=new T.MeshStandardMaterial({color:0x657773,roughness:.33,metalness:.72});const plasterMap=surfaceTexture('plaster');const plaster=material(0xe8e1cc,.88,plasterMap);plaster.bumpMap=plasterMap;plaster.bumpScale=.015;
    const blue=material(0x4f8b9c,.83,surfaceTexture('canvas'));const slate=material(0x536269,.85,surfaceTexture('stone'));
    // Authored coves, stepped headlands, wet sand and a planted interior.
    const land = new T.PlaneGeometry(88, 94, 150, 160); land.rotateX(-Math.PI / 2);
    const p = land.getAttribute('position'); const groundColors: number[] = [];
    const drySand = new T.Color(0xd9c79c), wetSand = new T.Color(0x99896b);
    const limestone = new T.Color(0xb7b39d), earth = new T.Color(0xc4ccb0);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - 53, z = p.getZ(i) + 43, r = islandRadial(x, z);
      const height = r > 1.06 ? -2.0 - (r - 1.06) * 8 : islandHeight(x, z);
      p.setY(i, height);
      const angle = Math.atan2((z - 43) * .91, x + 53);
      const isBeach = T.MathUtils.smoothstep(Math.cos(angle - .6), -.1, .6);
      const color = limestone.clone().lerp(drySand, isBeach * T.MathUtils.smoothstep(r, .62, .85));
      color.lerp(earth, (1 - T.MathUtils.smoothstep(r, .52, .77)) * .85);
      color.lerp(wetSand, T.MathUtils.smoothstep(r, .90, 1.04) * isBeach);
      color.multiplyScalar(.88 + noise(x * .45, z * .45) * .22);
      groundColors.push(color.r, color.g, color.b);
    }
    land.setAttribute('color', new T.Float32BufferAttribute(groundColors, 3)); land.computeVertexNormals();
    const groundMap=new T.TextureLoader().load('/textures/expedition/coastal-grove-floor.png');groundMap.colorSpace=T.SRGBColorSpace;groundMap.wrapS=groundMap.wrapT=T.RepeatWrapping;groundMap.anisotropy=4;groundMap.repeat.set(22,24);
    const groundMat = material(0xffffff, .94, groundMap); groundMat.vertexColors = true; groundMat.bumpMap = groundMap; groundMat.bumpScale = .018;
    const beachMap=surfaceTexture('sand');
    groundMat.onBeforeCompile=shader=>{
      shader.uniforms.coastSand={value:beachMap};shader.uniforms.coastStone={value:stoneMap};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 coastPoint; varying float coastSlope;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ncoastPoint=(modelMatrix*vec4(transformed,1.0)).xyz; coastSlope=abs(normalize(mat3(modelMatrix)*normal).y);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D coastSand; uniform sampler2D coastStone; varying vec3 coastPoint; varying float coastSlope;').replace('#include <map_fragment>',`
        vec3 groundSample=texture2D(map,vMapUv).rgb;
        float beachWeight=(1.0-smoothstep(0.75,1.8,coastPoint.y))*smoothstep(-62.0,-45.0,coastPoint.x);
        vec3 sandySample=texture2D(coastSand,coastPoint.xz*.24).rgb;
        groundSample=mix(groundSample,sandySample,beachWeight);
        vec3 rockSample=texture2D(coastStone,vec2((coastPoint.x+coastPoint.z)*.16,coastPoint.y*.27)).rgb;
        groundSample=mix(groundSample,rockSample,(1.0-smoothstep(.56,.88,coastSlope))*.8);
        diffuseColor*=vec4(groundSample,1.0);
      `);
    };
    const shore = mesh(land, groundMat, harbor, -53, 0, 43); shore.castShadow = true;
    // Low wave-washed limestone strata hug the west coves rather than ringing the island.
    for (let i = 0; i < 28; i++) {
      const a = 1.35 + i * .12, radius = islandRadius(a) * (.77 + rnd(i + 40) * .12);
      const x = -53 + Math.cos(a) * radius, z = 43 + Math.sin(a) * radius / .91;
      const rock = mesh(this.coastRockGeometry(i + 250), stone, harbor, x, islandHeight(x, z) - .8, z);
      rock.scale.set(2.2 + rnd(i) * 2, 1.9 + rnd(i + 13)*1.7, 2.0 + rnd(i + 6) * 2);
      rock.rotation.y = a;
    }
    for(const x of [-8.5,8.5]) {
      box(harbor,timber,[x,.55,27],[3.1,.6,62],.08);
      for(let z=-2;z<=54;z+=5.6){const post=mesh(new T.CylinderGeometry(.23,.27,5.3,16),timber,harbor,x+(x<0?-1.1:1.1),-1.7,z);post.castShadow=true;
        const bollard=mesh(new T.CylinderGeometry(.15,.22,.38,16),metal,harbor,x,.98,z);pipe(harbor,metal,[new T.Vector3(x-.28,1.20,z),new T.Vector3(x+.28,1.20,z)],.06,2);bollard.name='Mooring bollard';
      }
      for(let z=2;z<53;z+=9){const f=mesh(new T.CylinderGeometry(.25,.28,1.2,16),material(0x14252b,.72),harbor,x+(x<0?1.55:-1.55),.1,z);pipe(harbor,timber,[new T.Vector3(f.position.x,.7,z),new T.Vector3(x,1,z)],.018,4);}
      for(let z=-2;z<49;z+=5.6)for(const side of [-1,1])pipe(harbor,timber,[new T.Vector3(x+side*1.05,-1.8,z),new T.Vector3(x+side*1.05,.32,z+5.6)],.10,2);
      const boards=new T.InstancedMesh(new RoundedBoxGeometry(3.08,.065,.32,1,.012),timber,182);const matrix=new T.Matrix4();
      for(let i=0;i<182;i++){matrix.makeTranslation(x,.89,-3.8+i*.34);boards.setMatrixAt(i,matrix);}boards.receiveShadow=true;boards.computeBoundingSphere();harbor.add(boards);
      for(let z=5;z<50;z+=18){const ring=mesh(new T.TorusGeometry(.45,.075,10,32),material(0xd57c34,.62),harbor,x+(x<0?-1.25:1.25),1.7,z);ring.rotation.y=Math.PI/2;}
    }
    box(harbor,timber,[-23,.9,54],[33,.5,7]);box(harbor,timber,[-31,1.35,41],[18,.35,20]);
    for(let step=0;step<5;step++)box(harbor,timber,[-40.1-step*.46,1.435-step*.085,41],[.65,.18,2.8]);
    const marketRamp=box(harbor,timber,[-28,1.2475,52.5],[6,.18,3.04]);marketRamp.rotation.x=Math.atan(.125);
    for(const x of [-39,-31,-23])for(const z of [32,40,49])box(harbor,timber,[x,.35,z],[.24,2.1,.24]);
    const gangway=box(harbor,timber,[-20,1.12,52],[7,.18,2.5]);gangway.rotation.z=-.055;
    for(const z of [50.8,53.2])pipe(harbor,metal,[new T.Vector3(-23.5,2.1,z),new T.Vector3(-16.5,1.72,z)],.04,3);
    for(let z=30;z<=52;z+=3.5)for(const x of [-41,-22]){if(x===-41&&Math.abs(z-41)<1.6)continue;box(harbor,timber,[x,1.8,z],[.14,1.2,.14]);}
    pipe(harbor,timber,[new T.Vector3(-22,2.3,30),new T.Vector3(-22,2.3,52)],.06,10);
    for(const [a,b] of [[30,39.5],[42.5,52]])pipe(harbor,timber,[new T.Vector3(-41,2.3,a),new T.Vector3(-41,2.3,b)],.06,5);
    const building=(cx:number,cz:number,outfitter:boolean)=> {
      const b=new T.Group();b.position.set(cx,1.5,cz);harbor.add(b);
      box(b,plaster,[0,1.7,1.6],[8.4,3.4,.2]);for(const x of [-4.2,4.2])box(b,plaster,[x,1.7,.1],[.2,3.4,3.2]);
      const gable=shapeMesh([-4.2,3.4,1.6,0,4.48,1.6,4.2,3.4,1.6],[0,1,2],plaster,b);gable.material.side=T.DoubleSide;
      // Side window casings, inset glass and louvered shutters give the walls depth.
      for (const side of [-1, 1]) {
        box(b,timber,[side*4.32,1.95,.35],[.12,1.45,1.65]);
        box(b,metal,[side*4.40,1.95,.35],[.03,1.15,1.30]);
        for (const dz of [-1.0,1.0]) {
          box(b,blue,[side*4.44,1.95,.35+dz],[.07,1.48,.48]);
          for (let y=1.36;y<2.6;y+=.17) box(b,timber,[side*4.49,y,.35+dz],[.04,.045,.40]);
        }
        for (const dz of [-.62,0,.62]) box(b,timber,[side*4.43,1.95,.35+dz],[.055,1.25,.04]);
      }
      for(const x of [-4,4])for(const z of [-2,2])box(b,timber,[x,2,z],[.22,4,.22]);
      for(const side of [-1,1]){const roof=box(b,slate,[side*2.25,4.1,0],[4.65,.18,5.9]);roof.rotation.z=side*-.25;
        const tiles=new T.InstancedMesh(new RoundedBoxGeometry(.70,.06,.47,1,.02),slate,105);const tileM=new T.Matrix4(),tileQ=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),side*-.25);
        for(let row=0;row<7;row++)for(let column=0;column<15;column++){
          const x=side*(.28+row*.63),y=4.70-Math.abs(x)*.255,z=-2.83+column*.405+(row%2)*.06;
          tileM.compose(new T.Vector3(x,y,z),tileQ,new T.Vector3(1,1,1));tiles.setMatrixAt(row*15+column,tileM);tiles.setColorAt(row*15+column,new T.Color(0xffffff).multiplyScalar(.68+rnd(row*15+column)*.4));
        }tiles.castShadow=true;tiles.receiveShadow=true;tiles.computeBoundingSphere();b.add(tiles);
      }
      box(b,slate,[0,4.71,0],[.26,.12,6.02]);
      for(const z of [-2.5,2.5]){
        pipe(b,timber,[new T.Vector3(-4.25,3.53,z),new T.Vector3(0,4.66,z),new T.Vector3(4.25,3.53,z)],.075,3);
        box(b,timber,[0,3.53,z],[8.5,.12,.12]);
      }
      for(const x of [-4.1,4.1])box(b,timber,[x,3.5,0],[.18,.22,6.0]);
      const lining=shapeMesh([-4.5,3.33,-3,0,4.49,-3,4.5,3.33,-3,-4.5,3.33,3,0,4.49,3,4.5,3.33,3],[0,3,4,0,4,1,1,4,5,1,5,2],timber,b);lining.material.side=T.DoubleSide;
      for(let x=-3.8;x<=3.8;x+=.65){box(b,timber,[x,4.32-Math.abs(x)*.255,0],[.10,.18,5.8]);}
      const awning=box(b,blue,[0,3.0,-2.9],[8.4,.07,2.5]);awning.rotation.x=-.15;
      for(const x of [-3.9,3.9])pipe(b,metal,[new T.Vector3(x,2.6,-4),new T.Vector3(x,3.3,-1.6)],.032,3);
      box(b,timber,[0,.525,-1.5],[7.6,1.05,.85]);box(b,timber,[0,1.10,-1.65],[8.0,.14,1.2]);
      for(let x=-3.4;x<=3.4;x+=.45)box(b,timber,[x,.56,-1.96],[.12,.98,.07]);
      for(const y of [1.0,2.2])box(b,timber,[0,y,1.25],[7.8,.12,.45]);
      this.sign(b,outfitter?'DIVE OUTFITTER':'RESEARCH EXCHANGE',new T.Vector3(0,3.8,-2.55),7.2,.75);
      if(outfitter){
        for(let i=0;i<4;i++){this.gearCylinder(b,new T.Vector3(-2.8+i*.75,1.17,-1.55),i%2?0xe2b438:0xaebdc0);}
        for(const x of [1.2,2.0]) {const fin=new T.Shape();fin.moveTo(-.18,0);fin.quadraticCurveTo(-.35,.4,-.36,1.1);fin.quadraticCurveTo(0,1.3,.36,1.1);fin.quadraticCurveTo(.35,.4,.18,0);fin.closePath();const g=new T.ExtrudeGeometry(fin,{depth:.035,bevelEnabled:true,bevelSize:.018,bevelThickness:.015,bevelSegments:2,steps:1});const f=mesh(g,material(0xe1bb3e,.55),b,x,1.18,-1.95);f.rotation.x=-.4;f.scale.setScalar(.55);}
        for(const x of [1.8,2.6]){const mask=mesh(new T.TorusGeometry(.22,.035,8,30),material(0x132a31,.5),b,x,2.65,1);mask.scale.x=1.45;box(b,metal,[x,2.65,1],[.54,.28,.03]);}
      }else{
        const labelMat=material(0xe9e3cd,.95);
        const vialGlass=new T.MeshPhysicalMaterial({color:0xd2e3dc,transparent:true,opacity:.24,roughness:.12,clearcoat:1,depthWrite:false});
        const label=(text:string)=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d')!;c.fillStyle='#ede8d7';c.fillRect(0,0,512,256);c.fillStyle='#263c3b';c.textAlign='center';c.font='bold 42px sans-serif';c.fillText(text,256,78);c.font='30px monospace';c.fillText('BLUEWATER / FIELD 01',256,129);c.font='25px monospace';c.fillText('DATE 01 OCT   •   LOGGED',256,177);c.lineWidth=3;c.strokeStyle='#72857d';c.strokeRect(14,16,484,224);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return material(0xffffff,.93,tex);};
        const labels=[label('REEF WATER · 08 M'),label('SEDIMENT · 12 M'),label('REEF SURVEY · 01')];
        const cap=(x:number,y:number,z:number,r:number)=>{mesh(new T.CylinderGeometry(r,r,.052,32),metal,b,x,y,z);for(let k=0;k<20;k++){const a=k/20*Math.PI*2;box(b,metal,[x+Math.sin(a)*r,y,z+Math.cos(a)*r],[.008,.047,.008],.001);}const collar=mesh(new T.TorusGeometry(r*.96,.005,6,32),metal,b,x,y-.024,z);collar.rotation.x=Math.PI/2;};
        for(let i=0;i<3;i++){
          const trayX=-2.5+i*1.8;box(b,metal,[trayX,1.20,-1.6],[1.4,.07,.8]);
          for(const dz of [-.39,.39])box(b,metal,[trayX,1.25,-1.6+dz],[1.4,.10,.025]);
          for(const dx of [-.69,.69])box(b,metal,[trayX+dx,1.25,-1.6],[.025,.10,.8]);
          this.sign(b,i===0?'WATER / 08 M':i===1?'SEDIMENT / 12 M':'REEF SURVEY',new T.Vector3(trayX,1.27,-2.015),1.15,.12);
          for(let j=0;j<4;j++){
            const vx=-2.9+i*1.8+j*.22;mesh(new T.CylinderGeometry(.065,.065,.32,32),vialGlass,b,vx,1.41,-1.6);
            mesh(new T.CylinderGeometry(.052,.052,.12,16),material(i===1?0x927856:0x4c9997,.4),b,vx,1.32,-1.6);
            mesh(new T.CylinderGeometry(.066,.066,.07,32),labels[i],b,vx,1.44,-1.6);cap(vx,1.59,-1.6,.067);
            if(i===1)for(let k=0;k<9;k++){const a=k*2.4;mesh(new T.SphereGeometry(.008,6,4),material(0x7e6b48),b,vx+Math.sin(a)*.035,1.29+(k%3)*.018,-1.6+Math.cos(a)*.035);}
            if(i===2){const specimen=mesh(this.branchCoral(),material(0xc0b58e,.96),b,vx,1.28,-1.6);specimen.scale.setScalar(.035);}
          }
        }
        this.microscope(b,new T.Vector3(2.75,1.18,-1.55),metal);
        const bottleGeo=new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(.105,0),new T.Vector2(.12,.03),new T.Vector2(.12,.26),new T.Vector2(.07,.32),new T.Vector2(.048,.39),new T.Vector2(.048,.44)],20);
        for(let i=0;i<8;i++){const bx=-2.8+i*.75;const bottle=mesh(bottleGeo,vialGlass,b,bx,2.27,1.1);bottle.name='Labeled specimen bottle';cap(bx,2.735,1.1,.052);mesh(new T.CylinderGeometry(.122,.122,.105,32),labels[i%3],b,bx,2.42,1.1);
          mesh(new T.CylinderGeometry(.097,.097,i%3===1?.065:.15,24),material(i%3===1?0x967d56:i%3===2?0xa6b0a3:0x83b0aa,.8),b,bx,2.31,1.1);
          if(i%3===1)for(let j=0;j<12;j++)mesh(new T.SphereGeometry(.015,6,4),material(0x82734f),b,bx+Math.sin(j*2.4)*.065,2.35,1.1+Math.cos(j*2.4)*.065);
        }
        this.labChart(b,new T.Vector3(-1.0,1.62,1.48));
      }
      for(const x of [-3,3]){const lamp=mesh(new T.SphereGeometry(.14,12,8),new T.MeshStandardMaterial({color:0xf9dc9a,emissive:0xe8b660,emissiveIntensity:.6}),b,x,2.9,-2.15);pipe(b,metal,[new T.Vector3(x,3.3,-2.15),lamp.position.clone()],.018,3);}
    };
    building(-34,36,false);building(-34,47,true);
    // A working harbor: storage, a wash station, a bench and coiled mooring ropes.
    for(const [x,z]of [[-40,32],[-40,34],[-39.5,51],[-24,48]]){
      box(harbor,timber,[x,1.96,z],[1.2,.85,.85]);
      for(const side of [-1,1])for(const offset of [-.38,.38])box(harbor,metal,[x+side*.61,1.96,z+offset],[.04,.86,.055]);
    }
    box(harbor,timber,[-25,1.9,37],[.85,.14,3.0]);for(const z of [35.9,38.1])box(harbor,metal,[-25,1.63,z],[.55,.65,.08]);
    box(harbor,metal,[-39,2.1,40.8],[1.3,.65,.9]);box(harbor,metal,[-39,2.5,40.8],[1.4,.12,1]);pipe(harbor,metal,[new T.Vector3(-39,2.5,41.1),new T.Vector3(-39,2.95,41.1),new T.Vector3(-39,2.95,40.75)],.027,8);
    const ropeMat=material(0xb5a584,.96);
    for(const x of [-8.5,8.5])for(const z of [6,23,42])for(let ring=0;ring<4;ring++){const coil=mesh(new T.TorusGeometry(.22+ring*.055,.025,5,24),ropeMat,harbor,x+.7,.96,z);coil.rotation.x=Math.PI/2;}
    const palmBark=material(0x806f51,.92);palmBark.bumpMap=stoneMap;palmBark.bumpScale=.02;
    for(let i=0;i<19;i++){
      const x=-57+Math.sin(i*2.4)*(9+rnd(i)*14),z=43+Math.cos(i*2.4)*(12+rnd(i+12)*13);
      if(x>-44 && z>24 && z<60) continue;
      if(trailDistance(x,z)<2.3)continue;
      const ground=islandHeight(x,z);
      this.palm(harbor,x,ground-.12,z,6+rnd(i+7)*4,palmBark);
      this.walking.trees.push({x,z,radius:.27});
    }
    for(let i=0;i<19;i++){
      const a=i*2.4,x=-53+Math.cos(a)*30,z=43+Math.sin(a)*31;
      if(x>-43&&z<59)continue;
      const r=mesh(this.coastRockGeometry(i),stone,harbor,x,-.4,z);r.scale.set(2.2+rnd(i)*2.8,1.8+rnd(i+4)*2.2,2.2+rnd(i+5)*2.0);
    }
    const pebbles=new T.InstancedMesh(this.coastRockGeometry(111),stone,90);
    const pebbleM=new T.Matrix4(),pebbleQ=new T.Quaternion();
    for(let i=0;i<90;i++){
      const a=-1.4+rnd(i+1410)*2.8,r=islandRadius(a)*(.85+rnd(i+950)*.18);
      const x=-53+Math.cos(a)*r,z=43+Math.sin(a)*r/.91,s=.07+rnd(i+680)*.16;
      pebbleM.compose(new T.Vector3(x,islandHeight(x,z)+s*.1,z),pebbleQ.setFromAxisAngle(UP,i*2.4),new T.Vector3(s,s*.65,s));pebbles.setMatrixAt(i,pebbleM);
    }pebbles.castShadow=true;pebbles.receiveShadow=true;pebbles.computeBoundingSphere();harbor.add(pebbles);
    const foliageMat=material(0x7c9256,.86);foliageMat.side=T.DoubleSide;
    const foliage=new T.InstancedMesh(this.grassGeometry,foliageMat,320);const plantMatrix=new T.Matrix4();const plantQ=new T.Quaternion();
    for(let i=0;i<320;i++){
      let x=-76+rnd(i+700)*39,z=17+rnd(i+610)*50;
      for (let attempt=0; (islandRadial(x,z)>.78 || (x>-44&&z>24&&z<60) || trailDistance(x,z)<2) && attempt<30;attempt++) {
        x=-77+rnd(i+700+attempt*17)*39;z=19+rnd(i+610+attempt*31)*48;
      }
      const s=.22+rnd(i+380)*.40;
      plantMatrix.compose(new T.Vector3(x,islandHeight(x,z),z),plantQ.setFromAxisAngle(UP,i*2.4),new T.Vector3(s*1.25,s,s*1.25));foliage.setMatrixAt(i,plantMatrix);
    }foliage.computeBoundingSphere();foliage.receiveShadow=true;harbor.add(foliage);
    // Dense, layered coastal shrubs create a planted interior and frame the footpath.
    const foliageAtlas=new T.TextureLoader().load('/textures/expedition/coastal-foliage-atlas.png');foliageAtlas.colorSpace=T.SRGBColorSpace;foliageAtlas.anisotropy=4;
    const shrubMat=new T.MeshStandardMaterial({map:foliageAtlas,color:0xc8d3b8,roughness:.91,alphaTest:.46,side:T.DoubleSide});
    for(let kind=0;kind<4;kind++){
      const card=new T.PlaneGeometry(2.1,2.1,8,8);card.translate(0,.95,0);
      const uv=card.getAttribute('uv'),cardP=card.getAttribute('position');
      for(let i=0;i<uv.count;i++){uv.setXY(i,(kind%2)*.5+.014+uv.getX(i)*.472,(kind<2?.5:0)+.014+uv.getY(i)*.472);cardP.setZ(i,Math.sin(cardP.getY(i)*1.2)*.18);}
      card.computeVertexNormals();const shrubs=new T.InstancedMesh(card,shrubMat,180);
      for(let i=0;i<180;i++){
        const bush=Math.floor(i/5),a=bush*2.4+kind*.77,r=7+rnd(bush+980+kind*200)*17;
        let x=-56+Math.cos(a)*r,z=43+Math.sin(a)*r;
        if(x>-45&&z>24&&z<60)x=-49-rnd(bush+18)*9;
        if(trailDistance(x,z)<2.4)z+=5.5;
        const s=(kind===2?.28:.42)+rnd(bush+730)*.36;
        plantMatrix.compose(new T.Vector3(x+Math.sin(i)*.3,islandHeight(x,z)-.03,z+Math.cos(i)*.3),plantQ.setFromAxisAngle(UP,a+(i%5)*1.27),new T.Vector3(s,s,s));shrubs.setMatrixAt(i,plantMatrix);
        shrubs.setColorAt(i,new T.Color(0xffffff).multiplyScalar(.76+rnd(bush+kind*300)*.3));
      }shrubs.castShadow=true;shrubs.receiveShadow=true;shrubs.computeBoundingSphere();harbor.add(shrubs);
    }
    // Close walking views use curved, volumetric leaves above scattered stones and litter.
    const leafV:number[]=[],leafI:number[]=[];
    for(let row=0;row<=10;row++){const t=row/10,w=Math.sin(Math.PI*t)*.17;for(const side of [-1,0,1])leafV.push(w*side,.08*Math.sin(t*Math.PI)*(1-Math.abs(side)*.7),t*.78);
      if(row<10)for(let side=0;side<2;side++){const n=row*3+side;leafI.push(n,n+3,n+4,n,n+4,n+1);}}
    const leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute(leafV,3));leafGeo.setIndex(leafI);leafGeo.computeVertexNormals();
    const leafUv:number[]=[];for(let row=0;row<=10;row++)for(let side=0;side<3;side++)leafUv.push(side/2,row/10);leafGeo.setAttribute('uv',new T.Float32BufferAttribute(leafUv,2));
    const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=256;const leafCtx=leafCanvas.getContext('2d')!;leafCtx.fillStyle='#8aa06c';leafCtx.fillRect(0,0,256,256);
    leafCtx.strokeStyle='#556e41';leafCtx.lineWidth=3;leafCtx.beginPath();leafCtx.moveTo(128,0);leafCtx.lineTo(128,256);leafCtx.stroke();leafCtx.lineWidth=1.4;
    for(let j=1;j<12;j++)for(const side of [-1,1]){leafCtx.beginPath();leafCtx.moveTo(128,j*22);leafCtx.quadraticCurveTo(128+side*48,j*22+14,128+side*120,j*22+34);leafCtx.stroke();}
    const leafMap=new T.CanvasTexture(leafCanvas);leafMap.colorSpace=T.SRGBColorSpace;leafMap.anisotropy=4;
    const closeLeaves=new T.InstancedMesh(leafGeo,new T.MeshStandardMaterial({color:0xc3d2b3,map:leafMap,bumpMap:leafMap,bumpScale:.007,roughness:.88,side:T.DoubleSide}),1680);
    const stems=new T.InstancedMesh(new T.CylinderGeometry(.008,.013,1,6),material(0x657946,.98),1680),stemMatrix=new T.Matrix4(),stemQ=new T.Quaternion();
    const leafRotation=new T.Euler();
    for(let i=0;i<1680;i++){const bush=Math.floor(i/14),a=bush*2.399,r=3.5+rnd(bush+57)*20;let x=-56+Math.cos(a)*r,z=43+Math.sin(a)*r;
      if(x>-44&&z>24&&z<60)x=-48-rnd(bush+68)*6;if(trailDistance(x,z)<1.3)z+=3.0;
      const s=.65+rnd(i+782)*.65,theta=(i%14)*2.399;leafRotation.set(-.22-rnd(i+33)*.8,theta,.15*Math.sin(i));
      const base=new T.Vector3(x,islandHeight(x,z)+.015,z),leafBase=new T.Vector3(x+Math.sin(theta)*.26,islandHeight(x,z)+.08+((i%14)>8?.40:0),z+Math.cos(theta)*.26);
      const stemDir=leafBase.clone().sub(base),mid=leafBase.clone().add(base).multiplyScalar(.5);stemMatrix.compose(mid,stemQ.setFromUnitVectors(UP,stemDir.clone().normalize()),new T.Vector3(1,stemDir.length(),1));stems.setMatrixAt(i,stemMatrix);
      plantMatrix.compose(leafBase,plantQ.setFromEuler(leafRotation),new T.Vector3(s,s,s));closeLeaves.setMatrixAt(i,plantMatrix);
      closeLeaves.setColorAt(i,new T.Color(0xffffff).multiplyScalar(.72+rnd(i+87)*.5));}
    closeLeaves.castShadow=true;closeLeaves.receiveShadow=true;closeLeaves.computeBoundingSphere();harbor.add(closeLeaves);
    stems.castShadow=true;stems.receiveShadow=true;stems.computeBoundingSphere();harbor.add(stems);
    const trailStones=new T.InstancedMesh(this.coastRockGeometry(283),stone,420);
    for(let i=0;i<420;i++){const t=rnd(i+661),x=-43-t*23,z=41+t*4+(rnd(i+825)-.5)*4.8,s=.025+rnd(i+49)*.09;
      plantMatrix.compose(new T.Vector3(x,islandHeight(x,z)+.015,z),plantQ.setFromAxisAngle(UP,i*2.399),new T.Vector3(s,s*.38,s*.8));trailStones.setMatrixAt(i,plantMatrix);}
    trailStones.receiveShadow=true;trailStones.computeBoundingSphere();harbor.add(trailStones);
    const litter=new T.InstancedMesh(leafGeo,new T.MeshStandardMaterial({color:0x887250,roughness:1,side:T.DoubleSide}),240);
    for(let i=0;i<240;i++){const t=rnd(i+98),x=-44-t*22,z=41+t*4+(rnd(i+43)-.5)*6.5,s=.10+rnd(i+76)*.24;
      plantMatrix.compose(new T.Vector3(x,islandHeight(x,z)+.018,z),plantQ.setFromAxisAngle(UP,i*2.4),new T.Vector3(s,s*.25,s));litter.setMatrixAt(i,plantMatrix);}
    litter.computeBoundingSphere();harbor.add(litter);
    // A meandering gravel footpath is a real terrain-following ribbon, not a decal floating over the slope.
    const pathVertices:number[]=[],pathIndices:number[]=[],pathUv:number[]=[];
    const curve=new T.CatmullRomCurve3([new T.Vector3(-42.2,0,41),new T.Vector3(-46,0,41),new T.Vector3(-50,0,42),new T.Vector3(-56,0,43.5),new T.Vector3(-62,0,44),new T.Vector3(-67,0,46)]);
    for(let i=0;i<=100;i++){const t=i/100,at=curve.getPoint(t),dir=curve.getTangent(t),width=.78+Math.sin(t*22)*.09;
      for(const side of [-1,1]){const x=at.x+dir.z*width*side,z=at.z-dir.x*width*side;pathVertices.push(x,islandHeight(x,z)+.014,z);pathUv.push(side===-1?0:1,t*18);}
      if(i<100){const k=i*2;pathIndices.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const pathGeo=new T.BufferGeometry();pathGeo.setAttribute('position',new T.Float32BufferAttribute(pathVertices,3));pathGeo.setAttribute('uv',new T.Float32BufferAttribute(pathUv,2));pathGeo.setIndex(pathIndices);pathGeo.computeVertexNormals();
    const pathCanvas=document.createElement('canvas');pathCanvas.width=pathCanvas.height=512;const pathCtx=pathCanvas.getContext('2d')!;pathCtx.drawImage(surfaceTexture('sand').image,0,0);pathCtx.globalCompositeOperation='destination-in';const fade=pathCtx.createLinearGradient(0,0,512,0);fade.addColorStop(0,'transparent');fade.addColorStop(.20,'white');fade.addColorStop(.80,'white');fade.addColorStop(1,'transparent');pathCtx.fillStyle=fade;pathCtx.fillRect(0,0,512,512);
    const pathMap=new T.CanvasTexture(pathCanvas);pathMap.colorSpace=T.SRGBColorSpace;pathMap.wrapS=pathMap.wrapT=T.RepeatWrapping;const pathMat=material(0xc6b792,.96,pathMap);pathMat.side=T.DoubleSide;pathMat.transparent=true;pathMat.depthWrite=false;mesh(pathGeo,pathMat,harbor);
    this.sign(harbor,'ISLAND TRAIL',new T.Vector3(-42.7,2.12,42.5),1.55,.25);
    box(harbor,timber,[-42.7,1.6,42.52],[.07,1.05,.07]);
    this.navBuoys.push(this.buoy(REEF_SITE.x,REEF_SITE.z,0xf0ba57,'REEF'),this.buoy(WRECK_SITE.x,WRECK_SITE.z,0x85c2c7,'WRECK'),this.buoy(LAGOON_SITE.x,LAGOON_SITE.z,0x91c86c,'LAGOON'),this.buoy(TRANSECT_SITE.x,TRANSECT_SITE.z,0x83cbcf,'TRANSECT'),this.buoy(GARDEN_SITE.x,GARDEN_SITE.z,0xd4ad70,'GARDEN'),this.buoy(PASSAGE_SITE.x,PASSAGE_SITE.z,0xa5baca,'PASSAGE'));
    harbor.traverse(node=>{if(node instanceof T.Mesh)node.castShadow=true;});
    this.batchStaticHarbor(harbor);
  }

  private batchStaticHarbor(harbor:T.Group){
    harbor.updateMatrixWorld(true);
    const batches=new Map<T.Material,T.BufferGeometry[]>();const originals:T.Mesh[]=[];
    harbor.traverse(node=>{
      if(!(node instanceof T.Mesh)||node instanceof T.InstancedMesh||Array.isArray(node.material))return;
      let geometry=node.geometry.clone();if(geometry.index)geometry=geometry.toNonIndexed();
      if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
      if(node.material instanceof T.MeshStandardMaterial && node.material.color.getHex()===0xc1b9a4){
        const p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
        for(let i=0;i<p.count;i++){const ax=Math.abs(normal.getX(i)),ay=Math.abs(normal.getY(i));
          if(ay>.7)uv.setXY(i,p.getZ(i)/2,p.getX(i)/2);else if(ax>.7)uv.setXY(i,p.getZ(i)/2,p.getY(i)/2);else uv.setXY(i,p.getX(i)/2,p.getY(i)/2);
        }
      }
      geometry.applyMatrix4(node.matrixWorld);
      const list=batches.get(node.material)??[];list.push(geometry);batches.set(node.material,list);originals.push(node);
    });
    for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries);if(!merged)throw new Error('Harbor geometry batching failed');const item=mesh(merged,mat,harbor);item.castShadow=true;item.name='Harbor structural finish';geometries.forEach(g=>g.dispose());}
    originals.forEach(item=>{item.parent?.remove(item);item.geometry.dispose();});
  }

  private sign(parent:T.Object3D,text:string,position:T.Vector3,width:number,height:number){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#17343a';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#cfb879';ctx.lineWidth=5;ctx.strokeRect(10,10,1004,108);ctx.font='600 52px Georgia';ctx.fillStyle='#f1e8cf';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,68);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const item=mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),parent);item.position.copy(position);item.rotation.y=Math.PI;return item;}

  private instrumentLabel(parent:T.Object3D,code:string) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#112c30';ctx.fillRect(0,0,512,192);
    ctx.strokeStyle='#9caeaa';ctx.lineWidth=5;ctx.strokeRect(5,5,502,182);
    ctx.font='700 118px monospace';ctx.fillStyle='#f3f4e9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(code,256,102,474);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    const label=mesh(new T.PlaneGeometry(.32,.12),new T.MeshBasicMaterial({map}),parent,0,.40,-.244);label.rotation.y=Math.PI;
  }

  private gearCylinder(parent:T.Object3D,position:T.Vector3,color:number){
    const points=[new T.Vector2(0,0),new T.Vector2(.16,0),new T.Vector2(.22,.10),new T.Vector2(.23,.95),new T.Vector2(.20,1.08),new T.Vector2(.08,1.17),new T.Vector2(.06,1.24)];
    const assembly=new T.Group();assembly.position.copy(position);assembly.scale.setScalar(.65);parent.add(assembly);parent=assembly;position=new T.Vector3();
    const body=mesh(new T.LatheGeometry(points,24),new T.MeshStandardMaterial({color,metalness:.42,roughness:.36}),parent);body.position.copy(position);
    box(parent,material(0x657978,.3),[position.x,position.y+1.32,position.z],[.19,.16,.09]);
    const ring=mesh(new T.TorusGeometry(.234,.018,6,24),material(0x273938),parent,position.x,position.y+.4,position.z);ring.rotation.x=Math.PI/2;
  }
  private labChart(parent:T.Object3D,p:T.Vector3){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#e9e4d4';ctx.fillRect(0,0,1024,512);ctx.strokeStyle='#536c68';ctx.lineWidth=8;ctx.strokeRect(16,16,992,480);
    ctx.fillStyle='#294748';ctx.font='bold 42px sans-serif';ctx.fillText('BLUEWATER FIELD STATION',42,66);
    ctx.font='27px sans-serif';ctx.fillText('REEF / 08–15 M     WRECK / 24 M',42,118);
    ctx.strokeStyle='#9baea3';ctx.lineWidth=2;
    for(let x=46;x<640;x+=54){ctx.beginPath();ctx.moveTo(x,154);ctx.lineTo(x,458);ctx.stroke();}
    for(let y=156;y<470;y+=45){ctx.beginPath();ctx.moveTo(46,y);ctx.lineTo(640,y);ctx.stroke();}
    ctx.strokeStyle='#3e7b7e';ctx.lineWidth=5;ctx.beginPath();for(let i=0;i<70;i++){const x=80+i*7,y=310+Math.sin(i*.15)*60+Math.cos(i*.35)*18;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    ctx.font='24px sans-serif';for(const [i,text]of ['01  Photo survey','02  Water sample','03  Sediment core','04  Sensor recovery','Log depth + location'].entries())ctx.fillText(text,680,190+i*50);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const chart=mesh(new T.PlaneGeometry(3.5,1.75),new T.MeshStandardMaterial({map:tex,roughness:.98}),parent);chart.position.copy(p);chart.rotation.y=Math.PI;
  }
  private microscope(parent:T.Object3D,p:T.Vector3,mat:T.Material){
    box(parent,mat,[p.x,p.y+.045,p.z],[.48,.09,.36]);pipe(parent,mat,[p.clone().add(new T.Vector3(-.10,.09,0)),p.clone().add(new T.Vector3(-.17,.55,0)),p.clone().add(new T.Vector3(.10,.73,0))],.055,10);box(parent,mat,[p.x,p.y+.32,p.z],[.35,.05,.28]);
    const tube=mesh(new T.CylinderGeometry(.043,.065,.28,20),mat,parent,p.x+.08,p.y+.76,p.z);tube.rotation.z=-.4;
    const dark=material(0x1d3035,.4);const eyepiece=mesh(new T.CylinderGeometry(.052,.049,.11,20),dark,parent,p.x+.15,p.y+.91,p.z);eyepiece.rotation.z=-.4;
    for(const side of [-1,1]){const knob=mesh(new T.CylinderGeometry(.056,.056,.05,20),dark,parent,p.x+side*.19,p.y+.43,p.z);knob.rotation.z=Math.PI/2;}
    for(const dx of [-.065,.065])mesh(new T.CylinderGeometry(.025,.030,.10,16),mat,parent,p.x+dx,p.y+.46,p.z-.07);
    box(parent,new T.MeshPhysicalMaterial({color:0xbed5cf,transparent:true,opacity:.55,roughness:.08}),[p.x,p.y+.35,p.z],[.19,.012,.075]);
  }
  private palm(parent:T.Object3D,x:number,y:number,z:number,height:number,mat:T.Material){
    const bend=1.2+Math.sin(x*5+z)*.7,crownTilt=(rnd(x+z*91)-.5)*.75,crownFullness=.86+rnd(x*9+z)*.28;
    const curve=new T.CatmullRomCurve3([new T.Vector3(x,y,z),new T.Vector3(x+.25,y+height*.3,z-.15),new T.Vector3(x+bend*.6,y+height*.72,z+.1),new T.Vector3(x+bend,y+height,z+.3)]);const trunkGeo=new T.TubeGeometry(curve,26,.19,12,false),trunkP=trunkGeo.getAttribute('position');
    for(let row=0;row<=26;row++){const center=curve.getPointAt(row/26),taper=1.3-row/26*.65;for(let radial=0;radial<=12;radial++){const i=row*13+radial;trunkP.setXYZ(i,center.x+(trunkP.getX(i)-center.x)*taper,center.y+(trunkP.getY(i)-center.y)*taper,center.z+(trunkP.getZ(i)-center.z)*taper);}}trunkGeo.computeVertexNormals();mesh(trunkGeo,mat,parent);
    const bark=mat;
    for(let j=1;j<height*4;j++){
      const t=j/(height*4),center=curve.getPoint(t);
      const ring=mesh(new T.TorusGeometry(.193*(1.3-t*.65),.019,4,12),bark,parent);ring.position.copy(center);ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),curve.getTangent(t));
    }
    for(let i=0;i<4;i++){const seed=i*2.4;const fruit=mesh(new T.SphereGeometry(.13,10,7),bark,parent,x+bend+Math.sin(seed)*.22,y+height-.2,z+.3+Math.cos(seed)*.22);fruit.scale.y=1.3;}
    const leaves:T.BufferGeometry[]=[];
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const verts:number[]=[],ix:number[]=[];
      for(let j=0;j<=14;j++){const t=j/14,r=t*3.8*crownFullness;const cy=height+.15+t*.65-t*t*2.3+Math.cos(a)*t*crownTilt;const w=Math.sin(t*Math.PI)*.11;for(const side of [-1,1])verts.push(x+bend+Math.cos(a)*r+Math.cos(a+1.57)*w*side,y+cy,z+.3+Math.sin(a)*r+Math.sin(a+1.57)*w*side);if(j<14){const k=j*2;ix.push(k,k+1,k+3,k,k+3,k+2);}}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(ix);g.computeVertexNormals();leaves.push(g);
      // Individual leaflets form a palm's feathered silhouette.
      for(let j=2;j<23;j++)for(const side of [-1,1]){const t=j/24,r=t*3.8*crownFullness,len=(.30+Math.sin(t*Math.PI)*.85)*crownFullness;const bx=x+bend+Math.cos(a)*r,bz=z+.3+Math.sin(a)*r,by=y+height+.15+t*.65-t*t*2.3+(i%3)*.12+Math.cos(a)*t*crownTilt;
        const vv:number[]=[],ii:number[]=[];for(let k=0;k<=6;k++){const f=k/6,w=Math.sin(f*Math.PI)*.046,angle=a+1.2*side;
          for(const edge of [-1,1])vv.push(bx+Math.cos(angle)*len*f+Math.cos(angle+1.57)*w*edge,by-.32*f*f+w*.25,bz+Math.sin(angle)*len*f+Math.sin(angle+1.57)*w*edge);
          if(k<6){const n=k*2;ii.push(n,n+1,n+3,n,n+3,n+2);}}
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vv,3));g.setIndex(ii);g.computeVertexNormals();leaves.push(g);}
    }
    const m=material(0x537649,.8);m.side=T.DoubleSide;
    const leafgeo=mergeGeometries(leaves.map(g=>g.index?g.toNonIndexed():g))!;mesh(leafgeo,m,parent);
  }

  private buoy(x:number,z:number,color:number,label:string){const group=new T.Group();group.position.set(x,0,z);this.group.add(group);const metal=material(0x708688,.4);mesh(new T.CylinderGeometry(.52,.63,.25,24),material(color,.5),group,0,.1,0);mesh(new T.CylinderGeometry(.08,.12,1.6,16),metal,group,0,.9,0);mesh(new T.SphereGeometry(.15,16,12),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.5}),group,0,1.8,0);this.sign(group,label,new T.Vector3(0,1.1,.12),1.35,.25);return group;}

  private createResearchSites(){
    const metal=new T.MeshStandardMaterial({color:0x3e555a,metalness:.28,roughness:.58});const amber=material(0xdfac48,.45);
    for(const [key,p] of Object.entries(SAMPLE_SITES)){
      const root=new T.Group();root.name=`Research ${key}`;root.position.set(p.x,p.y,p.z);this.group.add(root);this.sites.set(key,root);
      if(key==='water'){
        const brushed=surfaceTexture('timber');brushed.repeat.set(1,8);metal.bumpMap=brushed;metal.bumpScale=.002;
        const polymer=material(0x182c32,.91),fastener=new T.MeshStandardMaterial({color:0x839896,metalness:.42,roughness:.45});
        for(const side of [-1,1])pipe(root,metal,[new T.Vector3(side*.35,-.8,0),new T.Vector3(side*.35,.8,0)],.027,3);
        for(const y of [-.6,.6])box(root,metal,[0,y,0],[.8,.08,.3]);
        const glass=new T.MeshPhysicalMaterial({color:0xb6d8cf,roughness:.11,transparent:true,opacity:.26,clearcoat:1,depthWrite:false});
        mesh(new T.CylinderGeometry(.14,.14,.9,40),glass,root);
        mesh(new T.CylinderGeometry(.117,.117,.64,32),new T.MeshStandardMaterial({color:0x68a3a1,transparent:true,opacity:.38,roughness:.18,depthWrite:false}),root,0,-.10,0);
        for(const yy of [-.47,.47]){mesh(new T.CylinderGeometry(.154,.154,.09,32),metal,root,0,yy,0);for(const dy of [-.051,.051])mesh(new T.CylinderGeometry(.143,.143,.013,40),polymer,root,0,yy+dy,0);for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh(new T.CylinderGeometry(.017,.017,.027,6),fastener,root,Math.sin(a)*.127,yy+.058,Math.cos(a)*.127);}}
        for(let i=0;i<9;i++)box(root,polymer,[.08,-.35+i*.085,.128],[i%2?.028:.065,.005,.005],.001);
        for(const side of [-1,1])for(const y of [-.6,.6]){const bolt=mesh(new T.CylinderGeometry(.026,.026,.025,6),fastener,root,side*.35,y,.163);bolt.rotation.x=Math.PI/2;box(root,polymer,[side*.35,y,.179],[.022,.003,.003],.0005);}
        this.sign(root,'BWS • 500 ML',new T.Vector3(0,-.60,.162),.55,.048);
        this.sign(root,'250 — 350 — 500',new T.Vector3(-.055,.015,.14),.09,.48);
        for(const yy of [-.4,.4]){const clamp=mesh(new T.TorusGeometry(.151,.006,6,36),fastener,root,0,yy,0);clamp.rotation.x=Math.PI/2;}
        const valve=mesh(new T.CylinderGeometry(.027,.027,.20,16),metal,root,.20,.48,0);valve.rotation.z=Math.PI/2;
        const joint=mesh(new T.CylinderGeometry(.042,.042,.046,6),fastener,root,.15,.48,0);joint.rotation.z=Math.PI/2;
        const handle=mesh(new T.TorusGeometry(.066,.009,6,24),amber,root,.32,.48,0);handle.rotation.y=Math.PI/2;
        for(let i=0;i<3;i++)pipe(root,amber,[new T.Vector3(.32,.48,0),new T.Vector3(.32,.48+Math.sin(i*2.094)*.056,Math.cos(i*2.094)*.056)],.005,2);
        pipe(root,material(0x283f40,.9),[new T.Vector3(.23,.45,0),new T.Vector3(.28,.12,.1),new T.Vector3(.12,-.47,0)],.012,18);
        pipe(root,metal,[new T.Vector3(0,.75,0),new T.Vector3(0,5,0),new T.Vector3(0,7.8,0)],.012,8);
      }else if(key==='sediment'){
        for(const x of [-.55,.55])for(const z of [-.55,.55])pipe(root,amber,[new T.Vector3(x,-.1,z),new T.Vector3(x,.2,z)],.025,2);
        pipe(root,amber,[new T.Vector3(-.55,.08,-.55),new T.Vector3(.55,.08,-.55),new T.Vector3(.55,.08,.55),new T.Vector3(-.55,.08,.55),new T.Vector3(-.55,.08,-.55)],.018,8);
      }else if(key==='sensor'){
        const head=box(root,amber,[0,.35,0],[.55,.6,.42],.06);head.name='Recovered research sensor';
        box(root,metal,[0,.35,-.217],[.40,.43,.015],.015);box(root,material(0x243b3e,.8),[0,.40,-.229],[.30,.20,.012],.01);
        for(const x of [-.19,.19])for(const y of [.16,.55]){const screw=mesh(new T.CylinderGeometry(.015,.015,.02,12),metal,root,x,y,-.235);screw.rotation.x=Math.PI/2;}
        for(const x of [-.13,0,.13]){const port=mesh(new T.CylinderGeometry(.030,.030,.06,20),metal,root,x,.13,-.23);port.rotation.x=Math.PI/2;}
        for(let i=0;i<3;i++){const a=i/3*6.28;pipe(root,metal,[new T.Vector3(0,.1,0),new T.Vector3(Math.sin(a)*.65,-.55,Math.cos(a)*.65)],.035,3);}
        const gasket=material(0x253c3c,.85);
        mesh(new T.CylinderGeometry(.105,.115,.045,20),gasket,root,0,.72,0);
        const dome=new T.SphereGeometry(.09,24,12,0,Math.PI*2,0,Math.PI*.5);
        mesh(dome,new T.MeshPhysicalMaterial({color:0xd7a65a,emissive:0xad6d24,emissiveIntensity:.35,roughness:.30,clearcoat:.85}),root,0,.745,0);
        for(const side of [-1,1])pipe(root,metal,[new T.Vector3(side*.11,.73,0),new T.Vector3(side*.085,.85,0),new T.Vector3(0,.86,0)],.006,6);
      }else{
        pipe(root,material(0x2d3836,.72),[new T.Vector3(-.4,0,-.2),new T.Vector3(.2,.5,0),new T.Vector3(1.4,.2,-1.2),new T.Vector3(2.5,-.3,-3)],.055,20);
        box(root,metal,[0,-.16,0],[.8,.12,.7]);
      }
      const ring=mesh(new T.TorusGeometry(key==='sensor'?.58:.5,.009,5,48),new T.MeshBasicMaterial({color:0xf3d38a,transparent:true,opacity:.32,depthWrite:false}),root,0,.12,0);ring.rotation.x=Math.PI/2;ring.name='Tool focus';ring.visible=false;
    }
  }

  private createLagoonSites() {
    const metal=new T.MeshStandardMaterial({color:0x3e555a,metalness:.28,roughness:.58});
    for(const [key,p] of Object.entries(LAGOON_SAMPLES)) {
      const root=this.sites.get(key)!.clone();root.name=`Lagoon ${key}`;root.position.set(p.x,p.y,p.z);this.undersea.add(root);this.sites.set(`lagoon-${key}`,root);
    }
    TRANSECT_STATIONS.forEach((station,index)=>{
      const root=this.sites.get('sensor')!.clone();root.name=`Acoustic station ${index+1}`;root.position.set(station.x,station.y,station.z);
      root.rotation.y=Math.PI;
      const tetherBottom=expeditionFloor(station.x,station.z)-station.y+.1;
      pipe(root,metal,[new T.Vector3(0,-.55,0),new T.Vector3(.25,tetherBottom*.5,.1),new T.Vector3(0,tetherBottom,0)],.018,12);
      box(root,metal,[0,tetherBottom,0],[.8,.18,.8],.06);
      this.instrumentLabel(root,`SW-0${index+1}`);
      this.undersea.add(root);this.sites.set(`transect-${index}`,root);
    });
    for(const [key,p] of Object.entries(PASSAGE_SAMPLES)) {
      const root=this.sites.get(key)!.clone();root.name=`Coral garden ${key}`;root.position.set(p.x,p.y,p.z);this.undersea.add(root);this.sites.set(`passage-${key}`,root);
    }
    PASSAGE_STATIONS.forEach((station,index)=>{
      const root=this.sites.get('sensor')!.clone();root.name=`Passage survey ${station.name}`;root.position.set(station.x,station.y,station.z);root.rotation.y=Math.PI;
      const bottom=expeditionFloor(station.x,station.z)-station.y+.15;
      pipe(root,metal,[new T.Vector3(0,-.55,0),new T.Vector3(.12,bottom*.5,0),new T.Vector3(0,bottom,0)],.018,10);
      box(root,metal,[0,bottom,0],[.70,.16,.70],.04);
      this.instrumentLabel(root,`LP-0${index+1}`);
      this.undersea.add(root);this.sites.set(`passage-station-${index}`,root);
    });
  }

  update(time:number,position:T.Vector3,underwater:boolean,lightLevel:number){
    this.undersea.visible=underwater;
    this.time.value=time;this.underwater.value=underwater?1:0;
    for(const animal of this.animals){const pose=wildlifePose(animal.key,time,animal.radius,animal.pace,animal.phase);animal.root.position.set(animal.home.x+pose.x,animal.home.y+pose.y,animal.home.z+pose.z);
      animal.root.rotation.y=pose.yaw;animal.root.rotation.z=pose.bank;
      animal.parts.forEach((p,i)=>{p.rotation.x=(i<2?-1:1)*pose.stroke*(i%2?.55:1);});
      animal.root.visible=animal.root.position.distanceToSquared(position)<190*190;
    }
    let instrumentRange=Infinity;
    for(const [key,root]of this.sites)if((key.startsWith('transect-')||key.startsWith('passage-station-'))&&root.visible)instrumentRange=Math.min(instrumentRange,root.position.distanceTo(position));
    const workBeam=.28+.72*T.MathUtils.smoothstep(instrumentRange,2,6);
    this.diveLight.visible=underwater;this.diveLight.intensity=(36+lightLevel*18)*workBeam;this.diveLight.distance=38+lightLevel*8;
    for(const group of this.navBuoys)group.position.y=Math.sin(time*.9+group.position.x)*.12;
  }
  pointLight(camera:T.Camera){this.diveLight.position.copy(camera.position);camera.getWorldDirection(this.v);this.diveLight.target.position.copy(camera.position).addScaledVector(this.v,15);}

  photographicTarget(camera:T.Camera,diver:T.Vector3,photographed:readonly SpeciesKey[]=[],allowed:readonly SpeciesKey[]=[]){
    return this.photographicSubject(camera,diver,photographed,allowed)?.key;
  }
  photographicSubject(camera:T.Camera,diver:T.Vector3,photographed:readonly SpeciesKey[]=[],allowed:readonly SpeciesKey[]=[]){
    let candidate:Animal|undefined;let best=Infinity;
    const roots=this.animals.filter(a=>a.root.visible).map(a=>a.root);
    for(const root of roots)root.updateWorldMatrix(true,true);
    for(const a of this.animals){const distance=a.root.position.distanceTo(diver);if(allowed.length&&!allowed.includes(a.key)||photographed.includes(a.key)||distance>25||distance<1.6||!a.root.visible)continue;
      this.projected.copy(a.root.position).project(camera);if(this.projected.z<0||this.projected.z>1||Math.abs(this.projected.x)>.12||Math.abs(this.projected.y)>.17)continue;
      // Rocks between camera and animal prevent an observation being recorded.
      const dir=a.root.position.clone().sub(camera.position);const length=dir.length();dir.normalize();
      // A foreground animal must not become a photograph of one behind it.
      this.photoRay.set(camera.position,dir);this.photoRay.far=length+1;
      const first=this.photoRay.intersectObjects(roots,true)[0];
      if(!first)continue;
      let owner:T.Object3D|null=first.object;
      while(owner&&owner!==a.root&&!roots.includes(owner as T.Group))owner=owner.parent;
      if(owner!==a.root)continue;
      const frame=projectedSubjectBounds(a.root,camera);
      if(frame.max.y-frame.min.y<.055)continue;
      if(this.rockBounds.some(b=>{const t=b.center.clone().sub(camera.position).dot(dir);if(t<0||t>length)return false;const at=camera.position.clone().addScaledVector(dir,t);const d=at.sub(b.center);return (d.x/b.radii.x)**2+(d.y/b.radii.y)**2+(d.z/b.radii.z)**2<.85;}))continue;
      const score=(this.projected.x**2+this.projected.y**2)*100+distance*.01;if(score<best){best=score;candidate=a;}
    }return candidate;
  }
  resolveDiver(position:T.Vector3,previous:T.Vector3){
    for(const b of this.rockBounds){const d=position.clone().sub(b.center);const rx=b.radii.x+.45,ry=b.radii.y+.55,rz=b.radii.z+.45;const norm=Math.sqrt((d.x/rx)**2+(d.y/ry)**2+(d.z/rz)**2);if(norm<1){if(norm<.001){position.copy(previous);continue;}position.copy(b.center).add(new T.Vector3(d.x/norm,d.y/norm,d.z/norm));}}
    const local=position.clone();this.wreck.worldToLocal(local);
    if(local.z>-10&&local.z<10&&local.y>-.4&&local.y<3.3&&Math.abs(local.x)<3.1){position.copy(previous);}
    position.y=Math.max(position.y,expeditionFloor(position.x,position.z)+.8);
  }
  updateSites(record:ExpeditionRecord,tool:string){
    const plan=expeditionPlan(record);
    for(const [key,root]of this.sites){
      const lagoon=key.startsWith('lagoon-'),transect=key.startsWith('transect-'),passage=key.startsWith('passage-');
      const station=transect||key.startsWith('passage-station-');
      const kind=lagoon?key.slice(7):passage?key.slice(8):key;
      const index=Number(key.slice(key.lastIndexOf('-')+1));
      const collected=station?record.transectReadings.includes(index):kind==='water'?record.waterSample:kind==='sediment'?record.sedimentSample:kind==='cable'?record.cableFreed:record.sensorRecovered;
      root.visible=(record.route==='passage'?passage:record.route==='lagoon'?lagoon||transect:!lagoon&&!transect&&!passage)&&(!(kind==='sensor'||kind==='cable')||!collected);
      if(station&&!plan.stations.length||kind==='water'&&!plan.samplesRequired||kind==='sediment'&&!plan.samplesRequired||(kind==='sensor'||kind==='cable')&&!station&&!plan.recoveryRequired)root.visible=false;
      const ring=root.getObjectByName('Tool focus');if(ring)ring.visible=!collected&&(station?tool==='scanner':kind==='water'||kind==='sediment'?tool==='sampler':kind==='cable'?tool==='cutter':tool==='scanner');
    }
  }
}
