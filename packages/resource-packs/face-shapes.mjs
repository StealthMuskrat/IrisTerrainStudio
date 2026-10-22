const EPS=1e-7,UNIT_FACE=[0,0,1,1];
export function rectangleCovered(rectangle,occluders){
  const[a,b,c,d]=rectangle;if(c-a<EPS||d-b<EPS)return true;
  const xs=[a,c,...occluders.flatMap(r=>[Math.max(a,Math.min(c,r[0])),Math.max(a,Math.min(c,r[2]))])].sort((x,y)=>x-y);
  for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<EPS)continue;const x=(xs[i]+xs[i-1])/2,intervals=occluders.filter(r=>x>=r[0]-EPS&&x<=r[2]+EPS).map(r=>[r[1],r[3]]).sort((x,y)=>x[0]-y[0]);let covered=b;for(const[start,end]of intervals){if(start>covered+EPS)break;covered=Math.max(covered,end);}if(covered<d-EPS)return false;}return true;
}
export const fullFaceShape=rectangles=>rectangles.length===1&&rectangles[0].every((v,i)=>v===UNIT_FACE[i]);
