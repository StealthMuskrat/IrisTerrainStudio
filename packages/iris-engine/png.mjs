import {crc32} from '../shared/zip.mjs';
// Raw PNG bands for native IrisImage. No canvas, color conversion, resampling or premultiplication.
// PNG filter and Adam7 layouts: https://www.w3.org/TR/2025/REC-png-3-20250624/
const MAX_DECODED_BYTES=16*1024*1024;
const ADAM7=[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
function prediction(filter,left,up,diagonal){
  if(filter===1)return left;if(filter===2)return up;if(filter===3)return Math.floor((left+up)/2);
  if(filter===4){const p=left+up-diagonal,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-diagonal);return a<=b&&a<=c?left:b<=c?up:diagonal;}return 0;
}
export async function decodeNativePng(input){
  if(!(input instanceof Uint8Array)||input.length<33||input.length>8*1024*1024)throw new Error('PNG exceeds its 8 MiB input budget or is truncated.');
  const bytes=input,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),signature=[137,80,78,71,13,10,26,10];
  if(signature.some((value,index)=>bytes[index]!==value))throw new Error('Native image source must be PNG.');
  let offset=8,width,height,inputChannels,bitDepth,color,interlace,ended=false,dataStarted=false,dataEnded=false,paletteSeen=false,transparent,compressedBytes=0;const pieces=[];
  while(offset<bytes.length){
    if(offset+12>bytes.length)throw new Error('Truncated PNG chunk.');const length=view.getUint32(offset);if(length>bytes.length-offset-12)throw new Error('Truncated PNG chunk payload.');
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),start=offset+8,end=start+length;
    if(!/^[A-Za-z]{4}$/.test(type)||type[2]!==type[2].toUpperCase())throw new Error('Invalid PNG chunk type.');
    if(crc32(bytes.subarray(offset+4,end))!==view.getUint32(end))throw new Error(`PNG checksum failed: ${type}`);
    if(width===undefined&&type!=='IHDR')throw new Error('PNG must start with IHDR.');
    if(type==='IHDR'){
      if(width!==undefined||length!==13)throw new Error('Invalid PNG header.');width=view.getUint32(start);height=view.getUint32(start+4);bitDepth=bytes[start+8];color=bytes[start+9];interlace=bytes[start+12];inputChannels=color===0?1:color===2?3:color===6?4:0;
      if(width<1||height<1||width>16384||height>16384||width*height>4194304)throw new Error('PNG exceeds the worker limit of 4,194,304 pixels.');
      if(!inputChannels||!(bitDepth===8||(color===0&&bitDepth===16)))throw new Error('Native worker PNG supports grayscale 8/16-bit and RGB/RGBA 8-bit; indexed and other modes are unavailable.');
      if(bytes[start+10]!==0||bytes[start+11]!==0||interlace>1)throw new Error('Native worker PNG requires standard compression/filtering and a valid interlace method.');
    }else if(type==='IDAT'){
      if(dataEnded)throw new Error('PNG IDAT chunks must be consecutive.');dataStarted=true;compressedBytes+=length;pieces.push(bytes.subarray(start,end));
    }else{
      if(dataStarted)dataEnded=true;
      if(type==='IEND'){if(length!==0||!dataStarted||end+4!==bytes.length)throw new Error('Invalid PNG ending.');ended=true;break;}
      if(type==='PLTE'){
        if(dataStarted||paletteSeen||transparent||color!==2&&color!==6||length<3||length>768||length%3)throw new Error('Invalid PNG suggested palette or palette ordering.');paletteSeen=true;
      }else if(type==='tRNS'){
        if(dataStarted||transparent)throw new Error('Invalid PNG transparency ordering or duplicate key.');
        if(color!==2||bitDepth!==8)throw new Error('Native worker PNG transparency keys require 8-bit RGB; grayscale-alpha and indexed image semantics remain unavailable.');
        if(length!==6)throw new Error('PNG RGB transparency key must contain three 16-bit values.');transparent=[view.getUint16(start),view.getUint16(start+2),view.getUint16(start+4)];
        if(transparent.some(sample=>sample>255))throw new Error('PNG transparency key exceeds its source bit depth.');
      }else if(['acTL','fcTL','fdAT','iCCP','cICP','mDCV','cLLI'].includes(type))throw new Error(`PNG ${type} image semantics are not connected in the native worker.`);
      else if(type[0]===type[0].toUpperCase())throw new Error(`Unsupported PNG critical chunk: ${type}`);
    }offset=end+4;
  }
  if(!ended||!compressedBytes)throw new Error('PNG has no complete image data.');
  const channels=transparent?4:inputChannels,pixelBytes=inputChannels*(bitDepth/8),outputPixelBytes=channels*(bitDepth/8),decodedBytes=width*height*outputPixelBytes;
  if(decodedBytes>MAX_DECODED_BYTES)throw new Error('PNG decoded image exceeds its 16 MiB band budget.');
  const passes=(interlace?ADAM7:[[0,0,1,1]]).map(([x,y,dx,dy])=>({x,y,dx,dy,width:Math.max(0,Math.ceil((width-x)/dx)),height:Math.max(0,Math.ceil((height-y)/dy))})).filter(pass=>pass.width&&pass.height);
  const expected=passes.reduce((size,pass)=>size+pass.height*(pass.width*pixelBytes+1),0);
  // Every source pixel belongs to exactly one pass; allow only its bytes and bounded row filter bytes.
  if(expected>MAX_DECODED_BYTES+2*height+7)throw new Error('PNG pass data exceeds its inflated byte budget.');
  const compressed=new Uint8Array(compressedBytes);let at=0;for(const piece of pieces){compressed.set(piece,at);at+=piece.length;}
  const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),filtered=new Uint8Array(expected);let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;if(size+value.length>expected)throw new Error('PNG inflated beyond its declared pass dimensions.');filtered.set(value,size);size+=value.length;}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  if(size!==expected)throw new Error('PNG scanline byte count differs from its pass dimensions.');
  const samples=new Uint8Array(decodedBytes);let from=0;
  for(const pass of passes){
    const stride=pass.width*pixelBytes;let previous=new Uint8Array(stride),row=new Uint8Array(stride);
    for(let y=0;y<pass.height;y++){
      const filter=filtered[from++];if(filter>4)throw new Error('Invalid PNG scanline filter.');
      for(let x=0;x<stride;x++)row[x]=(filtered[from++]+prediction(filter,x>=pixelBytes?row[x-pixelBytes]:0,previous[x],x>=pixelBytes?previous[x-pixelBytes]:0))&255;
      const destinationY=pass.y+y*pass.dy;
      if(pass.dx===1&&!transparent)samples.set(row,(destinationY*width+pass.x)*outputPixelBytes);
      else for(let x=0;x<pass.width;x++){
        const source=x*pixelBytes,target=(destinationY*width+pass.x+x*pass.dx)*outputPixelBytes;
        for(let band=0;band<pixelBytes;band++)samples[target+band]=row[source+band];
        if(transparent)samples[target+3]=row[source]===transparent[0]&&row[source+1]===transparent[1]&&row[source+2]===transparent[2]?0:255;
      }
      [row,previous]=[previous,row];
    }
  }
  return{width,height,channels,bitDepth,samples};
}
