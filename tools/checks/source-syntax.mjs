import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const files=[];
async function walk(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const name=path.join(directory,entry.name);if(entry.isDirectory())await walk(name);else if(entry.isFile()&&/\.(?:mjs|js)$/.test(name))files.push(name);}}
for(const directory of ['apps','packages','tools'])await walk(directory);
for(const filename of files.sort()){
  const result=spawnSync(process.execPath,['--check',filename],{encoding:'utf8'});
  if(result.status!==0)throw Error(filename+'\n'+result.stderr);
}
console.log(JSON.stringify({result:'pass',javascriptFilesParsed:files.length,scope:'Syntax only; no browser, GPU or native execution.'}));
