import * as T from 'three';

export const ISLAND_LANDMARKS = {
  research: { name: 'Research exchange', x: -34, z: 32.5, facing: Math.PI },
  outfitter: { name: 'Dive outfitter', x: -34, z: 43.5, facing: Math.PI },
  lookout: { name: 'Island trail', x: -62, z: 44, facing: -Math.PI / 2 },
  boat: { name: 'Boarding gate', x: -8.5, z: 31, facing: Math.PI / 2 },
} as const;
export type IslandDestination = keyof typeof ISLAND_LANDMARKS;
type Barrier = { x: number; z: number; width: number; depth: number };
const TRAIL = [[-41,41],[-46,41],[-50,42],[-54,43],[-58,44],[-62,44],[-67,46]];

export function trailDistance(x: number, z: number) {
  let distance = Infinity;
  for (let i = 1; i < TRAIL.length; i++) {
    const a=TRAIL[i-1],b=TRAIL[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return distance;
}

/** Grounded circular controller. Collision proxies survive static rendering batches. */
export class IslandWalk {
  readonly barriers: Barrier[] = [];
  readonly trees: {x:number;z:number;radius:number}[] = [];
  readonly radius = .28;
  constructor(private ground: (x:number,z:number)=>number) {
    for (const cz of [36,47]) {
      this.barriers.push({x:-34,z:cz+1.6,width:8.6,depth:.28});
      for(const x of [-38.2,-29.8])this.barriers.push({x,z:cz+.1,width:.3,depth:3.4});
      this.barriers.push({x:-34,z:cz-1.5,width:8.0,depth:1.2});
      for(const x of [-38,-30])for(const z of [cz-2,cz+2])this.barriers.push({x,z,width:.28,depth:.28});
    }
    for(const [x,z] of [[-40,32],[-40,34],[-39.5,51],[-24,48]])this.barriers.push({x,z,width:1.25,depth:.9});
    this.barriers.push({x:-25,z:37,width:.9,depth:3.1},{x:-39,z:40.8,width:1.4,depth:1});
    // Leave a real opening at the west steps; east rail remains continuous.
    this.barriers.push({x:-22,z:41,width:.18,depth:22},{x:-41,z:34.75,width:.18,depth:9.5},{x:-41,z:47.25,width:.18,depth:9.5});
    for(const x of [-8.5,8.5])for(let z=-2;z<=54;z+=5.6)this.trees.push({x,z,radius:.25});
  }
  height(x:number,z:number) {
    let h=this.ground(x,z);
    if(h<.28)h=-Infinity; // Shoreline and steep cliffs do not let the walker fall into water.
    for(const x0 of [-8.5,8.5])if(Math.abs(x-x0)<1.54-this.radius&&z>-3.8+this.radius&&z<58-this.radius)h=Math.max(h,.9225);
    if(x>-39.5+this.radius&&x<-6.5-this.radius&&z>50.5+this.radius&&z<57.5-this.radius)h=Math.max(h,1.15);
    if(x>-40-this.radius&&x<-22-this.radius&&z>31+this.radius&&z<51)h=Math.max(h,1.525);
    if(x>-31+this.radius&&x<-25-this.radius&&z>=51&&z<=54)h=Math.max(h,1.525-(z-51)*.125);
    // Four shallow timber steps follow the deck down to the natural terrace.
    if(Math.abs(z-41)<1.4-this.radius&&x>=-42.3&&x<=-39.8)h=Math.max(h,1.525-T.MathUtils.clamp((-x-40)/2.3,0,1)*.425);
    return h;
  }
  blocked(x:number,z:number) {
    const r=this.radius;
    return this.barriers.some(b=>Math.abs(x-b.x)<b.width/2+r&&Math.abs(z-b.z)<b.depth/2+r)
      ||this.trees.some(t=>Math.hypot(x-t.x,z-t.z)<t.radius+r);
  }
  canStep(from:T.Vector3,x:number,z:number) {
    const h=this.height(x,z),distance=Math.hypot(x-from.x,z-from.z);
    if(!Number.isFinite(h)||this.blocked(x,z))return false;
    // Small steps are allowed; high ledges and steep slopes are not.
    return Math.abs(h-from.y)<=Math.max(.26,distance*.85);
  }
  move(position:T.Vector3,dx:number,dz:number) {
    const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.10));dx/=count;dz/=count;
    for(let i=0;i<count;i++){
      if(this.canStep(position,position.x+dx,position.z+dz))position.set(position.x+dx,this.height(position.x+dx,position.z+dz),position.z+dz);
      else { // Slide along obstacles instead of stopping at every corner.
        if(this.canStep(position,position.x+dx,position.z))position.set(position.x+dx,this.height(position.x+dx,position.z),position.z);
        if(this.canStep(position,position.x,position.z+dz))position.set(position.x,this.height(position.x,position.z+dz),position.z+dz);
      }
    }
  }
  private canTraverse(from:T.Vector3,to:T.Vector3){
    const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.08)),p=from.clone();
    for(let i=1;i<=steps;i++){const x=T.MathUtils.lerp(from.x,to.x,i/steps),z=T.MathUtils.lerp(from.z,to.z,i/steps);if(!this.canStep(p,x,z))return false;p.set(x,this.height(x,z),z);}return true;
  }
  async route(start:T.Vector3,target:T.Vector3) {
    const size=.65,minX=-90,minZ=-4;
    const cell=(x:number,z:number)=>`${Math.round((x-minX)/size)},${Math.round((z-minZ)/size)}`;
    const points=new Map<string,T.Vector3>();
    const point=(key:string)=>{let p=points.get(key);if(!p){const [x,z]=key.split(',').map(Number);p=new T.Vector3(minX+x*size,this.height(minX+x*size,minZ+z*size),minZ+z*size);points.set(key,p);}return p;};
    const [sx,sz]=cell(start.x,start.z).split(',').map(Number);
    const candidates:string[]=[];for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)candidates.push(`${sx+x},${sz+z}`);
    const first=candidates.sort((a,b)=>point(a).distanceToSquared(start)-point(b).distanceToSquared(start)).find(key=>this.canTraverse(start,point(key)));
    if(!first)return [];
    const goal=cell(target.x,target.z);
    const open:{key:string;score:number}[]=[],closed=new Set<string>(),came=new Map<string,string>(),cost=new Map([[first,0]]);
    const push=(key:string,score:number)=>{let i=open.length;open.push({key,score});while(i>0){const parent=(i-1)>>1;if(open[parent].score<=score)break;[open[i],open[parent]]=[open[parent],open[i]];i=parent;}};
    const pop=()=>{const result=open[0],last=open.pop()!;if(open.length){open[0]=last;let i=0;while(true){let next=i,left=i*2+1,right=left+1;if(left<open.length&&open[left].score<open[next].score)next=left;if(right<open.length&&open[right].score<open[next].score)next=right;if(next===i)break;[open[i],open[next]]=[open[next],open[i]];i=next;}}return result.key;};
    push(first,start.distanceTo(target));
    let visited=0;
    while(open.length&&visited++<18000){
      // Spread occasional route planning over frames so a phone can still render and accept input.
      if(visited%220===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
      const current=pop();if(closed.has(current))continue;closed.add(current);
      if(current===goal){if(!this.canTraverse(point(current),target))return [];const route=[target.clone()];let key=current;while(key!==first){route.push(point(key));key=came.get(key)!;}route.push(point(first));return route.reverse();}
      const p=point(current),[cx,cz]=current.split(',').map(Number);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const nx=cx+dx,nz=cz+dz;if(nx<0||nx>160||nz<0||nz>132)continue;
        const key=`${nx},${nz}`,q=point(key);
        if(closed.has(key))continue;
        if(!this.canTraverse(p,q))continue;
        if(dx&&dz&&(!this.canStep(p,p.x+dx*size,p.z)||!this.canStep(p,p.x,p.z+dz*size)))continue;
        const tentative=(cost.get(current)??Infinity)+p.distanceTo(q);
        if(tentative>=(cost.get(key)??Infinity))continue;
        came.set(key,current);cost.set(key,tentative);push(key,tentative+q.distanceTo(target));
      }
    }
    return [];
  }
}
