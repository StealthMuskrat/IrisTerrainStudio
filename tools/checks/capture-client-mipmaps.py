from pathlib import Path
import json,subprocess,os,hashlib,zipfile,sys
root=Path(__file__).resolve().parents[2];local=root/'.local-tools';java=local/'jdk-25.0.4.1+1';classes=local/'client-mipmap-check-classes';classes.mkdir(exist_ok=True);captures=[json.loads((local/n).read_text()) for n in ['registry-inputs.json','iris-inputs.json']];client=local/'minecraft-26.3-client.jar';cp=os.pathsep.join([str(client),str(classes),*dict.fromkeys(e['path'] for c in captures for e in c['classpath'])]);env={**os.environ,'LD_LIBRARY_PATH':str(java/'lib')+':'+str(java/'lib/server')}
lock=json.loads((root/'tools/assets/minecraft-client.lock.json').read_text());assert hashlib.sha256(client.read_bytes()).hexdigest()==lock['clientSha256']
images=[]
for strategy in ['mean','cutout','strict_cutout','dark_cutout','auto']:
 for item in ([False,True] if strategy=='cutout' else [False]):
  pixels=[]
  for y in range(8):
   for x in range(8):pixels.extend([(x*31+y*7)&255,(y*29+x*3)&255,(x*43+y*11)&255,[0,64,128,255][(x+3*y)%4]])
  images.append({'name':'authored:'+('item/' if item else 'block/')+strategy,'width':8,'height':8,'levels':3,'strategy':strategy,'bias':-.03125 if strategy=='strict_cutout' else 0,'pixels':pixels})
# Fully opaque and all-transparent controls, plus a rectangular animation sheet.
for kind,alpha in [('opaque',255),('empty',0)]:images.append({'name':'authored:block/'+kind,'width':4,'height':4,'levels':2,'strategy':'auto','bias':0,'pixels':[c for i in range(16) for c in [(i*71)&255,(i*23)&255,(i*97)&255,alpha]]})
images.append({'name':'authored:block/sheet','width':8,'height':16,'levels':2,'strategy':'cutout','bias':.0625,'pixels':[c for i in range(128) for c in [(i*17)&255,(i*71)&255,(i*29)&255,0 if i%3==0 else 255]]})
request={'images':images,'metadata':[{}, {'mipmap_strategy':'mean','alpha_cutoff_bias':.125,'blur':True,'clamp':False},{'mipmap_strategy':'cutout'}, {'mipmap_strategy':'strict_cutout'}, {'mipmap_strategy':'dark_cutout'},{'mipmap_strategy':'wrong'},{'blur':'yes'},{'alpha_cutoff_bias':'bad'}]}
(local/'client-mipmap-request.json').write_text(json.dumps(request))
with (local/'client-mipmap-reference-compile.log').open('w') as log:subprocess.run([str(java/'bin/javac'),'-implicit:none','-sourcepath',str(local/'empty-java-sources'),'-classpath',cp,'-d',str(classes),'tools/checks/MinecraftMipmapCheck.java'],cwd=root,env=env,stdout=log,stderr=log,check=True)
with (local/'client-mipmap-reference.log').open('w') as log:subprocess.run([str(java/'bin/java'),'-Xmx256m','-Djava.io.tmpdir='+str(local/'tmp'),'-classpath',cp,'MinecraftMipmapCheck',str(client),str(local/'client-mipmap-request.json'),str(local/'client-mipmap-reference.json')],cwd=root,env=env,stdout=log,stderr=log,check=True)
record={'clientSha256':hashlib.sha256(client.read_bytes()).hexdigest(),'requestSha256':hashlib.sha256((local/'client-mipmap-request.json').read_bytes()).hexdigest(),'captureSourceSha256':hashlib.sha256((root/'tools/checks/MinecraftMipmapCheck.java').read_bytes()).hexdigest()}
with zipfile.ZipFile(client) as z:record['nativeClassSha256']={name:hashlib.sha256(z.read(name+'.class')).hexdigest() for name in ['net/minecraft/client/renderer/texture/MipmapGenerator','com/mojang/blaze3d/platform/TextureUtil','net/minecraft/util/ARGB']}
(local/'client-mipmap-reference-record.json').write_text(json.dumps(record))
if '--write-inputs' in sys.argv:
 tables=json.loads((local/'client-mipmap-reference.json').read_text())['tables'];identity={'formatVersion':1,'minecraftVersion':'26.3',**{k:record[k] for k in ['clientSha256','captureSourceSha256','nativeClassSha256']},**tables};(root/'packages/resource-packs/client-mipmap-data.json').write_text(json.dumps(identity,separators=(',',':'))+'\n')
print('Captured nine tiny native mip chains and eight metadata decisions; no native image/GPU allocation.')
