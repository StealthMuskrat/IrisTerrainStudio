import {crc32} from '../shared/zip.mjs';
// Raw PNG bands for native IrisImage. No canvas, color conversion, resampling or premultiplication.
// Filter reconstruction: https://www.w3.org/TR/2025/REC-png-3-20250624/#9Filters
export async function decodeNativePng(input){
  if(!(input instanceof Uint8Array)||input.length<33||input.length>8*1024*1024)throw new Error('PNG exceeds its 8 MiB input budget or is truncated.');
  const bytes=input,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),signature=[137,80,78,71,13,10,26,10];
  if(signature.some((value,index)=>bytes[index]!==value))throw new Error('Native image source must be PNG.');
  let offset=8,width,height,channels,bitDepth,ended=false,dataStarted=false,dataEnded=false,compressedBytes=0;const pieces=[];
  while(offset<bytes.length){
    if(offset+12>bytes.length)throw new Error('Truncated PNG chunk.');const length=view.getUint32(offset);if(length>bytes.length-offset-12)throw new Error('Truncated PNG chunk payload.');
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),start=offset+8,end=start+length;
    if(!/^[A-Za-z]{4}$/.test(type)||type[2]!==type[2].toUpperCase())throw new Error('Invalid PNG chunk type.');
    if(crc32(bytes.subarray(offset+4,end))!==view.getUint32(end))throw new Error(`PNG checksum failed: ${type}`);
    if(width===undefined&&type!=='IHDR')throw new Error('PNG must start with IHDR.');
    if(type==='IHDR'){
      if(width!==undefined||length!==13)throw new Error('Invalid PNG header.');width=view.getUint32(start);height=view.getUint32(start+4);bitDepth=bytes[start+8];const color=bytes[start+9];channels=color===0?1:color===2?3:color===6?4:0;
      if(width<1||height<1||width>16384||height>16384||width*height>4194304)throw new Error('PNG exceeds the worker limit of 4,194,304 pixels.');
      if(!channels||!(bitDepth===8||(color===0&&bitDepth===16)))throw new Error('Native worker PNG supports grayscale 8/16-bit and RGB/RGBA 8-bit; indexed and other modes are unavailable.');
      if(bytes[start+10]!==0||bytes[start+11]!==0||bytes[start+12]!==0)throw new Error('Native worker PNG requires standard compression/filtering and no interlace.');
    }else if(type==='IDAT'){
      if(dataEnded)throw new Error('PNG IDAT chunks must be consecutive.');dataStarted=true;compressedBytes+=length;pieces.push(bytes.subarray(start,end));
    }else{
      if(dataStarted)dataEnded=true;
      if(type==='IEND'){if(length!==0||!dataStarted||end+4!==bytes.length)throw new Error('Invalid PNG ending.');ended=true;break;}
      if(['tRNS','acTL','fcTL','fdAT','iCCP','cICP','mDCV','cLLI'].includes(type))throw new Error(`PNG ${type} image semantics are not connected in the native worker.`);
      if(type==='PLTE'||type[0]===type[0].toUpperCase())throw new Error(`Unsupported PNG critical chunk: ${type}`);
    }offset=end+4;
  }
  if(!ended||!compressedBytes)throw new Error('PNG has no complete image data.');
  const pixelBytes=channels*(bitDepth/8),stride=width*pixelBytes,expected=height*(stride+1),compressed=new Uint8Array(compressedBytes);let at=0;for(const piece of pieces){compressed.set(piece,at);at+=piece.length;}
  const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),filtered=new Uint8Array(expected);let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;if(size+value.length>expected)throw new Error('PNG inflated beyond its declared dimensions.');filtered.set(value,size);size+=value.length;}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  if(size!==expected)throw new Error('PNG scanline byte count differs from its dimensions.');
  const samples=new Uint8Array(height*stride);let from=0;
  for(let y=0;y<height;y++){
    const filter=filtered[from++];if(filter>4)throw new Error('Invalid PNG scanline filter.');
    for(let x=0;x<stride;x++){
      const target=y*stride+x,left=x>=pixelBytes?samples[target-pixelBytes]:0,up=y?samples[target-stride]:0,diagonal=y&&x>=pixelBytes?samples[target-stride-pixelBytes]:0;let prediction=0;
      if(filter===1)prediction=left;else if(filter===2)prediction=up;else if(filter===3)prediction=Math.floor((left+up)/2);else if(filter===4){const p=left+up-diagonal,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-diagonal);prediction=a<=b&&a<=c?left:b<=c?up:diagonal;}
      samples[target]=(filtered[from++]+prediction)&255;
    }
  }
  return{width,height,channels,bitDepth,samples};
}
