import{validateFaceParameters}from'../resource-packs/face-materials.mjs';
const retained=new WeakMap();
// The immutable worker result is shared by GPU upload and picking; validate its material arrays once.
export function meshMaterialRows(mesh){let result=retained.get(mesh);if(result)return result;result={};let faces=0;
 for(const name of['opaque','transparent']){const geometry=mesh[name],source=mesh.materials?.[name];if(!(geometry instanceof ArrayBuffer)||geometry.byteLength%288||!(source instanceof ArrayBuffer))throw new Error('Mesh face materials are missing; reload the current mesh worker.');const count=geometry.byteLength/288;faces+=count;if(faces>250000)throw new Error('Mesh material face budget exceeded.');result[name]=validateFaceParameters(new Float32Array(source),count);}
 retained.set(mesh,result);return result;
}

const retainedTiling=new WeakMap();
export function meshTilingRows(mesh){
 if(retainedTiling.has(mesh))return retainedTiling.get(mesh);const materials=meshMaterialRows(mesh);let result=null;
 if(mesh.tiling){result={};for(const name of['opaque','transparent']){const source=mesh.tiling[name];if(!(source instanceof ArrayBuffer))throw new Error('Repeated texture rectangles are missing.');const rows=new Float32Array(source);if(rows.length!==materials[name].length)throw new Error('Repeated texture rectangle coverage differs from geometry.');for(let at=0;at<rows.length;at+=4){const rect=rows.subarray(at,at+4),repeat=materials[name][at+3]===2;if(repeat){if(!rect.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||rect[2]<=rect[0]||rect[3]<=rect[1])throw new Error('Repeated texture rectangle is invalid.');}else if(rect.some(v=>v!==0))throw new Error('Unmarked face has repeated texture metadata.');}result[name]=rows;}}
 else for(const rows of Object.values(materials))for(let at=3;at<rows.length;at+=4)if(rows[at]===2)throw new Error('Repeated texture metadata is missing.');
 retainedTiling.set(mesh,result);return result;
}
