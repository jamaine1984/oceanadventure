// Inspect decoded model textures in a disposable browser; mission captures prove rendering separately.
async page=>{
  const result=await page.evaluate(async()=>{
    const {WreckwardWorld}=await import('/src/wreckward-world.ts');
    const world=new WreckwardWorld({add:()=>{}},-27),maps=[];
    try{
      await world.load();
      world.root.traverse(node=>{
        if(node.material?.map){
          const image=node.material.map.image;
          maps.push({material:node.material.name,width:image.width,height:image.height});
        }
      });
      if(maps.length!==4)throw Error('Missing baked surface map');
      for(const map of maps){
        const expected=['Oxidized hull coating','Corroded structural steel'].includes(map.material)?1024:512;
        if(map.width!==expected||map.height!==expected)throw Error('Incorrect texture resolution: '+JSON.stringify(map));
      }
      return maps;
    }finally{world.dispose();}
  });
  return{decodedMaps:result};
}
