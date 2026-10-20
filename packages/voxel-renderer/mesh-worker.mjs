const directions={north:[0,0,-1],south:[0,0,1],west:[-1,0,0],east:[1,0,0],up:[0,1,0],down:[0,-1,0]};
let revision=0;
self.onmessage=async({data})=>{
  if(data.kind==='cancel'){revision++;return;}const job=++revision;
  try{const{width,height,depth,blocks,palette,models,clip,id}=data;const opaque=[],transparent=[],center=[width/2,height/2,depth/2];let faces=0;
    const inside=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<width&&y<height&&z<depth&&(!clip||x>=clip.min[0]&&y>=clip.min[1]&&z>=clip.min[2]&&x<clip.max[0]&&y<clip.max[1]&&z<clip.max[2]);
    for(let y=0;y<height;y++){for(let z=0;z<depth;z++)for(let x=0;x<width;x++){if(!inside(x,y,z))continue;const index=blocks[x+width*(z+depth*y)],block=palette[index];if(!models[index]?.length)continue;
      for(const quad of models[index]){if(quad.cull){const d=directions[quad.cull],nx=x+d[0],ny=y+d[1],nz=z+d[2];if(inside(nx,ny,nz)){const neighbor=palette[blocks[nx+width*(nz+depth*ny)]];if(neighbor.solid===true||block.cullSameMaterial===true&&neighbor.id===block.id)continue;}}
        if(++faces>250000)throw new Error('Visible geometry exceeds the preview mesh budget. Reduce the area or use clipping.');const target=quad.transparency==='blend'?transparent:opaque;
        for(const vertex of[0,1,2,0,2,3])target.push(quad.positions[vertex][0]+x-center[0],quad.positions[vertex][1]+y-center[1],quad.positions[vertex][2]+z-center[2],...quad.normal,...quad.color,...quad.uv[vertex]);
      }
    }if((y&3)===0){self.postMessage({kind:'progress',id,progress:(y+1)/height});await new Promise(resolve=>setTimeout(resolve,0));if(job!==revision)return;}}
    const a=new Float32Array(opaque),b=new Float32Array(transparent);self.postMessage({kind:'mesh',id,opaque:a.buffer,transparent:b.buffer,faces},[a.buffer,b.buffer]);
  }catch(error){self.postMessage({id:data.id,error:error.message||String(error)});}
};
