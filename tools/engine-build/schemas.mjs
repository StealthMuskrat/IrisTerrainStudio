import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeZip} from '../../packages/shared/zip.mjs';
import {resourcePath,ENTRY_LIMIT,FILE_LIMIT,ARCHIVE_LIMIT} from '../../packages/shared/paths.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1'),temporary=path.join(local,'tmp'),classes=path.join(local,'schema-classes'),output=path.join(root,'apps/web/engine/schema-generated');
const source=path.resolve(process.argv[2]||path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'));
await fs.mkdir(temporary,{recursive:true});await fs.mkdir(classes,{recursive:true});
const env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter)};
async function git(directory,args){return new Promise((resolve,reject)=>{const child=spawn('git',['-C',directory,...args],{cwd:root,stdio:['ignore','pipe','pipe']});let value='';child.stdout.on('data',chunk=>value+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(value.trim()):reject(new Error('Cannot verify native schema source')));});}
const lock=JSON.parse(await fs.readFile(path.join(root,'tools/native-reference/source-lock.json'),'utf8'));
for(const[name,commit]of[['Iris',lock.iris.commit],['VolmLib',lock.volmLib.commit]]){const directory=path.join(root,'.upstream',name);if(await git(directory,['rev-parse','HEAD'])!==commit||await git(directory,['diff','HEAD','--name-only']))throw new Error('Native schema source differs from its pinned commit: '+name);}
const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse)));
if(captures.some(capture=>capture.volmLibCandidate!==lock.volmLib.commit)||captures[1].irisCommit!==lock.iris.commit)throw new Error('Schema dependency captures identify different native sources');
for(const entry of captures.flatMap(capture=>capture.classpath))if(entry.sha256&&createHash('sha256').update(await fs.readFile(entry.path)).digest('hex')!==entry.sha256)throw new Error('A native schema dependency changed after capture');
const classpath=[...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter);
const engineManifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8')),inventoryBytes=await fs.readFile(path.join(root,'apps/web/engine/iris-generated/config-inventory.json'));
if(engineManifest.irisCommit!==lock.iris.commit||engineManifest.volmLibCandidate!==lock.volmLib.commit||createHash('sha256').update(inventoryBytes).digest('hex')!==engineManifest.configInventorySha256)throw new Error('Native schema field inventory differs from the pinned engine build');
const inventorySnapshot=path.join(classes,'config-inventory.json');await fs.writeFile(inventorySnapshot,inventoryBytes);
async function run(command,args,name,cwd=root){const filename=path.join(local,name),log=await fs.open(filename,'w');try{await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env,stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Native schema tool exited ${code}; see ${filename}`)));});}catch(error){console.error((await fs.readFile(filename,'utf8')).split('\n').slice(-20).join('\n'));throw error;}finally{await log.close();}}
const snapshot=await fs.mkdtemp(path.join(local,'schema-pack-'));
try{
  let fileCount=0,totalBytes=0;
  async function copy(directory,relative=''){
    for(const entry of await fs.readdir(directory,{withFileTypes:true})){
      if(entry.name==='.iris'||entry.name.startsWith('.iris-terrain-studio'))continue;if(entry.isSymbolicLink())throw new Error('Native schema input contains a symbolic link.');
      const name=path.join(relative,entry.name),target=path.join(snapshot,name),filename=path.join(directory,entry.name);
      resourcePath(name.split(path.sep).join('/'));
      if(entry.isDirectory()){await fs.mkdir(target,{recursive:true});await copy(filename,name);}else if(entry.isFile()){const stat=await fs.stat(filename);if(++fileCount>ENTRY_LIMIT||stat.size>FILE_LIMIT||(totalBytes+=stat.size)>ARCHIVE_LIMIT)throw new Error('Native schema snapshot exceeds the pack file or storage budget.');await fs.copyFile(filename,target);}else throw new Error('Native schema input contains a non-regular file.');
    }
  }
  await copy(source);await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
  const offline='.upstream/Iris/adapters/bukkit/nms/v26_3_R1/src/offline/java/art/arcane/iris/probe/',modded='.upstream/VolmLib/native/minecraft-common/src/main/java/art/arcane/volmlib/nativelib/minecraft26_2/modded/';
  console.log('Exporting pack-specific schemas using the unchanged native Iris SchemaBuilder. No tests or server are started.');
  await run(path.join(java,'bin/javac'),['-classpath',classpath,'-d',classes,'tools/engine-build/NativeSchemaExport.java',offline+'HeadlessNativeBootstrap.java',offline+'HeadlessNativeRegistries.java',...['NativeRegistryAccess','NativeBlockProperties','ModdedBlockState','NativeBlockResolver','ModdedBiome','ModdedItem','ModdedEntityType'].map(name=>modded+name+'.java')],'schema-compile.log');
  const jarEntries=new Map();
  async function classesToJar(directory,relative=''){for(const entry of await fs.readdir(directory,{withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Symbolic link in native core output');const filename=path.join(directory,entry.name),name=relative+entry.name;if(entry.isDirectory())await classesToJar(filename,name+'/');else if(entry.isFile())jarEntries.set(name,await fs.readFile(filename));}}
  const coreOutputs=captures[1].classpath.filter(entry=>entry.directory&&entry.path.startsWith(path.join(root,'.upstream/Iris/core/build')+path.sep));if(!coreOutputs.length)throw new Error('Captured native core classes are missing');
  for(const entry of coreOutputs)await classesToJar(entry.path);const nativeJar=path.join(local,'schema-native-core.jar'),nativeJarBytes=writeZip(jarEntries);await fs.writeFile(nativeJar,nativeJarBytes);
  const working=path.join(local,'schema-run');await fs.mkdir(working,{recursive:true});
  await run(path.join(java,'bin/java'),['-Xmx2g','-Djava.awt.headless=true','-Dvolmlib.noise.nativeBillow=false',`-Djava.io.tmpdir=${temporary}`,'-classpath',classes+path.delimiter+classpath,'art.arcane.iris.probe.NativeSchemaExport',snapshot,output,inventorySnapshot,nativeJar],'schema-export.log',working);
  const manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));manifest.volmLibCandidate=lock.volmLib.commit;manifest.nativeCoreJarSha256=createHash('sha256').update(nativeJarBytes).digest('hex');manifest.configInventorySha256=engineManifest.configInventorySha256;manifest.sourceServerJarSha256=captures[0].classpath.find(entry=>path.basename(entry.path)==='mappedServerJar.jar').sha256;
  const registryManifest=await fs.readFile(path.join(root,'apps/web/engine/registry-generated/manifest.json'));manifest.registryManifestSha256=createHash('sha256').update(registryManifest).digest('hex');
  for(const[name,record]of Object.entries(manifest.files)){const data=await fs.readFile(path.join(output,name));if(createHash('sha256').update(data).digest('hex')!==record.sha256)throw new Error('A native schema file differs from its export manifest');}
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Exported ${Object.keys(manifest.files).length} native schemas for ${Object.keys(manifest.packFiles).length} pack resources; ${manifest.warningCount} native warnings. Output: ${output}`);
}finally{await fs.rm(snapshot,{recursive:true,force:true});}
