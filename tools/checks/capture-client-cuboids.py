"""Run fifteen small original-client cuboid fixtures without rebuilding Iris/registries."""
from pathlib import Path
import hashlib,json,os,subprocess,zipfile
from client_reference_inputs import ROOT,LOCAL,LOCK,prepare_client_inputs
inputs=prepare_client_inputs();client=inputs['client'];java=inputs['java'];records=inputs['records']
classes=LOCAL/'cuboid-reference-classes';classes.mkdir(exist_ok=True);empty=LOCAL/'empty-java-sources';empty.mkdir(exist_ok=True);temporary=LOCAL/'tmp';temporary.mkdir(exist_ok=True)
cp=os.pathsep.join([str(client),str(classes),*(row['path'] for row in records)])
env={**os.environ,'LD_LIBRARY_PATH':str(java/'lib')+':'+str(java/'lib/server')}
source=ROOT/'tools/checks/MinecraftCuboidGeometryCheck.java';request=ROOT/'tools/checks/fixtures/client-cuboids.json';output=LOCAL/'cuboid-reference.json'
with (LOCAL/'cuboid-reference-compile.log').open('w') as log:subprocess.run([str(java/'bin/javac'),'-implicit:none','-sourcepath',str(empty),'-classpath',cp,'-d',str(classes),str(source)],cwd=ROOT,env=env,stdout=log,stderr=log,check=True)
with (LOCAL/'cuboid-reference.log').open('w') as log:subprocess.run([str(java/'bin/java'),'-Xmx256m','-Djava.io.tmpdir='+str(temporary),'-classpath',cp,'MinecraftCuboidGeometryCheck',str(request),str(output)],cwd=ROOT,env=env,stdout=log,stderr=log,check=True)
record={'clientSha256':LOCK['clientSha256'],'versionMetadataSha1':LOCK['versionMetadataSha1'],'captureSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'requestSha256':hashlib.sha256(request.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'referenceLibraries':[{k:v for k,v in row.items() if k!='path'} for row in records]}
with zipfile.ZipFile(client) as z:record['nativeClassSha256']={n:hashlib.sha256(z.read(n+'.class')).hexdigest() for n in ['net/minecraft/client/resources/model/cuboid/CuboidModelElement$Deserializer','net/minecraft/client/resources/model/cuboid/CuboidRotation','net/minecraft/client/resources/model/cuboid/FaceBakery','net/minecraft/client/renderer/FaceInfo']}
(LOCAL/'cuboid-reference-record.json').write_text(json.dumps(record,indent=2)+'\n')
print('Captured fifteen selected cuboid parser/baker fixtures. No world/GPU or state sweep.')
