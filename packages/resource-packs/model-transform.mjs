import data from'./client-model-data.json' with{type:'json'};
if(data.minecraftVersion!=='26.3'||data.clientSha256!=='4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d')throw new Error('Client model inputs do not match the pinned target.');
const bits=new DataView(new ArrayBuffer(4)),float=hex=>{bits.setUint32(0,parseInt(hex,16));return bits.getFloat32(0);};
const identity3=[1,0,0,0,1,0,0,0,1],identityUv=[1,0,0,0,1,0];
const rotations=new Map(Object.entries(data.rotations).map(([key,value])=>{const matrix=value.matrix.map(float),inverseUv=Object.fromEntries(Object.entries(value.inverseUv).map(([face,row])=>[face,row.map(float)]));return[key,{matrix,inverseUv,identity:matrix.every((v,i)=>v===identity3[i]),identityUv:Object.fromEntries(Object.entries(inverseUv).map(([face,row])=>[face,row.every((v,i)=>v===identityUv[i])]))}];}));
export function quadrant(value=0){if(!Number.isInteger(value)||value< -2147483648||value>2147483647)throw new Error('Model rotations require a signed integer multiple of 90 degrees.');const normalized=(value%360+360)%360;if(normalized%90)throw new Error('Model rotations require a multiple of 90 degrees.');return normalized;}
export function modelRotation(x=0,y=0,z=0){const key=[x,y,z].map(quadrant).join(','),name=data.aliases[key],value=rotations.get(name);if(!value)throw new Error('Pinned model rotation is absent.');return value;}
const F=Math.fround;
export function rotateModelVector(vector,rotation){const m=rotation.matrix;return[0,1,2].map(row=>F(F(m[row]*vector[0])+F(F(m[3+row]*vector[1])+F(m[6+row]*vector[2]))));}
export function rotateModelPoint(point,rotation){if((rotation.identity??rotation.matrix.every((v,i)=>v===identity3[i])))return point.map(F);return rotateModelVector(point.map(value=>F(value-.5)),rotation).map(value=>F(value+.5));}
export function faceUv(face,u,v,rotation,locked){
  u=F(F(u)/16);v=F(F(v)/16);if(!locked)return[u,v];const m=rotation.inverseUv[face];if(!m)throw new Error('Pinned UV face transform is absent.');if((rotation.identityUv?.[face]??m.every((v,i)=>v===identityUv[i])))return[u,v];const x=F(u-.5),y=F(v-.5);return[F(F(F(m[0]*x)+F(F(m[1]*y)+m[2]))+.5),F(F(F(m[3]*x)+F(F(m[4]*y)+m[5]))+.5)];
}
export const CLIENT_MODEL_INPUT_ID=data.clientSha256;
