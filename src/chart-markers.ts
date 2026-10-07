export type ChartMarker = { id:string; x:number; y:number };
export function layoutChartMarkers(markers:readonly ChartMarker[],width:number,height:number,size=44,gap=4):ChartMarker[] {
  if(width<size||height<size)throw new Error('Chart is too small for its controls.');
  const step=size+gap,margin=size/2,slots:{x:number;y:number}[]=[];
  const columns=Math.floor((width-size)/step)+1,rows=Math.floor((height-size)/step)+1;
  const left=(width-(columns-1)*step)/2,top=(height-(rows-1)*step)/2;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)slots.push({x:left+col*step,y:top+row*step});
  if(markers.length>slots.length)throw new Error('Chart controls exceed the available space.');
  // Touch targets occupy separate slots; leader lines preserve exact chart coordinates.
  return markers.map(marker=>{
    let best=0;for(let index=1;index<slots.length;index++)if((slots[index].x-marker.x)**2+(slots[index].y-marker.y)**2<(slots[best].x-marker.x)**2+(slots[best].y-marker.y)**2)best=index;
    const point=slots.splice(best,1)[0];return{id:marker.id,x:Math.max(margin,point.x),y:Math.max(margin,point.y)};
  });
}
