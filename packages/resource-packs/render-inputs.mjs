import data from'./client-render-data.json' with{type:'json'};
if(data.formatVersion!==2)throw new Error('Rebuild native rendering inputs in the compact state format.');
const flowBlocks=new Set(data.blocksFluidFlow),profiles=new Map();
export const tintRules=data.tints,biomeInputs=data.biomes;
export function blockRenderProfile(block){
  const definition=data.blocks[block.id];if(!definition)throw new Error(`Block ${block.id} needs native rendering metadata.`);
  const properties=block.properties??{};let key=0;for(let i=0;i<definition.properties.length;i++){const name=definition.properties[i];if(!Object.hasOwn(properties,name))throw new Error(`Block ${block.id} needs rendering property ${name}.`);const value=definition.values[i].indexOf(String(properties[name]));if(value<0)throw new Error(`Block ${block.id} has no captured native rendering state.`);key=key*definition.values[i].length+value;}const id=definition.states[key];
  if(id===undefined||Object.keys(properties).some(name=>!definition.properties.includes(name)))throw new Error(`Block ${block.id} has no captured native rendering state.`);
  const cacheKey=block.id+':'+id;let profile=profiles.get(cacheKey);if(!profile){const row=data.profiles[id];profile={fluid:row[0],height:Math.fround(row[1]),falling:row[2],solid:row[3],solidRender:row[4],faces:row.slice(5,11).map(index=>data.shapes[index]),renderShape:row[11],support:row[12],ice:definition.ice,overlay:definition.overlay,blocksFlow:flowBlocks.has(block.id)};profiles.set(cacheKey,profile);}return profile;
}
export const emptyRenderProfile=blockRenderProfile({id:'minecraft:air'});
export const nativeRenderIdentity={clientSha256:data.clientSha256,states:data.capturedStates,profiles:data.profiles.length,shapes:data.shapes.length};
export function blockRenderingInputs(id){const block=data.blocks[id];if(!block)return null;const rows=[...new Set(Object.values(block.states))].map(index=>data.profiles[index]);return{fluids:[...new Set(rows.map(row=>row[0]))].filter(kind=>kind!=='empty'),invisible:rows.every(row=>row[11]==='INVISIBLE'),tints:tintRules[id]??[]};}
