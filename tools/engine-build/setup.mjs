import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readZip} from '../../packages/shared/zip.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=path.join(root,'.local-tools');
const lock=JSON.parse(await fs.readFile(new URL('toolchain.lock.json',import.meta.url))),source=JSON.parse(await fs.readFile(new URL('../native-reference/source-lock.json',import.meta.url)));
if(process.platform!=='linux'||process.arch!=='x64')throw new Error('Automatic development-tool setup supports Linux x64. Set IRIS_JAVA_HOME, IRIS_GRADLE_BIN and IRIS_MAVEN_BIN for your platform.');
await fs.mkdir(directory,{recursive:true});await fs.mkdir(path.join(directory,'tmp'),{recursive:true});
const exists=async filename=>!!await fs.stat(filename).catch(()=>null);
async function run(command,args,cwd=root){await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited ${code}.`)));});}
for(const[name,tool]of Object.entries(lock).filter(([,item])=>item&&typeof item==='object')){
  const archive=path.join(directory,tool.archive),algorithm=tool.sha256?'sha256':'sha512',expected=tool[algorithm];
  if(!await exists(archive)){console.log(`Downloading pinned ${name} development tool.`);const partial=archive+'.part';await run('curl',['--fail','--location','--silent','--show-error','--retry','2','--max-time','300',tool.url,'--output',partial]);await fs.rename(partial,archive);}
  if(createHash(algorithm).update(await fs.readFile(archive)).digest('hex')!==expected)throw new Error(`The ${name} archive differs from its pinned checksum.`);
  if(await exists(path.join(directory,tool.directory)))continue;
  if(tool.archive.endsWith('.zip')){
    const entries=await readZip(await fs.readFile(archive),{maxBytes:512*1024*1024});
    for(const[relative,data]of entries){if(!relative.startsWith(tool.directory+'/'))throw new Error('Unexpected tool archive layout.');const target=path.join(directory,...relative.split('/'));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data);}
    await fs.chmod(path.join(directory,tool.directory,'bin/gradle'),0o755);
  }else await run('tar',['-xzf',archive,'--directory',directory]);
}
for(const[name,identity]of[['Iris',source.iris],['VolmLib',source.volmLib]]){
  const target=path.join(root,'.upstream',name);
  if(await exists(path.join(target,'.git')))continue;
  if(await exists(target))throw new Error(`The existing ${name} directory has no Git identity. Move it aside before installing the pinned checkout.`);
  await fs.mkdir(target,{recursive:true});await run('git',['init','--quiet',target]);
  await run('git',['-C',target,'fetch','--quiet','--depth=1',`https://github.com/VolmitSoftware/${name}.git`,identity.commit]);
  await run('git',['-C',target,'checkout','--quiet','--detach',identity.commit]);
}
console.log('Pinned development tools and source checkouts are ready. Run npm run engine:build.');
