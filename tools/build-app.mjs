import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectRuntimeInstallation} from '../apps/server/runtime-status.mjs';
import {unresolvedPrerequisites} from './check-project.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildApplication({repository=root,destination=path.join(repository,'dist'),requireEngine=false,release=false}={}){
  const lock=JSON.parse(await fs.readFile(path.join(repository,'upstream.lock.json'),'utf8'));
  if(release){const blockers=unresolvedPrerequisites(lock);if(blockers.length)throw new Error('Release build blocked: '+blockers.join('; '));}
  const local=path.join(repository,'.local-tools');await fs.mkdir(local,{recursive:true});
  const lockFile=path.join(local,'app-build.lock');let buildLock;
  try{buildLock=await fs.open(lockFile,'wx');}catch(error){if(error.code==='EEXIST')throw new Error('Another application build owns .local-tools/app-build.lock. Finish it before rebuilding.');throw error;}
  let working;
  let moved=false,published=false;
  try{
    await buildLock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
    working=await fs.mkdtemp(path.join(local,'app-build-'));const stage=path.join(working,'next'),previous=path.join(working,'previous');
    await fs.mkdir(stage);
    for(const name of ['apps','packages','docs','upstream.lock.json'])await fs.cp(path.join(repository,name),path.join(stage,name),{recursive:true,force:false,errorOnExist:true});
    const sourcePackage=JSON.parse(await fs.readFile(path.join(repository,'package.json'),'utf8'));
    await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:sourcePackage.name,version:sourcePackage.version,private:true,type:'module',description:sourcePackage.description,engines:sourcePackage.engines,scripts:{start:'node --env-file-if-exists=.env apps/server/index.mjs'}},null,2)+'\n');
    const engine=await inspectRuntimeInstallation(stage,{distribution:true});
    if((requireEngine||release)&&(!engine.available||!engine.registry.available))throw new Error('Engine build blocked: '+[!engine.available&&engine.reason,!engine.registry.available&&engine.registry.reason].filter(Boolean).join('; '));
    // Recorded readiness alone cannot qualify an unfinished terrain pipeline.
    if(release)throw new Error('Release build blocked: complete terrain and rendering implementation and qualification remain unfinished.');
    const report={formatVersion:1,name:'Iris Terrain Studio',builtAt:new Date().toISOString(),node:process.version,qualifiedTerrainEngine:false,engine};
    await fs.writeFile(path.join(stage,'BUILD.json'),JSON.stringify(report,null,2)+'\n');
    await fs.writeFile(path.join(stage,'README.md'),'# Iris Terrain Studio development application\n\nRequires Node 24. Run `npm start`, then open http://127.0.0.1:4783. Set `IRIS_PACKS_DIR` to choose the pack directory. The server uses loopback by default. Set `IRIS_STUDIO_TOKEN` to at least 32 characters before using a non-loopback `HOST`.\n\nPack editing is available independently of the browser generation modules. `BUILD.json` records the installed module integrity checks. This is a development application; full terrain and rendering qualification remains unfinished. See `docs/STATUS.md`, `docs/THIRD_PARTY.md` and the runtime status panel for scope and limitations.\n\nDevelopment source and build tools: https://github.com/StealthMuskrat/IrisTerrainStudio\n');
    let existing;try{existing=await fs.lstat(destination);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(existing){if(!existing.isDirectory()||existing.isSymbolicLink())throw new Error('Application destination must be a regular directory.');await fs.rename(destination,previous);moved=true;}
    try{await fs.rename(stage,destination);published=true;}
    catch(error){if(moved){await fs.rename(previous,destination);moved=false;}throw error;}
    return report;
  }finally{
    // Retain the previous directory if recovery itself failed.
    try{if(working&&(!moved||published))await fs.rm(working,{recursive:true,force:true});}
    finally{await buildLock.close();await fs.unlink(lockFile);}
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const report=await buildApplication({requireEngine:process.argv.includes('--require-engine'),release:process.argv.includes('--release')});
    console.log('Application published to dist/. Start with: npm --prefix dist start');
    console.log(report.engine.available?'Verified development engine files included. Full terrain qualification remains incomplete.':'Pack editor packaged. Browser generation modules are unavailable; see dist/BUILD.json.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
