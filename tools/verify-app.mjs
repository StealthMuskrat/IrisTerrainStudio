// Comprehensive local checks over bounded fixtures. Browser/GPU/Docker remain manual gates.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
function option(name,fallback){const at=args.indexOf(name);if(at<0)return fallback;if(!args[at+1]||args[at+1].startsWith('--'))throw Error(`Supply a value for ${name}.`);return args[at+1];}
const suite=option('--suite','all');if(!['all','application','native'].includes(suite))throw Error('Choose --suite all, application or native.');
const only=option('--only','').split(',').filter(Boolean),prepared=args.includes('--reuse-prepared');
const output=path.resolve(root,option('--output','.local-tools/verification-'+new Date().toISOString().replace(/[:.]/g,'-')));
const f8thful=option('--f8thful',process.env.IRIS_VERIFY_F8THFUL),checks=[],results=[];
await fs.mkdir(output,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={formatVersion:1,startedAt:new Date().toISOString(),suite,node:process.version,checks:results,browserVerified:false,webGpuVerified:false,dockerVerified:false,fullTerrainParity:false,projectFinished:false};
for(const name of ['manifest.json']){try{report.engine=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated',name)));}catch{report.engine=null;}}
async function save(){await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n');}
function add(id,command,options={}){checks.push({id,command,...options});}
const node=(id,...parameters)=>add(id,[process.execPath,'--experimental-vm-modules',...parameters]);
if(suite!=='native'){
  node('unit-tests','--test',...(await fs.readdir(path.join(root,'tests'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name));
  node('project-structure','tools/check-project.mjs');
  node('source-syntax','tools/checks/source-syntax.mjs');
  add('python-reference-tests',['python3','-m','unittest','discover','-s','tools/native-reference','-p','test_*.py']);
  node('development-package','tools/build-app.mjs','--require-engine','--include-local-assets');
}
if(!only.length&&suite!=='application'&&!prepared){
  node('small-native-registry-fixture','tools/checks/session-registry-fixture.mjs');
  for(const name of ['face-materials','flat-lighting','fluid-lighting','mipmaps'])add('client-reference-'+name,['python3','tools/checks/capture-client-'+name+'.py']);
}
const extras=new Set(['editor-invariants.mjs','texture-pipeline-checks.mjs','noise-persistence-stale-save.mjs','server-acceptance.mjs','engine-link.mjs','native-json-link.mjs','native-schema-link.mjs','native-noise-checksum.mjs']);
for(const name of (await fs.readdir(path.join(root,'tools/checks'))).sort()){
  if(!name.endsWith('-smoke.mjs')&&!extras.has(name))continue;
  const file='tools/checks/'+name,source=await fs.readFile(path.join(root,file),'utf8'),native=source.includes('spawn(')||source.includes('spawnSync(');
  if(suite==='application'&&native||suite==='native'&&!native)continue;
  const parameters=[];if(name==='f8thful-assets-smoke.mjs'){if(f8thful)parameters.push(path.resolve(f8thful));else{add(name,null,{blocked:'Supply --f8thful /path/to/authorized-original.zip for the original default-asset check.'});continue;}}
  node(name,file,...parameters);
  if(name==='native-placement-smoke.mjs')node(name+'--roots',file,'--roots');
  if(name==='native-chunk-area-smoke.mjs')node(name+'--overworld',file,'--overworld');
}
add('release-prerequisites',[process.execPath,'tools/check-project.mjs','--release'],{gate:true});
// This UI regression also inspects the small graph produced by the native map check.
if(suite==='all'&&!only.length){const at=checks.findIndex(check=>check.id==='hydrology-network-ui-smoke.mjs');if(at>=0)checks.push(...checks.splice(at,1));}
const selected=checks.filter(check=>!only.length||only.includes(check.id));
for(const id of only)if(!selected.some(check=>check.id===id))throw Error('Unknown check for selected suite: '+id);
for(const check of selected){
  const started=Date.now(),entry={id:check.id,command:check.command,startedAt:new Date(started).toISOString()};results.push(entry);
  if(check.blocked){Object.assign(entry,{status:'blocked',reason:check.blocked,seconds:0});await save();console.log('BLOCKED '+check.id);continue;}
  const filename=check.id.replace(/[^a-zA-Z0-9_.-]/g,'_')+'.log',file=await fs.open(path.join(output,filename),'w');let timedOut=false;
  try{
    const child=spawn(check.command[0],check.command.slice(1),{cwd:root,env:process.env,stdio:['ignore',file.fd,file.fd],detached:process.platform!=='win32'});
    const stop=()=>{try{process.platform==='win32'?child.kill('SIGTERM'):process.kill(-child.pid,'SIGTERM');}catch{}};
    let escalation;const timeout=setTimeout(()=>{timedOut=true;stop();escalation=setTimeout(()=>{try{process.platform==='win32'?child.kill('SIGKILL'):process.kill(-child.pid,'SIGKILL');}catch{}},5000);},600_000);
    const interrupt=()=>{stop();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{entry.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}
    finally{clearTimeout(timeout);clearTimeout(escalation);process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);}
    entry.status=timedOut?'timeout':entry.exitCode===0?'pass':check.gate&&entry.exitCode===1?'blocked':'fail';
  }catch(error){entry.status='fail';entry.error=error.message;}finally{await file.close();}
  Object.assign(entry,{seconds:(Date.now()-started)/1000,log:filename});
  const source=check.command.find(value=>value.startsWith('tools/')&&value.endsWith('.mjs'));if(source)entry.checkSha256=digest(await fs.readFile(path.join(root,source)));
  await save();console.log(entry.status.toUpperCase()+' '+entry.id+' ('+entry.seconds.toFixed(2)+'s)');
}
report.finishedAt=new Date().toISOString();report.totals=Object.fromEntries(['pass','fail','blocked','timeout'].map(status=>[status,results.filter(row=>row.status===status).length]));
await save();console.log(JSON.stringify({output,totals:report.totals,browserVerified:false,webGpuVerified:false,projectFinished:false}));
process.exitCode=report.totals.fail||report.totals.timeout?1:report.totals.blocked?2:0;
