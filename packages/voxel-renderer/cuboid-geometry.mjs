// Pinned Minecraft 26.3 cuboid geometry, JOML 1.10.9 default (non-fastmath/non-FMA) arithmetic.
import{closestShadeDirection}from'./flat-lighting.mjs';
const F=Math.fround,PI=F(Math.PI),HALF_PI=F(Math.PI/2),TWO_PI=F(Math.PI*2),DEG=F(Math.PI/180),identity=[1,0,0,0,1,0,0,0,1];
export const cubeFaces={north:(a,b)=>[[b[0],b[1],a[2]],[b[0],a[1],a[2]],[a[0],a[1],a[2]],[a[0],b[1],a[2]]],south:(a,b)=>[[a[0],b[1],b[2]],[a[0],a[1],b[2]],[b[0],a[1],b[2]],[b[0],b[1],b[2]]],east:(a,b)=>[[b[0],b[1],b[2]],[b[0],a[1],b[2]],[b[0],a[1],a[2]],[b[0],b[1],a[2]]],west:(a,b)=>[[a[0],b[1],a[2]],[a[0],a[1],a[2]],[a[0],a[1],b[2]],[a[0],b[1],b[2]]],up:(a,b)=>[[a[0],b[1],a[2]],[a[0],b[1],b[2]],[b[0],b[1],b[2]],[b[0],b[1],a[2]]],down:(a,b)=>[[a[0],a[1],b[2]],[a[0],a[1],a[2]],[b[0],a[1],a[2]],[b[0],a[1],b[2]]]};
function number(value,name){if(typeof value!=='number'||!Number.isFinite(value)||!Number.isFinite(F(value)))throw new Error(`${name} requires a finite binary32 number.`);return F(value);}
export function elementPosition(value,name){if(!Array.isArray(value)||value.length!==3)throw new Error(`${name} requires three coordinates.`);return value.map(v=>{v=number(v,name);if(v< -16||v>32)throw new Error(`${name} exceeds native model bounds (-16 to 32).`);return v;});}
function sinCos(degrees){const angle=F(degrees*DEG),sin=F(Math.sin(angle)),cos=F(Math.sqrt(F(1-F(sin*sin)))),a=F(angle+HALF_PI),quotient=Math.max(-2147483648,Math.min(2147483647,Math.trunc(F(a/TWO_PI))));let b=F(a-F(quotient*TWO_PI));if(b<0)b=F(b+TWO_PI);return[sin,b>=PI?-cos:cos];}
export function elementRotation(value){
  if(value===undefined)return null;if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Element rotation requires an object.');
  if(!Array.isArray(value.origin)||value.origin.length!==3)throw new Error('Element rotation requires three origin coordinates.');const origin=value.origin.map(v=>F(number(v,'Rotation origin')/16));
  if(value.rescale!==undefined&&typeof value.rescale!=='boolean')throw new Error('Element rescale must be a boolean.');let matrix;
  if(Object.hasOwn(value,'axis')||Object.hasOwn(value,'angle')){
    if(typeof value.axis!=='string'||!['x','y','z'].includes(value.axis.toLowerCase()))throw new Error('Element rotation requires a native X, Y or Z axis.');const angle=number(value.angle,'Rotation angle'),[s,c]=sinCos(angle);matrix=angle===0?identity.slice():value.axis.toLowerCase()==='x'?[1,0,0,0,c,s,0,-s,c]:value.axis.toLowerCase()==='y'?[c,0,-s,0,1,0,s,0,c]:[c,s,0,-s,c,0,0,0,1];
  }else{
    if(!['x','y','z'].some(k=>Object.hasOwn(value,k)))throw new Error('Element rotation requires an axis/angle or Euler values.');const[sx,cx]=sinCos(number(Object.hasOwn(value,'x')?value.x:0,'Rotation X')),[sy,cy]=sinCos(number(Object.hasOwn(value,'y')?value.y:0,'Rotation Y')),[sz,cz]=sinCos(number(Object.hasOwn(value,'z')?value.z:0,'Rotation Z')),a=F(cz*sy),b=F(sz*sy);
    matrix=[F(cz*cy),F(sz*cy),-sy,F(F(-sz*cx)+F(a*sx)),F(F(cz*cx)+F(b*sx)),F(cy*sx),F(F(-sz*-sx)+F(a*cx)),F(F(cz*-sx)+F(b*cx)),F(cy*cx)];
  }
  if(value.rescale&&!matrix.every((v,i)=>v===identity[i])){const scale=[0,1,2].map(column=>F(1/Math.max(...matrix.slice(column*3,column*3+3).map(Math.abs))));matrix=matrix.map((v,i)=>F(v*scale[Math.floor(i/3)]));}
  if(!matrix.every(Number.isFinite))throw new Error('Element rotation produced a nonfinite matrix.');return{origin,matrix};
}
export function transformCuboidPoint(point,{matrix,origin}){const p=point.map((v,i)=>F(v-origin[i]));return[0,1,2].map(row=>F(F(F(matrix[row]*p[0])+F(F(matrix[3+row]*p[1])+F(F(matrix[6+row]*p[2])+0)))+origin[row]));}
export function cuboidNormal(points){const a=points[1].map((v,i)=>F(v-points[0][i])),b=points[2].map((v,i)=>F(v-points[0][i])),n=[F(F(a[1]*b[2])-F(a[2]*b[1])),F(F(a[2]*b[0])-F(a[0]*b[2])),F(F(a[0]*b[1])-F(a[1]*b[0]))],squared=F(F(n[0]*n[0])+F(F(n[1]*n[1])+F(n[2]*n[2]))),inv=F(1/Math.sqrt(squared));return n.map(v=>F(v*inv));}
export function cuboidFacing(normal){return normal.every(Number.isFinite)&&normal.some(v=>v!==0)?closestShadeDirection(normal):null;}
export function cuboidWinding(points,uv,direction){const min=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis]))),max=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis]))),ordered=cubeFaces[direction](min,max);for(let i=0;i<4;i++){const at=points.findIndex((p,j)=>j>=i&&p.every((v,k)=>v===ordered[i][k]));if(at<0)throw new Error('Native cuboid winding cannot find a matching corner.');[points[i],points[at]]=[points[at],points[i]];[uv[i],uv[at]]=[uv[at],uv[i]];}}
