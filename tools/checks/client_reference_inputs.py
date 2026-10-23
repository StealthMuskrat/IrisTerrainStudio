"""Checksummed local inputs shared by small original-client reference captures."""
from pathlib import Path
import concurrent.futures, hashlib, json, os, subprocess, zipfile
ROOT=Path(__file__).resolve().parents[2]
LOCAL=ROOT/'.local-tools'
LOCAL.mkdir(exist_ok=True)
LOCK=json.loads((ROOT/'tools/assets/minecraft-client.lock.json').read_text())
def download(url,path,algorithm,digest,size=None):
    if not path.exists():
        temporary=path.with_suffix(path.suffix+'.part')
        subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','300',url,'--output',str(temporary)],check=True)
        if hashlib.new(algorithm,temporary.read_bytes()).hexdigest()!=digest or size is not None and temporary.stat().st_size!=size:raise ValueError('Downloaded input identity differs: '+path.name)
        temporary.replace(path)
    if hashlib.new(algorithm,path.read_bytes()).hexdigest()!=digest or size is not None and path.stat().st_size!=size:raise ValueError('Local input identity differs: '+path.name)
    return path
def prepare_client_inputs():
    client=download(LOCK['clientUrl'],LOCAL/'minecraft-26.3-client.jar','sha256',LOCK['clientSha256'],LOCK['clientBytes'])
    metadata=download(LOCK['versionMetadataUrl'],LOCAL/'minecraft-26.3.json','sha1',LOCK['versionMetadataSha1'])
    tool=json.loads((ROOT/'tools/engine-build/toolchain.lock.json').read_text())['jdk']
    java=LOCAL/tool['directory']
    if not java.exists():
        archive=download(tool['url'],LOCAL/tool['archive'],'sha256',tool['sha256'])
        subprocess.run(['tar','-xzf',str(archive),'-C',str(LOCAL)],check=True)
    # Only reference dependencies; no all-state input exporter, Gradle or native world starts.
    prefixes=['com.google.code.gson:gson:','com.google.guava:guava:','com.google.guava:failureaccess:','com.mojang:datafixerupper:','it.unimi.dsi:fastutil:','org.joml:joml:','org.slf4j:slf4j-api:','org.apache.logging.log4j:log4j-api:','org.apache.logging.log4j:log4j-core:','org.apache.logging.log4j:log4j-slf4j2-impl:','org.apache.commons:commons-lang3:','commons-io:commons-io:','com.mojang:brigadier:','com.mojang:authlib:','com.mojang:logging:','org.jspecify:jspecify:','io.netty:netty-buffer:','io.netty:netty-common:','io.netty:netty-codec-base:']
    libraries=[row for row in json.loads(metadata.read_text())['libraries'] if any(row['name'].startswith(p) for p in prefixes)]
    (LOCAL/'client-libraries').mkdir(exist_ok=True)
    def library(row):
        a=row['downloads']['artifact'];p=download(a['url'],LOCAL/'client-libraries'/Path(a['path']).name,'sha1',a['sha1'],a['size']);return {'name':row['name'],'path':str(p),'sha1':a['sha1'],'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(library,libraries))
    return {'client':client,'java':java,'records':records}
