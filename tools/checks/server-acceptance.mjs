// Real loopback HTTP and disposable pack files. No browser, terrain or world IO.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {createStudioServer} from '../../apps/server/index.mjs';
import {readZip,writeZip} from '../../packages/shared/zip.mjs';

const root=path.resolve('.'),directory=await fs.mkdtemp(path.join(root,'.local-tools/server-acceptance-'));
const token='server-acceptance-disposable-token-32',packs=path.join(directory,'packs');let server,requests=0;
const encode=text=>Buffer.from(text),query=(route,resource)=>'/api/'+route+'?pack=sample'+(resource?'&path='+encodeURIComponent(resource):'');
async function open(){({server}=await createStudioServer({root:packs,token}));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
async function close(){if(server){const value=server;server=null;await new Promise(resolve=>value.close(resolve));}}
async function request(route,{status=200,method='GET',data,headers={},auth=true}={}){
  requests++;const response=await fetch('http://127.0.0.1:'+server.address().port+route,{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},...(data===undefined?{}:{body:typeof data==='string'||ArrayBuffer.isView(data)?data:JSON.stringify(data)})});
  const bytes=Buffer.from(await response.arrayBuffer());assert.ok((Array.isArray(status)?status:[status]).includes(response.status),`${method} ${route}: HTTP ${response.status}: ${bytes}`);
  return{response,bytes,text:bytes.toString(),json:()=>JSON.parse(bytes)};
}
try{
  await assert.rejects(createStudioServer({root:packs,host:'0.0.0.0',token:'short'}),/at least 32/);await open();
  await request('/healthz',{auth:false});await request('/api/packs',{auth:false,status:401});
  await request('/api/packs',{headers:{Authorization:'Bearer incorrect'},status:401});
  await request('/api/packs',{headers:{Origin:'https://unrelated.invalid'},status:403});
  const badHost=await new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:server.address().port,path:'/api/packs',headers:{Host:'unrelated.invalid',Authorization:'Bearer '+token}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});assert.equal(badHost,403);
  const home=await request('/',{auth:false});assert.match(home.response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(home.response.headers.get('x-content-type-options'),'nosniff');
  await request('/api/packs',{method:'POST',data:{id:'sample'},status:201});await request('/api/packs',{method:'POST',data:{id:'sample'},status:409});
  for(const data of ['null','[]','{','{"id":"../escape"}'])await request('/api/packs',{method:'POST',data,status:400});
  for(const route of ['/api/resources','/api/resources?pack=../escape',query('resource','../outside.json'),query('resource','.iris-terrain-studio/backups/private.json'),query('resource','region/r.0.0.mca')])await request(route,{status:400});
  const name='generators/exact.json',source='{\r\n  "seed":9223372036854775807,"unknown":{"future":[1e2,true]},"style":"stone"\r\n}\r\n';
  const created=await request(query('resource',name),{method:'PUT',data:source,headers:{'If-None-Match':'*'}}),initial=created.json().etag;
  assert.equal((await request(query('resource',name))).text,source);assert.equal((await request(query('resource',name),{method:'HEAD'})).bytes.length,0);
  await request(query('resource',name),{headers:{'If-None-Match':initial},status:304});
  await request(query('resource',name),{method:'PUT',data:source,status:428});
  await request(query('resource',name),{method:'PUT',data:source,headers:{'If-Match':initial,'Content-Type':'text/plain'},status:415});
  for(const invalid of ['{"x":1,"x":2}','[]','{'])await request(query('resource',name),{method:'PUT',data:invalid,headers:{'If-Match':initial},status:422});
  await request(query('resource',name),{method:'PUT',data:Buffer.from([123,34,120,34,58,34,255,34,125]),headers:{'If-Match':initial},status:400});
  await request(query('resource','assets/file.bin'),{method:'PUT',data:'{}',headers:{'If-None-Match':'*'},status:400});
  const edits=await Promise.all(['first','second'].map(value=>request(query('resource',name),{method:'PUT',data:source.replace('stone',value),headers:{'If-Match':initial},status:[200,409]})));
  assert.deepEqual(edits.map(value=>value.response.status).sort(),[200,409]);
  const saved=await request(query('resource',name)),etag=saved.response.headers.get('etag');assert.notEqual(etag,initial);
  const backups=(await request(query('backups',name))).json().backups;assert.equal(backups.length,1);const backup=backups[0];assert.equal((await request(query('backup',name)+'&id='+backup.id)).text,source);
  await request(query('restore',name),{method:'POST',data:{id:backup.id,backupEtag:'"changed"'},headers:{'If-Match':etag},status:409});
  const restored=await request(query('restore',name),{method:'POST',data:{id:backup.id,backupEtag:backup.etag},headers:{'If-Match':etag}});assert.equal(restored.json().etag,initial);
  const operation=action=>request(query('operation'),{method:'POST',data:action});
  await operation({type:'duplicate',path:name,target:'generators/copy.json',etag:initial});
  await operation({type:'rename',path:'generators/copy.json',target:'generators/renamed.json',etag:initial});
  await operation({type:'delete',path:'generators/renamed.json',etag:initial});
  for(const route of ['operation','restore'])for(const data of ['null','[]'])await request(query(route,route==='restore'?name:undefined),{method:'POST',data,status:400});
  await fs.mkdir(path.join(packs,'sample','assets'));const unrelated=Buffer.from([0,255,13,10,3]);await fs.writeFile(path.join(packs,'sample','assets/preserved.bin'),unrelated);
  const exported=await readZip((await request(query('export'))).bytes);assert.equal(Buffer.from(exported.get(name)).toString(),source);assert.deepEqual(Buffer.from(exported.get('assets/preserved.bin')),unrelated);assert(![...exported.keys()].some(key=>key.startsWith('.iris-terrain-studio')));
  await request('/api/import?pack=roundtrip',{method:'POST',data:writeZip(exported),headers:{'Content-Type':'application/zip'},status:201});
  assert.equal((await request('/api/resource?pack=roundtrip&path='+name)).text,source);
  await request('/api/import?pack=broken',{method:'POST',data:encode('not a zip'),status:422});assert(!(await fs.readdir(packs)).includes('broken'));
  const external=path.join(directory,'outside.json');await fs.writeFile(external,'{"outside":true}');await fs.symlink(external,path.join(packs,'sample','linked.json'));
  assert.equal((await request(query('resources'))).json().resources.find(row=>row.path==='linked.json').readOnly,true);
  await request(query('resource','linked.json'),{status:403});await request(query('export'),{status:422});await fs.unlink(path.join(packs,'sample','linked.json'));assert.equal(await fs.readFile(external,'utf8'),'{"outside":true}');
  await close();await open();assert.equal((await request(query('resource',name))).text,source);assert.equal((await request(query('resource',name))).response.headers.get('etag'),initial);
  const report={recordedAt:new Date().toISOString(),result:'pass',requests:requests+1,realHttp:true,disposablePack:true,authentication:true,hostAndOriginRefusals:true,inputErrorsAre4xx:true,invalidUtf8Refused:true,exactLongAndUnknownFields:true,concurrentSaveOneWinner:true,backupRestoreAndOperations:true,binaryZipRoundtrip:true,symlinkBoundary:true,restartPersistence:true,browserVerified:false,webGpuVerified:false,dockerVerified:false,fullTerrainParity:false,serverSha256:createHash('sha256').update(await fs.readFile('apps/server/index.mjs')).digest('hex')};
  await fs.writeFile('.local-tools/server-acceptance-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await close();await fs.rm(directory,{recursive:true,force:true});}
