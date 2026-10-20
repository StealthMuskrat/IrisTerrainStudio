"""Package genuine Minecraft data-generator reports for browser registry lookup."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

root=Path(__file__).resolve().parents[2]
inputs=json.loads((root/'.local-tools/registry-inputs.json').read_text())
reports=root/'.reference-output/minecraft-26.3-registry/reports'
output=root/'apps/web/engine/registry-generated'
output.mkdir(parents=True,exist_ok=True)
server=next(Path(entry['path']) for entry in inputs['classpath'] if Path(entry['path']).name=='mappedServerJar.jar')
with zipfile.ZipFile(server) as archive:
    version=json.loads(archive.read('version.json'))
if version['id']!='26.3' or not version['stable']:
    raise ValueError('Registry source does not identify stable Minecraft 26.3')
blocks=json.loads((reports/'blocks.json').read_text())
ids=set()
for name,block in blocks.items():
    states=block['states']
    if sum(bool(state.get('default')) for state in states)!=1:
        raise ValueError('Registry has no unique default state for '+name)
    for state in states:
        if state['id'] in ids:
            raise ValueError('Duplicate native state id')
        ids.add(state['id'])
        properties=state.get('properties',{})
        if properties.keys()!=block.get('properties',{}).keys():
            raise ValueError('Incomplete state properties for '+name)
        for key,value in properties.items():
            if value not in block['properties'][key]:
                raise ValueError('State value outside native property domain')
files={}
for name in ('blocks.json','registries.json'):
    source=(reports/name).read_bytes()
    encoded=(json.dumps(json.loads(source),ensure_ascii=False,separators=(',',':'))+'\n').encode()
    (output/name).write_bytes(encoded)
    files[name]={'sha256':hashlib.sha256(encoded).hexdigest(),'sourceReportSha256':hashlib.sha256(source).hexdigest(),'bytes':len(encoded)}
predicates_path=reports.parent/'native-predicates.json'
if predicates_path.exists():
    encoded=predicates_path.read_bytes()
    predicates=json.loads(encoded)
    if len(predicates['stateFlags'])!=len(ids) or len(predicates['stateTypes'])!=len(ids) or len(predicates['blockTypes'])!=len(blocks):
        raise ValueError('Native predicate coverage differs from the block-state report')
    (output/'native-predicates.json').write_bytes(encoded)
    files['native-predicates.json']={'sha256':hashlib.sha256(encoded).hexdigest(),'bytes':len(encoded)}
platform_path=reports.parent/'native-registries.json'
if not platform_path.exists():
    raise ValueError('Native platform registry export is missing')
encoded=platform_path.read_bytes()
platform=json.loads(encoded)
if platform['scope']!='pinned-native-platform-registries' or platform['minecraft']!='26.3' or set(platform['keys']['blocks'])!=set(blocks) or set(platform['blockPropertyGroups'])!=set(blocks):
    raise ValueError('Native platform registry coverage differs from the reports')
for key in ('biomes','structures','enchantments'):
    if not platform['keys'][key] or len(set(platform['keys'][key]))!=len(platform['keys'][key]):
        raise ValueError('Native dynamic registry is missing or duplicated: '+key)
(output/'native-registries.json').write_bytes(encoded)
files['native-registries.json']={'sha256':hashlib.sha256(encoded).hexdigest(),'bytes':len(encoded)}
if set(platform['entityCategories'])!=set(platform['keys']['entities']) or not set(platform['leafBlockTypes']).issubset(blocks):
    raise ValueError('Native platform type metadata is incomplete')
# A compact bridge format, derived only from the checked native reports. Seeds
# and pack configuration never pass through this transformation.
if predicates.get('faceNames')!=['north','east','south','west','up','down'] or len(predicates.get('faceSupport',[]))!=len(ids) or any(type(value) is not int or value<0 or value>63 for value in predicates['faceSupport']):
    raise ValueError('Native full-face support coverage is missing or invalid')
types=predicates['blockTypes']
wire_types=[]
wire_states=[None]*len(ids)
for type_id,name in enumerate(types):
    block=blocks[name]
    order=predicates['propertyOrder'][name]
    default=next(state['id'] for state in block['states'] if state.get('default'))
    wire_types.append({'name':name,'defaultState':default,'order':order,'leaf':name in platform['leafBlockTypes']})
    for state in block['states']:
        properties=state.get('properties',{})
        canonical=name+('['+','.join(key+'='+properties[key] for key in order)+']' if order else '')
        wire_states[state['id']]={'id':state['id'],'type':type_id,'key':canonical,'flags':predicates['stateFlags'][state['id']],'faces':predicates['faceSupport'][state['id']],'values':[properties[key] for key in order]}
wire={'formatVersion':2,'scope':'native-browser-registry-input','minecraft':'26.3','flagNames':predicates['flagNames'],'faceNames':predicates['faceNames'],'types':wire_types,'states':wire_states,'placementBits':predicates['placementBits'],'toDeepSlate':predicates['toDeepSlate'],'toNormalOre':predicates['toNormalOre'],'keys':platform['keys'],'propertyGroups':platform['propertyGroups'],'blockPropertyGroups':platform['blockPropertyGroups'],'entityCategories':platform['entityCategories']}
encoded=(json.dumps(wire,separators=(',',':'))+'\n').encode()
(output/'browser-registry.json').write_bytes(encoded)
files['browser-registry.json']={'sha256':hashlib.sha256(encoded).hexdigest(),'bytes':len(encoded)}
manifest={'formatVersion':1,'scope':'minecraft-development-registry-export','minecraft':version,'source':'Pinned VolmLib v26_3_R1 Paper development bundle; Minecraft data-generator --reports','volmLibCandidate':inputs['volmLibCandidate'],'releaseMatchVerified':False,'registryParityVerified':False,'sourceServerJarSha256':hashlib.sha256(server.read_bytes()).hexdigest(),'blocks':len(blocks),'states':len(ids),'files':files,'limitations':['Occlusion shapes, rendering layers, fluid geometry and biome tint data are not included in this export.','Native report state ids are build-specific; full block identifiers and properties remain authoritative.']}
(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Packaged {len(blocks)} native blocks and {len(ids)} block states for Minecraft {version["id"]}.')
