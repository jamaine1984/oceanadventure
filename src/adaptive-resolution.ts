// Recover detail slowly; one overloaded sample must not trigger repeated up/down resizing.
export function resolutionStep(scale:number,fps:number,maximum:number,mobile:boolean,healthy=0) {
  const upper=Math.max(.52,Math.min(1,Number.isFinite(maximum)?maximum:1));
  const current=Math.max(.52,Math.min(upper,Number.isFinite(scale)?scale:upper));
  if(!Number.isFinite(fps))return {scale:current,healthy:0};
  if(fps<(mobile?32:58.5))return {scale:Math.max(.52,current-.06),healthy:0};
  const nextHealthy=fps>59.7?healthy+1:0;
  if(nextHealthy>=3)return {scale:Math.min(upper,current+.015),healthy:0};
  return {scale:current,healthy:nextHealthy};
}
