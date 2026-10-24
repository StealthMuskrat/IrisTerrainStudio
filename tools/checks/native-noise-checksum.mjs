// One original native assertion, using already captured pinned class inputs.
// No Gradle task, registry export, state sweep, historical rerun or browser claim.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=path.join(local,'jdk-25.0.4.1+1'),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const lock=JSON.parse(await fs.readFile(path.join(root,'tools/native-reference/source-lock.json'))),inputsBytes=await fs.readFile(path.join(local,'iris-inputs.json')),inputs=JSON.parse(inputsBytes);
if(inputs.irisCommit!==lock.iris.commit||inputs.volmLibCandidate!==lock.volmLib.commit)throw Error('Recapture matching pinned class inputs before checking the native checksum.');
async function execute(command,args,logName){
  const file=await fs.open(path.join(local,logName),'w');
  try{await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,env:{...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)},stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native checksum tool failed; see .local-tools/'+logName)));});}finally{await file.close();}
}
async function git(directory,args){return new Promise((resolve,reject)=>{const child=spawn('git',['-C',directory,...args],{cwd:root,stdio:['ignore','pipe','pipe']});let value='';child.stdout.on('data',data=>value+=data);child.on('error',reject);child.on('exit',code=>code===0?resolve(value.trim()):reject(Error('Cannot verify native source')));});}
for(const [name,commit]of [['Iris',lock.iris.commit],['VolmLib',lock.volmLib.commit]]){const directory=path.join(root,'.upstream',name);if(await git(directory,['rev-parse','HEAD'])!==commit||await git(directory,['diff','HEAD','--name-only']))throw Error('Native checksum source differs: '+name);}
const jars=[];
for(const entry of inputs.classpath)if(!entry.directory){const bytes=await fs.readFile(entry.path),sha256=digest(bytes);if(entry.sha256&&sha256!==entry.sha256)throw Error('Captured native classpath artifact changed: '+path.basename(entry.path));jars.push({name:path.basename(entry.path),bytes:bytes.length,sha256});}
const junit=path.join(local,'gradle-cache/caches/modules-2/files-2.1/junit/junit/4.13.2/8ac9e16d933b6fb43bc7f576336b8f4d7eb5ba12/junit-4.13.2.jar'),hamcrest=path.join(local,'gradle-cache/caches/modules-2/files-2.1/org.hamcrest/hamcrest-core/1.3/42a25dc3219429f0e5d060061f71acb49bf010a0/hamcrest-core-1.3.jar');
for(const [filename,sha1]of [[junit,'8ac9e16d933b6fb43bc7f576336b8f4d7eb5ba12'],[hamcrest,'42a25dc3219429f0e5d060061f71acb49bf010a0']]){const bytes=await fs.readFile(filename);if(createHash('sha1').update(bytes).digest('hex')!==sha1)throw Error('JUnit input identity differs.');jars.push({name:path.basename(filename),bytes:bytes.length,sha256:digest(bytes)});}
const classes=path.join(local,'native-noise-checksum-classes'),empty=path.join(local,'empty-java-sources');await fs.mkdir(classes,{recursive:true});await fs.mkdir(empty,{recursive:true});
const fixture='.upstream/Iris/core/src/test/java/art/arcane/iris/generation/noise/NoiseSeedCohesionTest.java',runner='tools/checks/NativeNoiseChecksumCheck.java',classpath=[...inputs.classpath.map(entry=>entry.path),junit,hamcrest].join(path.delimiter);
await execute(path.join(java,'bin/javac'),['-implicit:none','-sourcepath',empty,'-classpath',classpath,'-d',classes,fixture,runner],'native-noise-checksum-compile.log');
const output=path.join(local,'native-noise-checksum-native.json');
await execute(path.join(java,'bin/java'),['-Xmx1g','--add-modules','jdk.incubator.vector','-Djava.awt.headless=true','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classes+path.delimiter+classpath,'NativeNoiseChecksumCheck',output],'native-noise-checksum.log');
const result=JSON.parse(await fs.readFile(output));if(result.runCount!==1)throw Error('The selected native assertion did not execute exactly once.');
const classHashes={};for(const entry of inputs.classpath)if(entry.directory)for(const name of ['art/arcane/iris/generation/noise/NoiseStyle.class','art/arcane/volmlib/util/noise/CNG.class','art/arcane/volmlib/util/math/RNG.class'])try{classHashes[name]=digest(await fs.readFile(path.join(entry.path,name)));}catch(error){if(error.code!=='ENOENT')throw error;}
const report={date:'2026-10-23',scope:'single-original-native-noise-checksum',irisCommit:inputs.irisCommit,volmLibCandidate:inputs.volmLibCandidate,buildProfile:inputs.buildProfile??'full',fixtureSha256:digest(await fs.readFile(path.join(root,fixture))),runnerSha256:digest(await fs.readFile(path.join(root,runner))),classHashes,jars,result,expectedAssertionUnchanged:true,registryExport:false,statePairChecks:0,browserVerified:false,releaseReferenceQualified:false};
await fs.writeFile(path.join(local,'native-noise-checksum-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({irisCommit:report.irisCommit,volmLibCandidate:report.volmLibCandidate,result,releaseReferenceQualified:false}));
if(!result.successful)process.exitCode=1;
