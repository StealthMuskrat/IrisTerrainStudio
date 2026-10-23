"""Capture four native seed hashes and sixteen selected client biome lookups; no world/state sweep."""
import hashlib,json,os,subprocess,zipfile
from client_reference_inputs import ROOT,LOCAL,LOCK,prepare_client_inputs
inputs=prepare_client_inputs();client=inputs['client'];java=inputs['java'];records=inputs['records'];classes=LOCAL/'biome-reference-classes';classes.mkdir(exist_ok=True);empty=LOCAL/'empty-java-sources';empty.mkdir(exist_ok=True);temporary=LOCAL/'tmp';temporary.mkdir(exist_ok=True)
cp=os.pathsep.join([str(client),str(classes),*(r['path'] for r in records)]);env={**os.environ,'LD_LIBRARY_PATH':str(java/'lib')+':'+str(java/'lib/server')}
source=ROOT/'tools/checks/MinecraftBiomeSamplingCheck.java';request=ROOT/'tools/checks/fixtures/client-biomes.json';output=LOCAL/'client-biome-reference.json'
with (LOCAL/'client-biome-compile.log').open('w') as log:subprocess.run([str(java/'bin/javac'),'-implicit:none','-sourcepath',str(empty),'-classpath',cp,'-d',str(classes),str(source)],env=env,cwd=ROOT,stdout=log,stderr=log,check=True)
with (LOCAL/'client-biome-reference.log').open('w') as log:subprocess.run([str(java/'bin/java'),'-Xmx256m','-Djava.io.tmpdir='+str(temporary),'-classpath',cp,'MinecraftBiomeSamplingCheck',str(request),str(output)],env=env,cwd=ROOT,stdout=log,stderr=log,check=True)
record={'clientSha256':LOCK['clientSha256'],'captureSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'requestSha256':hashlib.sha256(request.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'libraries':[{k:v for k,v in r.items() if k!='path'} for r in records]}
with zipfile.ZipFile(client) as z:record['nativeClassSha256']={n:hashlib.sha256(z.read(n+'.class')).hexdigest() for n in ['net/minecraft/world/level/biome/BiomeManager','net/minecraft/util/LinearCongruentialGenerator','net/minecraft/world/level/chunk/ChunkAccess']}
# Reviewed source identity, independent of this client-method capture. No writer executes here.
record['offlineWriterProjectionSource']={
    'irisCommit':'c3a9449a026078c44a87c9776766f54a67779392',
    'path':'adapters/bukkit/nms/v26_3_R1/src/offline/java/art/arcane/iris/probe/NativeRegionTerrainWriter.java',
    'sourceSha256':'3ca1efd20e1668d3957dffaf2414a31217e0771e3385f996972d8f4654ea3f72',
    'gitBlob':'6382c9de58e73c20612e2d0ae78536c272645501',
    'reference':'reviewed source; projection not executed through writer; production equivalence unqualified',
}
(LOCAL/'client-biome-reference-record.json').write_text(json.dumps(record,indent=2)+'\n');print('Captured four native seed hashes and sixteen client biome coordinates, with no world or registry export.')
