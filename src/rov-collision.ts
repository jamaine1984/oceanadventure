export function sweepExpandedBox(previous:{x:number;y:number;z:number},requested:{x:number;y:number;z:number},min:{x:number;y:number;z:number},max:{x:number;y:number;z:number},radius:number){
  let enter=0,leave=1;
  for(const axis of ['x','y','z'] as const){
    const start=previous[axis],delta=requested[axis]-start,low=min[axis]-radius,high=max[axis]+radius;
    if(Math.abs(delta)<1e-9){if(start<low||start>high)return 1;continue;}
    const a=(low-start)/delta,b=(high-start)/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));if(enter>leave)return 1;
  }
  return Math.max(0,enter-.001);
}
