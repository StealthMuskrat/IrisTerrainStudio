import {assetDigest} from '/packages/resource-packs/bundle.mjs';
export async function loadDefaultAssets(api){
  const metadata=await api.request('rendering-defaults');if(!metadata.configured){if(metadata.reason)throw new Error(metadata.reason);return[];}
  if(!Array.isArray(metadata.packs)||metadata.packs.length!==2)throw new Error('Invalid configured rendering asset catalog.');
  const entries=[];
  for(const [index,record]of metadata.packs.entries()){
    const role=['baseline','default'][index];if(record.role!==role||!Number.isSafeInteger(record.bytes)||record.bytes<22||record.bytes>64*1024*1024||!/^[a-f0-9]{64}$/.test(record.sha256)||typeof record.name!=='string')throw new Error('Invalid configured rendering asset record.');
    const response=await api.request('rendering-default',{query:{role},raw:true});
    const declared=Number(response.headers.get('Content-Length'));if(declared!==record.bytes)throw new Error('Configured rendering asset size differs from its catalog.');
    const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const{value,done}=await reader.read();if(done)break;if((size+=value.byteLength)>record.bytes)throw new Error('Configured rendering asset exceeds its catalog size.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
    if(size!==record.bytes)throw new Error('Configured rendering asset is truncated.');const blob=new Blob(parts,{type:'application/zip'});if(await assetDigest(await blob.arrayBuffer())!==record.sha256)throw new Error('Configured rendering asset hash differs from its catalog.');
    entries.push({blob,role,name:record.name,id:record.sha256});
  }
  return entries;
}
