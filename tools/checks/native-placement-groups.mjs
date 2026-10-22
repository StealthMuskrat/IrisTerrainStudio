import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse)));
const classes=path.join(local,'placement-group-classes');await fs.mkdir(classes,{recursive:true});
const classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter);
const env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
async function run(binary,args){await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(binary+' exited '+code)));});}
const source='.upstream/VolmLib/native/minecraft-common/src/main/java/art/arcane/volmlib/nativelib/minecraft26_2/modded/NativeBlockProperties.java';
await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativePlacementGroupCheck.java','tools/engine-build/NativePlacementGroups.java',source,'.upstream/Iris/adapters/bukkit/nms/v26_3_R1/src/offline/java/art/arcane/iris/probe/HeadlessNativeBootstrap.java']);
await run('java',['-Xmx1g','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativePlacementGroupCheck',source,path.join(local,'native-placement-groups-results.json')]);
