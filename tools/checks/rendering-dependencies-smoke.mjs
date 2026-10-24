// Two block models plus one inherited parent. No registry, terrain, GPU or production assets.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { MinecraftResourcePack, ResourcePackStack } from '../../packages/resource-packs/pack.mjs';
import { inspectRenderingDependencies } from '../../packages/resource-packs/dependencies.mjs';
import { BUNDLE_MANIFEST, writeRenderingBundle, assetDigest } from '../../packages/resource-packs/bundle.mjs';
import { readZip, writeZip } from '../../packages/shared/zip.mjs';

const encode=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
const meta={pack:{description:'Synthetic local fixture; no target-format qualification',pack_format:1}};
const definition={variants:{'':[{model:'minecraft:block/a',weight:1},{model:'minecraft:block/b',weight:2}]},multipart:[{when:{enabled:'true'},apply:{model:'minecraft:block/a'}}],unknown:{preserve:['bytes',7]}};
const baseEntries=new Map([
  ['pack.mcmeta',encode(meta)],['LICENSE.txt',encode('Synthetic fixture notice')],['LICENSES/MIT.txt',encode('Synthetic directory notice')],
  ['assets/minecraft/blockstates/stone.json',encode(JSON.stringify(definition,null,3)+'\n')],
  ['assets/minecraft/models/block/parent.json',encode({textures:{all:'#side'},elements:[{from:[0,0,0],to:[16,16,16],faces:{north:{texture:'#all'}}}],unknown:'preserve'})],
  ['assets/minecraft/models/block/a.json',encode({parent:'minecraft:block/parent',textures:{side:'minecraft:block/a'}})],
  ['assets/minecraft/models/block/b.json',encode({textures:{all:'minecraft:block/b'},elements:[{faces:{up:{texture:'#all'}}}]})],
  ['assets/minecraft/textures/block/a.png',png],['assets/minecraft/textures/block/a.png.mcmeta',encode({animation:{frames:[0],frametime:2},unknown:42})],
  ['assets/minecraft/textures/block/b.png',png],['assets/minecraft/models/block/unrelated.json',encode({})],['assets/unused/textures/unrelated.png',png]
]);
const overrideEntries=new Map([['pack.mcmeta',encode(meta)],['notices/CREDITS.md',encode('Synthetic override credit')],['assets/minecraft/textures/block/a.png',new Uint8Array(png)]]);
const base=await MinecraftResourcePack.open(writeZip(baseEntries),'Fixture base'),override=await MinecraftResourcePack.open(writeZip(overrideEntries),'Fixture override'),stack=new ResourcePackStack([base,override]);
const capture=await inspectRenderingDependencies(stack,[{id:'minecraft:stone'},{id:'minecraft:stone',properties:{enabled:'true'}},{id:'minecraft:air'}]);
assert.deepEqual(capture.report.errors,[]);assert.equal(capture.report.counts.blockTypes,1);assert.equal(capture.report.counts.models,3);assert.equal(capture.report.counts.textures,2);
assert.equal(capture.report.blocks[0].candidates.length,3);assert.deepEqual(capture.report.blocks[0].candidates[0].parents,['minecraft:block/parent']);assert.deepEqual(capture.report.blocks[0].candidates[0].textures,['minecraft:block/a']);
assert.equal(capture.report.files.find(file=>file.path==='assets/minecraft/textures/block/a.png').source,1);
assert.equal(capture.report.files.some(file=>file.path.endsWith('.png.mcmeta')),false);
assert(capture.files.has('sources/0/LICENSE.txt'));assert(capture.files.has('sources/0/LICENSES/MIT.txt'));assert(capture.files.has('sources/1/notices/CREDITS.md'));assert(![...capture.files.keys()].some(path=>path.includes('unrelated')));
assert.deepEqual(capture.files.get('assets/minecraft/blockstates/stone.json'),baseEntries.get('assets/minecraft/blockstates/stone.json'));
const bundle=await writeRenderingBundle(capture),loaded=await MinecraftResourcePack.open(bundle.bytes,'Fixture bundle');
assert(loaded.metadata.studioRenderingBundle);assert.equal(loaded.metadata.pack,undefined);
assert.equal(bundle.manifest.qualification.clientRenderingParity,false);
assert.deepEqual(new ResourcePackStack([loaded]).resolveModel('minecraft:block/a'),stack.resolveModel('minecraft:block/a'));
assert.deepEqual((await inspectRenderingDependencies(new ResourcePackStack([loaded]),['minecraft:stone'])).report.errors,[]);
assert.equal(bundle.manifest.blocks[0].candidates.length,3);
const parsed=await readZip(bundle.bytes),tampered=new Map(parsed);
// Same length corruption reaches the digest check, rather than only the byte-count check.
const corrupt=png.slice();corrupt[corrupt.length-1]^=1;tampered.set('assets/minecraft/textures/block/a.png',corrupt);
await assert.rejects(MinecraftResourcePack.open(writeZip(tampered)),/hash mismatch/);
const unlisted=new Map(parsed);unlisted.set('assets/minecraft/textures/extra.png',png);await assert.rejects(MinecraftResourcePack.open(writeZip(unlisted)),/unlisted/);
const duplicate=new Map(parsed),manifest=JSON.parse(new TextDecoder().decode(duplicate.get(BUNDLE_MANIFEST)));manifest.files.push(manifest.files[0]);duplicate.set(BUNDLE_MANIFEST,encode(manifest));await assert.rejects(MinecraftResourcePack.open(writeZip(duplicate)),/Invalid rendering-bundle file/);
const exported=writeRenderingBundle(capture),original=capture.files.get('assets/minecraft/blockstates/stone.json');original[0]^=1;const snapshot=await exported;original[0]^=1;
assert.equal(snapshot.manifest.files.find(file=>file.path.endsWith('blockstates/stone.json')).sha256,await assetDigest(original));
let calls=0;await assert.rejects(writeRenderingBundle(capture,{isCurrent:()=>++calls<3}),{name:'AbortError'});
await assert.rejects(inspectRenderingDependencies(stack,['minecraft:stone'],{isCurrent:()=>false}),{name:'AbortError'});
const missingEntries=new Map(baseEntries);missingEntries.delete('assets/minecraft/textures/block/a.png');const missing=await inspectRenderingDependencies(new ResourcePackStack([await MinecraftResourcePack.open(writeZip(missingEntries))]),['minecraft:stone']);assert(missing.report.errors.some(error=>error.message.includes('Missing required asset')));await assert.rejects(writeRenderingBundle(missing),/Resolve dependency errors/);
const cycleEntries=new Map(baseEntries);cycleEntries.set('assets/minecraft/models/block/parent.json',encode({parent:'minecraft:block/a'}));const cycle=await inspectRenderingDependencies(new ResourcePackStack([await MinecraftResourcePack.open(writeZip(cycleEntries))]),['minecraft:stone']);assert(cycle.report.errors.some(error=>error.message.includes('cycle')));
const customEntries=new Map(baseEntries);customEntries.set('assets/minecraft/models/block/a.json',encode({loader:'example:custom'}));const customStack=new ResourcePackStack([await MinecraftResourcePack.open(writeZip(customEntries))]),custom=await inspectRenderingDependencies(customStack,['minecraft:stone']);assert(custom.report.errors.some(error=>error.message.includes('custom loader')));assert.throws(()=>customStack.resolveModel('minecraft:block/a'),/custom loader/);
const overlayEntries=new Map(baseEntries);overlayEntries.set('pack.mcmeta',encode({...meta,overlays:{entries:[]}}));const overlayStack=new ResourcePackStack([await MinecraftResourcePack.open(writeZip(overlayEntries))]);assert.deepEqual(overlayStack.bytes('assets/minecraft/textures/block/a.png'),png);assert.deepEqual((await inspectRenderingDependencies(overlayStack,['minecraft:stone'])).report.errors,[]);
await stack.dispose();await assert.rejects(inspectRenderingDependencies(stack,['minecraft:stone']),{name:'AbortError'});
// Exercise the actual modal owner with controlled nodes. Closing an in-flight export must not
// let its eventual error or finally block change controls belonging to a subsequently opened dialog.
const source=await fs.readFile(new URL('../../apps/web/main.mjs',import.meta.url),'utf8'),askSource=source.slice(source.indexOf('function ask('),source.indexOf('\nfunction dirty()'));
const nodes=new Map(),node=()=>({open:false,style:{},replaceChildren(){},close(){this.open=false;},showModal(){this.open=true;},querySelector(){return null;}});
const context={setTimeout:()=>{},$:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},closeDialog:null};vm.createContext(context);vm.runInContext('let dialogSequence=0;'+askSource,context);
let rejectExport;const deferred=new Promise((resolve,reject)=>{rejectExport=reject;});const first=context.ask('first',[],{onSubmit:()=>deferred});
const submission=nodes.get('modal-form').onsubmit({preventDefault(){}});context.closeDialog(null);await first;
const second=context.ask('second',[]);nodes.get('modal-submit').disabled=true;rejectExport(new Error('Stale export'));await submission;
assert.equal(nodes.get('modal-title').textContent,'second');assert.equal(nodes.get('modal-error').hidden,true);assert.equal(nodes.get('modal-submit').disabled,true);context.closeDialog(null);await second;
const evidence={date:'2026-10-21',fixture:{blockTypes:1,candidateApplications:3,modelFiles:3,textureFiles:2,texturePixels:1,sourcePacks:2},counts:capture.report.counts,bundleBytes:bundle.bytes.length,bundleSha256:await assetDigest(bundle.bytes),checks:['all candidate and inherited references','pack precedence and same-source metadata ownership','unknown JSON bytes and notices preserved','unrelated resources omitted','bundle reload and model resolution','hash tamper, unlisted and duplicate file refusal','snapshot ownership and stale export refusal','missing assets, model cycles and custom loader diagnostics','empty native overlay list and disposal','closed pending modal cannot alter its successor'],complete:false,clientRenderingParity:false,limits:'Synthetic Node module and controlled modal-node checks only. No terrain/native build, registry sweep, real browser DOM/GPU, supplied assets or GitHub workflow.'};
if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
