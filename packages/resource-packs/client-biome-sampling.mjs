// Minecraft 26.3 BiomeManager: SHA-256 seed obfuscation and original eight-corner jitter.
const I=value=>BigInt.asIntN(64,value),A=6364136223846793005n,C=1442695040888963407n;
export const biomeSampleError=(message,code)=>Object.assign(new Error(message),{code});
export function biomeSamplingMode(value='stored'){if(!['stored','native-writer-client'].includes(value))throw new Error('Unknown biome sampling mode.');return value;}
function long(value){if(typeof value!=='string'||!/^(-?[1-9]\d*|0)$/.test(value)||value.length>20)throw new Error('Biome sampling requires the exact native signed-64 seed.');const seed=BigInt(value);if(I(seed)!==seed)throw new Error('Biome seed exceeds the native signed-64 range.');return seed;}
export async function obfuscateBiomeSeed(value){const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigInt64(0,long(value),true);const digest=await crypto.subtle.digest('SHA-256',bytes);return new DataView(digest).getBigInt64(0,true).toString();}
const next=(value,salt)=>I(value*I(value*A+C)+salt),fiddle=value=>(Number(value>>24n&1023n)/1024-.5)*.9;
function nearestQuart(seed,position){
  const relative=position.map(v=>(v-2)|0),parent=relative.map(v=>v>>2),fraction=relative.map(v=>(v&3)/4);let best=0,distance=Infinity;
  for(let i=0;i<8;i++){const odd=[(i&4)!==0,(i&2)!==0,(i&1)!==0],corner=parent.map((v,a)=>v+Number(odd[a]));let random=seed;for(let j=0;j<6;j++)random=next(random,BigInt(corner[j%3]));const x=fraction[0]-Number(odd[0])+fiddle(random);random=next(random,seed);const y=fraction[1]-Number(odd[1])+fiddle(random);random=next(random,seed);const z=fraction[2]-Number(odd[2])+fiddle(random),d=z*z+y*y+x*x;if(distance>d){distance=d;best=i;}}
  return parent.map((v,a)=>v+Number((best&[4,2,1][a])!==0));
}
export function clientBiomeQuart(seed,position){const value=long(seed);if(!Array.isArray(position)||position.length!==3||!position.every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647))throw new Error('Client biome sampling requires three signed-32 block coordinates.');return nearestQuart(value,position);}
// Explicit native offline writer projection: original TerrainInput must be section aligned.
// Stored per-block biomes are sampled at local x/y/z << 2. This is not a live-world capture.
export function nativeWriterBiomeAtQuart(volume,quart,storedBiomeAt){
  const{origin,width,height,depth}=volume,x=quart[0]*4,z=quart[2]*4,y=Math.max(origin[1],Math.min(origin[1]+height-4,quart[1]*4));
  if(x<origin[0]||x>=origin[0]+width||z<origin[2]||z>=origin[2]+depth)throw biomeSampleError('Client biome lookup needs quart-biome halo outside the stored volume. Use an interior section or stored biome sampling.','missing-biome-halo');
  const biome=storedBiomeAt(x,y,z);if(!biome)throw biomeSampleError('Native writer projection has no physical biome at a required quart sample.','missing-biome-sample');return biome;
}
export function validateWriterBiomeVolume(volume){const{origin,width,height,depth}=volume;if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isSafeInteger)||origin[0]%16||origin[2]%16||origin[1]%16||origin[1]<-2032||origin[1]+height>2032||![width,depth,height].every(v=>Number.isSafeInteger(v)&&v>=16&&v%16===0))throw new Error('Native writer biome sampling requires a section-aligned stored volume within the native writer height range.');}
export function createClientBiomeSampler(volume,storedBiomeAt,input,{sampleLimit=65536,cacheLimit=32768}={}){
  validateWriterBiomeVolume(volume);const seed=long(input.seedHash),cache=new Map();let samples=0;
  if(input.kind!=='native-offline-writer-client'||!Number.isSafeInteger(sampleLimit)||sampleLimit<1||sampleLimit>65536||!Number.isSafeInteger(cacheLimit)||cacheLimit<1||cacheLimit>32768)throw new Error('Invalid client biome sampling profile or work budget.');
  return(x,y,z)=>{const position=[x,y,z];if(!position.every(v=>Number.isInteger(v)&&v>=-2147483648&&v<=2147483647))throw new Error('Client biome lookup exceeds native block coordinates.');const key=position.join(',');if(cache.has(key)){const row=cache.get(key);cache.delete(key);cache.set(key,row);if(row.error)throw biomeSampleError(row.error,row.code);return row.biome;}
    if(++samples>sampleLimit){const error=new Error('Client biome lookup exceeds its work budget. Reduce the visible area or blend radius.');error.name='BiomeSamplingBudgetError';throw error;}
    let row;try{row={biome:nativeWriterBiomeAtQuart(volume,nearestQuart(seed,position),storedBiomeAt)};}catch(error){row={error:error.message,code:error.code};}if(cache.size>=cacheLimit)cache.delete(cache.keys().next().value);cache.set(key,row);if(row.error)throw biomeSampleError(row.error,row.code);return row.biome;
  };
}
