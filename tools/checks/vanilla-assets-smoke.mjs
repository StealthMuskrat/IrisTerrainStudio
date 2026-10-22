// Check local preparation and three dependency roots; no state sweep or image/GPU qualification.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {MinecraftResourcePack,ResourcePackStack} from '../../packages/resource-packs/pack.mjs';
import {inspectRenderingDependencies} from '../../packages/resource-packs/dependencies.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const filename=process.argv[2]||path.join(root,'.local-assets/vanilla-26.3.zip');
const pack=await MinecraftResourcePack.open(new Uint8Array(await fs.readFile(filename)),'Verified local vanilla 26.3');
const stack=new ResourcePackStack([pack]);
try{
  assert.deepEqual(pack.metadata.pack.min_format,[97,1]);
  assert.deepEqual(pack.metadata.pack.max_format,[97,1]);
  const source=pack.json('studio-vanilla-source.json');
  assert.equal(source.source.clientSha1,'e877b6a07acd633fb3bb475002175cec036e7b87');
  const capture=await inspectRenderingDependencies(stack,['minecraft:stone','minecraft:grass_block','minecraft:water']);
  assert.deepEqual(capture.report.errors,[]);
  assert.equal(stack.json('assets/minecraft/models/block/stone.json').parent,'minecraft:block/cube_all');
  assert.ok(stack.bytes('assets/minecraft/textures/block/stone.png'));
  assert.throws(()=>stack.blockModels({id:'minecraft:stone',properties:{}}),/exact model selection/);
  const temporary=await fs.mkdtemp(path.join(root,'.local-tools/vanilla-assets-'));
  try{
    const invalid=path.join(temporary,'wrong.jar'),output=path.join(temporary,'previous.zip');
    await fs.writeFile(invalid,'wrong client');await fs.writeFile(output,'retained');
    const child=spawnSync('python3',['tools/assets/prepare-vanilla.py','--client',invalid,'--output',output],{cwd:root,encoding:'utf8'});
    assert.equal(child.status,1);assert.match(child.stderr,/Client identity differs/);
    assert.equal(await fs.readFile(output,'utf8'),'retained');
  }finally{await fs.rm(temporary,{recursive:true,force:true});}
  await fs.writeFile(path.join(root,'.local-tools/vanilla-assets-check.json'),JSON.stringify({
    result:'pass',minecraftVersion:'26.3',types:3,dependencyFiles:capture.files.size,
    identityMismatchPreservesExistingOutput:true,weightedSelectionStillRefused:true,
    browserVerified:false,webGpuVerified:false,clientRenderingVerified:false},null,2)+'\n');
  console.log('Local vanilla pack loads; three dependency roots resolve. Wrong client preserves output. Client rendering remains unqualified.');
}finally{await stack.dispose();}
