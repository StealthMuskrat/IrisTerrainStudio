import{normalize,cross,subtract}from'./math.mjs';
// Camera coordinates are relative to the retained volume center, never terrain inputs.
export const CAMERA_LIMIT=8192,PITCH_LIMIT=1.5;
export function navigationSettings(input={}){
  const mode=input.mode??'orbit',speed=input.speed??16;
  if(!['orbit','fly'].includes(mode)||!Number.isFinite(speed)||speed<.25||speed>256)throw new Error('Choose Orbit or Free fly and a speed from 0.25 to 256 blocks/second.');
  return{mode,speed};
}
export function cameraEye(camera){const{yaw,pitch,distance,target}=camera;return[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];}
export function rotateCamera(camera,yawDelta,pitchDelta,mode='orbit'){
  const eye=mode==='fly'?cameraEye(camera):null;
  camera.yaw=((camera.yaw+yawDelta)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);camera.pitch=Math.max(-PITCH_LIMIT,Math.min(PITCH_LIMIT,camera.pitch+pitchDelta));
  if(eye){const offset=cameraEye({...camera,target:[0,0,0]});camera.target=eye.map((value,axis)=>value-offset[axis]);}else translateCamera(camera,[0,0,0]);
}
export function translateCamera(camera,delta){
  const eye=cameraEye(camera),actual=delta.map((value,axis)=>Math.max(-CAMERA_LIMIT,Math.min(CAMERA_LIMIT,eye[axis]+value))-eye[axis]);
  if(!actual.some(value=>value!==0))return false;camera.target=camera.target.map((value,axis)=>value+actual[axis]);return true;
}
export function zoomCamera(camera,factor,mode='orbit',speed=16){
  if(mode==='fly'){const{forward}=cameraBasis(camera);return translateCamera(camera,forward.map(value=>value*Math.sign(1-factor)*speed*.15));}
  camera.distance=Math.max(1,Math.min(4096,camera.distance*factor));translateCamera(camera,[0,0,0]);return true;
}
export function cameraBasis(camera){const forward=normalize(subtract(camera.target,cameraEye(camera))),right=normalize(cross(forward,[0,1,0]));return{forward,right,up:cross(right,forward)};}
export const MOTION_CODES=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
export function advanceCamera(camera,keys,seconds,settings){
  if(!Number.isFinite(seconds)||seconds<=0)return false;seconds=Math.min(seconds,.05);
  const axis=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));let changed=false;
  const yaw=axis('ArrowLeft','ArrowRight')*seconds*1.5,pitch=axis('ArrowDown','ArrowUp')*seconds*1.5;
  if(yaw||pitch){rotateCamera(camera,yaw,pitch,settings.mode);changed=true;}
  if(settings.mode!=='fly')return changed;
  const{forward,right}=cameraBasis(camera),along=axis('KeyW','KeyS'),across=axis('KeyD','KeyA'),vertical=axis('KeyE','KeyQ'),move=forward.map((value,index)=>value*along+right[index]*across+(index===1?vertical:0));
  if(move.some(value=>value!==0)){const boost=keys.has('ShiftLeft')||keys.has('ShiftRight')?4:1;changed=translateCamera(camera,normalize(move).map(value=>value*seconds*settings.speed*boost))||changed;}
  return changed;
}
function volumeOffset(volume){return[volume.width,volume.height,volume.depth].map((value,axis)=>volume.origin[axis]+value/2);}
export function cameraView(volume,camera){const offset=volumeOffset(volume);return{eye:cameraEye(camera).map((value,axis)=>value+offset[axis]),yaw:camera.yaw*180/Math.PI,pitch:camera.pitch*180/Math.PI,distance:camera.distance};}
export function cameraFromView(volume,view){
  const{eye,yaw,pitch,distance}=view;
  if(!Array.isArray(eye)||eye.length!==3||!eye.every(Number.isFinite)||![yaw,pitch,distance].every(Number.isFinite)||Math.abs(yaw)>360000||Math.abs(pitch)>PITCH_LIMIT*180/Math.PI||distance<1||distance>4096)throw new Error('Enter finite eye coordinates, yaw within ±360000°, pitch within ±85.9436° and distance from 1 to 4096 blocks.');
  const offset=volumeOffset(volume),local=eye.map((value,axis)=>value-offset[axis]);if(local.some(value=>Math.abs(value)>CAMERA_LIMIT))throw new Error('The camera eye must stay within 8192 blocks of the stored volume center on each axis.');
  const camera={yaw:((yaw%360)+360)%360*Math.PI/180,pitch:pitch*Math.PI/180,distance,target:[0,0,0]},vector=cameraEye(camera);camera.target=local.map((value,axis)=>value-vector[axis]);return camera;
}
