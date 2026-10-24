import{faceParameters}from'../resource-packs/face-materials.mjs';
// Entire snapshots must contain only empty models or static opaque unit cubes.
// This excludes overlapping/overhanging models, offsets, fluids and contextual plans.
export function texturedCubePlan(models,palette){
  const specs=new WeakMap();
  for(let index=0;index<palette.length;index++){
    const block=palette[index],model=models[index];if(block.modelOffset||block.renderProfile?.fluid&&block.renderProfile.fluid!=='empty')return null;
    if(!Array.isArray(model))return null;if(!model.length)continue;if(model.length!==6)return null;
    const faces=new Set();
    for(const quad of model){
      if(quad.transparency!=='opaque'||quad.fluid||!Array.isArray(quad.spriteUv)||quad.spriteUv.length!==4||!quad.spriteUv.every(Number.isFinite))return null;
      const rect=quad.spriteUv,[a,b,c,d]=rect;if(a<0||b<0||c>1||d>1||c<=a||d<=b)return null;
      const axis=quad.normal.findIndex(v=>Math.abs(v)===1);if(axis<0||quad.normal.some((v,i)=>i!==axis&&v!==0))return null;
      const sign=quad.normal[axis],side=sign>0?1:0,[u,v]=[0,1,2].filter(i=>i!==axis),corners=new Set(),uv=[];
      if(quad.positions.length!==4||quad.uv.length!==4)return null;
      for(let i=0;i<4;i++){
        const p=quad.positions[i],mapped=quad.uv[i];if(p[axis]!==side||![p[u],p[v]].every(n=>n===0||n===1))return null;corners.add(p[u]+','+p[v]);
        const tex=[(mapped[0]-a)/(c-a),(mapped[1]-b)/(d-b)];if(!tex.every(n=>n===0||n===1))return null;uv.push(tex);
      }
      if(corners.size!==4||new Set(uv.map(p=>p.join(','))).size!==4)return null;
      const at=(x,y)=>quad.positions.findIndex(p=>p[u]===x&&p[v]===y),o=at(0,0),x=at(1,0),y=at(0,1),uAxis=uv[o][0]!==uv[x][0]?u:v,vAxis=uv[o][1]!==uv[x][1]?u:v;
      for(let t=0;t<2;t++){const dx=uv[x][t]-uv[o][t],dy=uv[y][t]-uv[o][t];if(Math.abs(dx)+Math.abs(dy)!==1||quad.positions.some((p,i)=>uv[i][t]!==uv[o][t]+dx*p[u]+dy*p[v]))return null;}
      // Only the eight orthogonal full-sprite orientations tile without changing UV semantics.
      if(uAxis===vAxis||uv[o][0]===uv[x][0]&&uv[o][0]===uv[y][0]||uv[o][1]===uv[x][1]&&uv[o][1]===uv[y][1])return null;
      const face=axis+':'+side;if(faces.has(face))return null;faces.add(face);const direction=axis===0?(sign>0?'east':'west'):axis===1?(sign>0?'up':'down'):(sign>0?'south':'north');specs.set(quad,{axis,side,u,v,uAxis,vAxis,uv,rect,direction,key:[direction,...rect,...quad.positions.flat(),...uv.flat(),...faceParameters(quad)].join(',')});
    }
  }
  return specs;
}
export class TexturedCubeMerger{
  constructor(input,base,minimum,maximum,center,specs,emit){Object.assign(this,{input,base,minimum,maximum,center,specs,emit});this.planes=new Map();this.profiles=[];this.ids=new Map();}
  add(quad,owner,offset,color){
    const spec=this.specs.get(quad);if(!spec)throw new Error('Textured greedy admission changed within a snapshot.');
    const key=spec.key+':'+color.join(',');let id=this.ids.get(key);
    if(id===undefined){id=this.profiles.length;this.ids.set(key,id);this.profiles.push({quad,color,spec});}
    const{width,depth}=this.input,p=[owner%width,Math.floor(owner/(width*depth)),Math.floor(owner/width)%depth],planeKey=spec.direction+':'+p[spec.axis];let plane=this.planes.get(planeKey);
    if(!plane){plane={spec,slice:p[spec.axis],mask:new Uint32Array(256)};this.planes.set(planeKey,plane);}const slot=p[spec.u]-this.base[spec.u]+16*(p[spec.v]-this.base[spec.v]);if(plane.mask[slot])throw new Error('Textured greedy faces overlap an admitted cube.');plane.mask[slot]=id+1;
  }
  flush(){
    const{width,depth}=this.input;
    for(const plane of this.planes.values()){
      const{u,v,axis}=plane.spec,loU=Math.max(0,this.minimum[u]-this.base[u]),hiU=Math.min(16,this.maximum[u]-this.base[u]),loV=Math.max(0,this.minimum[v]-this.base[v]),hiV=Math.min(16,this.maximum[v]-this.base[v]),mask=plane.mask;
      for(let j=loV;j<hiV;j++)for(let i=loU;i<hiU;){const key=mask[i+16*j];if(!key){i++;continue;}let w=1,h=1;while(i+w<hiU&&mask[i+w+16*j]===key)w++;
        outer:while(j+h<hiV){for(let k=0;k<w;k++)if(mask[i+k+16*(j+h)]!==key)break outer;h++;}for(let k=0;k<h;k++)mask.fill(0,i+16*(j+k),i+w+16*(j+k));
        const{quad,color,spec}=this.profiles[key-1],p=[];p[axis]=plane.slice;p[u]=this.base[u]+i;p[v]=this.base[v]+j;const owner=p[0]+width*(p[2]+depth*p[1]),offset=p.map((value,a)=>value-this.center[a]);
        if(w*h===1)this.emit(quad,owner,offset,color);else{const size=[];size[axis]=1;size[u]=w;size[v]=h;this.emit({...quad,positions:quad.positions.map(p=>p.map((value,a)=>value*size[a])),uv:spec.uv.map(p=>[p[0]*size[spec.uAxis],p[1]*size[spec.vAxis]]),repeatSprite:spec.rect},owner,offset,color,w*h,true);}i+=w;
      }
    }
  }
}
export function repeatedSpriteUv(uv,rect){return uv.map((value,i)=>rect[i]+(value-Math.floor(value))*(rect[i+2]-rect[i]));}
