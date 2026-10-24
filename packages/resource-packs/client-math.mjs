import data from'./client-render-data.json' with{type:'json'};
function table(encoded,size){const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);return Array.from({length:bytes.length/size},(_,i)=>size===4?view.getFloat32(i*size,true):view.getFloat64(i*size,true));}
const sine=table(data.SIN,4),asin=table(data.ASIN_TAB,8),cosine=table(data.COS_TAB,8),bits=new DataView(new ArrayBuffer(8)),bias=(()=>{bits.setBigUint64(0,4805340802404319232n);return bits.getFloat64(0);})(),perms=Uint8Array.from(atob(data.biomeNoisePermutation),c=>c.charCodeAt(0)),F=Math.fround;
export const clientSin=angle=>sine[Math.trunc(angle*10430.378350470453)&65535],clientCos=angle=>sine[Math.trunc(angle*10430.378350470453+16384)&65535];
export function clientAtan2(y,x){
  const square=x*x+y*y;if(Number.isNaN(square))return NaN;const negY=y<0,negX=x<0;if(negY)y=-y;if(negX)x=-x;const steep=y>x;if(steep)[x,y]=[y,x];
  bits.setFloat64(0,square);bits.setBigInt64(0,6910469410427058090n-(bits.getBigInt64(0)>>1n));const initial=bits.getFloat64(0),inverse=initial*(1.5-.5*square*initial*initial);x*=inverse;y*=inverse;
  const yp=bias+y;bits.setFloat64(0,yp);const index=bits.getUint32(4),s=yp-bias,sd=y*cosine[index]-x*s;let angle=asin[index]+(6+sd*sd)*sd*(1/6);if(steep)angle=Math.PI/2-angle;if(negX)angle=Math.PI-angle;return negY?-angle:angle;
}
const gradients=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]],G=(3-Math.sqrt(3))/6,S=.5*(Math.sqrt(3)-1),p=x=>perms[x&255];
export function biomeInfoNoise(x,y){
  const skew=(x+y)*S,i=Math.floor(x+skew),j=Math.floor(y+skew),t=(i+j)*G,x0=x-(i-t),y0=y-(j-t),i1=x0>y0?1:0,j1=1-i1;
  const corner=(hash,a,b)=>{let n=.5-a*a-b*b;if(n<0)return 0;n*=n;const g=gradients[hash%12];return n*n*(g[0]*a+g[1]*b+0);};
  return F(70*(corner(p(i+p(j)),x0,y0)+corner(p(i+i1+p(j+j1)),x0-i1+G,y0-j1+G)+corner(p(i+1+p(j+1)),x0-1+2*G,y0-1+2*G)));
}
