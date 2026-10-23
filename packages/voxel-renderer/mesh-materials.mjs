import{validateFaceParameters}from'../resource-packs/face-materials.mjs';
const retained=new WeakMap();
// The immutable worker result is shared by GPU upload and picking; validate its material arrays once.
export function meshMaterialRows(mesh){let result=retained.get(mesh);if(result)return result;result={};let faces=0;
 for(const name of['opaque','transparent']){const geometry=mesh[name],source=mesh.materials?.[name];if(!(geometry instanceof ArrayBuffer)||geometry.byteLength%288||!(source instanceof ArrayBuffer))throw new Error('Mesh face materials are missing; reload the current mesh worker.');const count=geometry.byteLength/288;faces+=count;if(faces>250000)throw new Error('Mesh material face budget exceeded.');result[name]=validateFaceParameters(new Float32Array(source),count);}
 retained.set(mesh,result);return result;
}
