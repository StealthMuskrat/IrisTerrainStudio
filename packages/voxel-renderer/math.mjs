export const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
export function normalize(a){const length=Math.hypot(...a)||1;return a.map(v=>v/length);}
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
export function lookAt(eye,target){const z=normalize(subtract(eye,target)),x=normalize(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,far/(near-far),-1,0,0,near*far/(near-far),0]);}
export function multiply(a,b){const result=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)result[c*4+r]+=a[k*4+r]*b[c*4+k];return result;}
export function inverse(matrix){const rows=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>c<4?matrix[c*4+r]:Number(c-4===r)));for(let i=0;i<4;i++){let pivot=i;for(let r=i+1;r<4;r++)if(Math.abs(rows[r][i])>Math.abs(rows[pivot][i]))pivot=r;[rows[i],rows[pivot]]=[rows[pivot],rows[i]];const divisor=rows[i][i];if(Math.abs(divisor)<1e-15)throw new Error('Camera matrix is singular.');for(let c=0;c<8;c++)rows[i][c]/=divisor;for(let r=0;r<4;r++)if(r!==i){const factor=rows[r][i];for(let c=0;c<8;c++)rows[r][c]-=factor*rows[i][c];}}const result=new Float64Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)result[c*4+r]=rows[r][c+4];return result;}
export function transform(matrix,point){const result=Array.from({length:4},(_,r)=>matrix[r]*point[0]+matrix[4+r]*point[1]+matrix[8+r]*point[2]+matrix[12+r]*(point[3]??1));return result.map(v=>v/result[3]);}
