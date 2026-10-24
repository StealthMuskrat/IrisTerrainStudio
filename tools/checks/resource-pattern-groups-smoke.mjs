// A small set of actual Java predicate answers, bounded parser checks and one pack stack.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resourcePattern,resourceFilter} from '../../packages/resource-packs/resource-filter.mjs';
import {MinecraftResourcePack,ResourcePackStack} from '../../packages/resource-packs/pack.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),jdk=path.join(local,'jdk-25.0.4.1+1'),temporary=await fs.mkdtemp(path.join(local,'pattern-groups-'));
const rows=[
  {pattern:'^textures/(block|item)/.*\\.png$',values:['textures/block/stone.png','textures/item/apple.png','textures/entity/pig.png','xtextures/block/stone.png']},
  {pattern:'(?:oak|birch)_(?:log|planks)',values:['block/oak_log','birch_planks.json','spruce_log','oak_log_extra']},
  {pattern:'^(ab){2,3}$',values:['ab','abab','ababab','abababab','xabab']},
  {pattern:'^(?:ab|c){2}$',values:['abab','abc','cab','cc','c','abcc']},
  {pattern:'^[a-z]{2,4}/[0-9]{1,}\\.json$',values:['ab/1.json','abcd/123.json','a/1.json','abcde/12.json','ab/a.json']},
  {pattern:'(ab|c)+?d',values:['xabcd','cccd','abd','ab','d']},
  {pattern:'^a{0,2}?b{2,}$',values:['bb','abb','aabbb','aaabb','ab']},
  {pattern:'^(a?)*b$',values:['b','ab','aaab','aaac']},
  {pattern:'^(?:|ab){2,3}$',values:['','ab','abab','ababab','abababab']},
  {pattern:'\\A(?:foo|bar)\\z',values:['foo','bar','foobar','xfoo']},
  {pattern:'\\A(?:foo|bar)\\Z',values:['foo','bar','foobar','xbar']},
  {pattern:'^(?:[a-z0-9_-]+/){1,3}[^/]+$',values:['a/b','ab/c/d','a/b/c/d','a/b/c/d/e','ab']},
  {pattern:'(ab){0}',values:['','ab','anything']},
  {pattern:'^a{1024}$',values:['a'.repeat(1024),'a'.repeat(1023)]},
  {pattern:'^(?:a|aa)*b$',values:['a'.repeat(128)+'b','a'.repeat(128)+'c']},
  {pattern:'^[]a]+$',values:['a','aa','b']},
  {pattern:'^[--a]+$',values:['a','b','/','_','9']},
  {pattern:'^[\\d_]+$',values:['_','123_','a','a1']},
  {pattern:'^[^a-c]+$',values:['d_z','abc','xyz']}

];
try{
  const inputs=JSON.parse(await fs.readFile(path.join(local,'iris-inputs.json'))),classpath=inputs.classpath.map(row=>row.path).join(path.delimiter),request=path.join(temporary,'input.json'),output=path.join(temporary,'native.json');await fs.writeFile(request,JSON.stringify(rows));
  const env={...process.env,LD_LIBRARY_PATH:[path.join(jdk,'lib'),path.join(jdk,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const log=await fs.open(path.join(temporary,binary+'.log'),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(jdk,'bin',binary),args,{cwd:root,env,stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Original Java resource-pattern reference exited '+code)));});}finally{await log.close();}}
  await run('javac',['-classpath',classpath,'-d',temporary,'tools/checks/NativeResourcePatternCheck.java']);await run('java',['-classpath',temporary+path.delimiter+classpath,'NativeResourcePatternCheck',request,output]);const expected=JSON.parse(await fs.readFile(output));
  const actual=rows.map(row=>{const predicate=resourcePattern(row.pattern);return row.values.map(value=>predicate(value));});assert.deepEqual(actual,expected);
  for(const pattern of['a{2}+','(?=a)a','(a)\\1','(?i)a','[a-z&&[^b]]','(a','[a-\\d]','[^]'])assert.throws(()=>resourcePattern(pattern));
  for(const pattern of['a{2147483647}','a{3,2}','(a{1024}){1024}','('.repeat(17)+'a'+')'.repeat(17)])assert.throws(()=>resourcePattern(pattern),/budget|bounds/);
  assert.throws(()=>resourcePattern('a')('a'.repeat(1025)),/bounded/);
  const predicate=resourceFilter({block:[{namespace:'^(?:minecraft|demo)$',path:'^textures/(?:block|item)/[a-z_]{1,32}\\.png$'}]});assert.equal(predicate('demo','textures/block/stone.png'),true);assert.equal(predicate('other','textures/block/stone.png'),false);assert.equal(predicate('demo','textures/gui/widgets.png'),false);
  const encode=value=>new TextEncoder().encode(value),metadata={pack:{min_format:97,max_format:97}},base=new MinecraftResourcePack('base',new Map([['assets/demo/textures/block/stone.png',encode('base block')],['assets/demo/textures/gui/widgets.png',encode('base gui')]]),metadata,'authored-base'),override=new MinecraftResourcePack('override',new Map([['assets/demo/textures/block/stone.png',encode('own block')]]),{...metadata,filter:{block:[{namespace:'^(demo|minecraft)$',path:'^textures/(block|item)/[a-z_]{1,32}\\.png$'}]}},'authored-override');
  const stack=new ResourcePackStack([base,override]);try{assert.equal(new TextDecoder().decode(stack.bytes('assets/demo/textures/block/stone.png')),'own block');assert.equal(stack.bytes('assets/demo/textures/block/dirt.png'),null);assert.equal(new TextDecoder().decode(stack.bytes('assets/demo/textures/gui/widgets.png')),'base gui');}finally{await stack.dispose();}
  const workspaceSha256={};for(const file of['packages/resource-packs/resource-filter.mjs','tools/checks/NativeResourcePatternCheck.java','tools/checks/resource-pattern-groups-smoke.mjs'])workspaceSha256[file]=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
  const result={workspaceSha256,jdk:'25.0.4.1+1',date:'2026-10-23',result:'pass',scope:'bounded Java resource-filter groups and repetitions',patterns:rows.map((row,i)=>({pattern:row.pattern,values:row.values,matches:actual[i]})),nativePredicateComparisons:rows.reduce((n,row)=>n+row.values.length,0),actualJavaPatternAsPredicate:true,capturingAndNoncapturingGroups:true,nativeAsciiCharacterClassAndRangeParsing:true,nestedAlternationAndCountedRepeats:true,reluctantBooleanFind:true,emptyGroupCycles:true,absoluteAnchors:true,longInputRefusal:true,compileDepthAndStateBudgets:true,unsupportedAssertionsBackreferencesAndPossessiveExplicit:true,actualPackOwnAssetsBeforeFilterAndUnblockedFallback:true,sourceSha256:createHash('sha256').update(await fs.readFile(path.join(root,'packages/resource-packs/resource-filter.mjs'))).digest('hex'),browserVerified:false,webGpuVerified:false,clientRenderingParity:false,projectFinished:false};
  await fs.writeFile(path.join(local,'resource-pattern-groups-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'pass',patterns:rows.length,nativePredicateComparisons:result.nativePredicateComparisons,actualResourcePackStack:true}));
}finally{await fs.rm(temporary,{recursive:true,force:true});}
