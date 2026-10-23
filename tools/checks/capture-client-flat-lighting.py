from pathlib import Path
import json,subprocess,os,hashlib,zipfile
root=Path(__file__).resolve().parents[2];local=root/'.local-tools';java=local/'jdk-25.0.4.1+1';classes=local/'client-flat-lighting-check-classes';classes.mkdir(exist_ok=True)
client=local/'minecraft-26.3-client.jar';lock=json.loads((root/'tools/assets/minecraft-client.lock.json').read_text());assert hashlib.sha256(client.read_bytes()).hexdigest()==lock['clientSha256']
captures=[json.loads((local/n).read_text()) for n in ['registry-inputs.json','iris-inputs.json']];cp=os.pathsep.join([str(client),str(classes),*dict.fromkeys(e['path'] for c in captures for e in c['classpath'])]);env={**os.environ,'LD_LIBRARY_PATH':str(java/'lib')+':'+str(java/'lib/server')};source=root/'tools/checks/MinecraftFlatLightingCheck.java'
with (local/'client-flat-lighting-compile.log').open('w') as log:subprocess.run([str(java/'bin/javac'),'-implicit:none','-sourcepath',str(local/'empty-java-sources'),'-classpath',cp,'-d',str(classes),str(source)],cwd=root,env=env,stdout=log,stderr=log,check=True)
with (local/'client-flat-lighting-reference.log').open('w') as log:subprocess.run([str(java/'bin/java'),'-Xmx256m','-Djava.io.tmpdir='+str(local/'tmp'),'-classpath',cp,'MinecraftFlatLightingCheck',str(client),str(local/'client-flat-lighting-reference.json')],cwd=root,env=env,stdout=log,stderr=log,check=True)
record={'clientSha256':lock['clientSha256'],'captureSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
with zipfile.ZipFile(client) as z:record['nativeClassSha256']={n:hashlib.sha256(z.read(n+'.class')).hexdigest() for n in ['net/minecraft/world/level/CardinalLighting','net/minecraft/client/renderer/block/BlockModelLighter','com/mojang/blaze3d/vertex/QuadInstance','net/minecraft/util/ARGB','net/minecraft/client/resources/model/cuboid/FaceBakery','net/minecraft/client/multiplayer/ClientLevel']}
(local/'client-flat-lighting-reference-record.json').write_text(json.dumps(record))
print('Captured 28 flat model colors, four direction decisions and three tiny native biome averages. No terrain/state sweep.')
