import {crc32} from '../shared/zip.mjs';
// Raw PNG bands for native IrisImage; no canvas, resampling or premultiplication.
// Filtering/Adam7 follow PNG; raster/color-model shape follows the pinned JDK PNG reader.
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
  let offset=8,width,height,inputChannels,bitDepth,color,interlace,ended=false,dataStarted=false,dataEnded=false,palette,transparency,compressedBytes=0;const pieces=[];
  while(offset<bytes.length){
    if(offset+12>bytes.length)throw new Error('Truncated PNG chunk.');const length=view.getUint32(offset);if(length>bytes.length-offset-12)throw new Error('Truncated PNG chunk payload.');
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),start=offset+8,end=start+length;
    if(!/^[A-Za-z]{4}$/.test(type)||type[2]!==type[2].toUpperCase())throw new Error('Invalid PNG chunk type.');
    if(crc32(bytes.subarray(offset+4,end))!==view.getUint32(end))throw new Error(`PNG checksum failed: ${type}`);
    if(width===undefined&&type!=='IHDR')throw new Error('PNG must start with IHDR.');
    if(type==='IHDR'){
      if(width!==undefined||length!==13)throw new Error('Invalid PNG header.');width=view.getUint32(start);height=view.getUint32(start+4);bitDepth=bytes[start+8];color=bytes[start+9];interlace=bytes[start+12];inputChannels=({0:1,2:3,3:1,4:2,6:4})[color];
      if(width<1||height<1||width>16384||height>16384||width*height>4194304)throw new Error('PNG exceeds the worker limit of 4,194,304 pixels.');
      if(!inputChannels||!((color===0&&[1,2,4,8,16].includes(bitDepth))||(color===3&&[1,2,4,8].includes(bitDepth))||([2,4,6].includes(color)&&[8,16].includes(bitDepth))))throw new Error('Invalid PNG color type or bit depth.');
      if(bytes[start+10]!==0||bytes[start+11]!==0||interlace>1)throw new Error('Native worker PNG requires standard compression/filtering and a valid interlace method.');
    }else if(type==='IDAT'){
      if(color===3&&!palette)throw new Error('Indexed PNG requires a palette before image data.');
      if(dataEnded)throw new Error('PNG IDAT chunks must be consecutive.');dataStarted=true;compressedBytes+=length;pieces.push(bytes.subarray(start,end));
    }else{
      if(dataStarted)dataEnded=true;
      if(type==='IEND'){if(length!==0||!dataStarted||end+4!==bytes.length)throw new Error('Invalid PNG ending.');ended=true;break;}
      if(type==='PLTE'){
        if(dataStarted||palette||transparency||![2,3,6].includes(color)||length<3||length>768||length%3||color===3&&length/3>2**bitDepth)throw new Error('Invalid PNG palette or palette ordering.');palette=bytes.slice(start,end);
      }else if(type==='tRNS'){
        if(dataStarted||transparency)throw new Error('Invalid PNG transparency ordering or duplicate key.');
        if(color===3){if(!palette||length<1||length>palette.length/3)throw new Error('Invalid indexed PNG transparency palette.');transparency=bytes.slice(start,end);}
        else if(color===0||color===2){
          if(color===0&&bitDepth<8)throw new Error('Packed grayscale transparency expansion remains unavailable.');
          if(length!==(color===0?2:6))throw new Error('PNG transparency key has an invalid channel count.');
          transparency=Array.from({length:inputChannels},(_,i)=>view.getUint16(start+2*i));if(transparency.some(sample=>sample>2**bitDepth-1))throw new Error('PNG transparency key exceeds its source bit depth.');
        }else throw new Error('PNG alpha-channel images cannot contain a transparency key.');
      }else if(['acTL','fcTL','fdAT','iCCP','cICP','mDCV','cLLI'].includes(type))throw new Error(`PNG ${type} image semantics are not connected in the native worker.`);
      else if(type[0]===type[0].toUpperCase())throw new Error(`Unsupported PNG critical chunk: ${type}`);
    }offset=end+4;
  }
  if(!ended||!compressedBytes)throw new Error('PNG has no complete image data.');
  const indexed=color===3||color===0&&bitDepth<8,key=transparency&&color!==3?transparency:null,channels=key?inputChannels+1:inputChannels,sampleBytes=bitDepth===16?2:1,outputPixelBytes=channels*sampleBytes,decodedBytes=width*height*outputPixelBytes;
  let indexedPalette;
  if(indexed){
    const count=2**bitDepth;indexedPalette=new Uint8Array(count*4);
    for(let i=0;i<count;i++){
      const source=color===3?Math.min(i,palette.length/3-1):i;
      for(let b=0;b<3;b++)indexedPalette[i*4+b]=color===3?palette[source*3+b]:Math.floor(i*255/(count-1));
      indexedPalette[i*4+3]=color===3&&transparency&&i<transparency.length?transparency[i]:255;
    }
  }
  if(decodedBytes+(indexedPalette?.length||0)>MAX_DECODED_BYTES)throw new Error('PNG decoded image exceeds its 16 MiB band budget.');
  const pixelBits=inputChannels*bitDepth,filterStep=Math.max(1,Math.ceil(pixelBits/8)),passes=(interlace?ADAM7:[[0,0,1,1]]).map(([x,y,dx,dy])=>({x,y,dx,dy,width:Math.max(0,Math.ceil((width-x)/dx)),height:Math.max(0,Math.ceil((height-y)/dy))})).filter(pass=>pass.width&&pass.height);
  const expected=passes.reduce((size,pass)=>size+pass.height*(Math.ceil(pass.width*pixelBits/8)+1),0);
  if(expected>MAX_DECODED_BYTES+2*height+7)throw new Error('PNG pass data exceeds its inflated byte budget.');
  const compressed=new Uint8Array(compressedBytes);let at=0;for(const piece of pieces){compressed.set(piece,at);at+=piece.length;}
  const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),filtered=new Uint8Array(expected);let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;if(size+value.length>expected)throw new Error('PNG inflated beyond its declared pass dimensions.');filtered.set(value,size);size+=value.length;}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  if(size!==expected)throw new Error('PNG scanline byte count differs from its pass dimensions.');
  const samples=new Uint8Array(decodedBytes);let from=0;
  for(const pass of passes){
    const stride=Math.ceil(pass.width*pixelBits/8);let previous=new Uint8Array(stride),row=new Uint8Array(stride);
    for(let y=0;y<pass.height;y++){
      const filter=filtered[from++];if(filter>4)throw new Error('Invalid PNG scanline filter.');
      for(let x=0;x<stride;x++)row[x]=(filtered[from++]+prediction(filter,x>=filterStep?row[x-filterStep]:0,previous[x],x>=filterStep?previous[x-filterStep]:0))&255;
      const destinationY=pass.y+y*pass.dy;
      if(pass.dx===1&&!key&&bitDepth>=8)samples.set(row,(destinationY*width+pass.x)*outputPixelBytes);
      else for(let x=0;x<pass.width;x++){
        const target=(destinationY*width+pass.x+x*pass.dx)*outputPixelBytes;let match=!!key;
        for(let b=0;b<inputChannels;b++){
          const source=(x*inputChannels+b)*sampleBytes,value=bitDepth<8?(row[Math.floor(x*bitDepth/8)]>>>(8-bitDepth-x*bitDepth%8))&(2**bitDepth-1):sampleBytes===1?row[source]:(row[source]<<8)|row[source+1];
          if(color===3&&value>=palette.length/3)throw new Error('PNG pixel references a missing palette entry.');
          if(sampleBytes===2)samples[target+b*2]=value>>>8;samples[target+b*sampleBytes+sampleBytes-1]=value&255;
          if(key&&value!==key[b])match=false;
        }
        if(key)for(let b=0;b<sampleBytes;b++)samples[target+inputChannels*sampleBytes+b]=match?0:255;
      }
      // The contiguous path still validates actual indexed references against PLTE, not padded colors.
      if(color===3&&pass.dx===1&&bitDepth===8)for(const value of row)if(value>=palette.length/3)throw new Error('PNG pixel references a missing palette entry.');
      [row,previous]=[previous,row];
    }
  }
  return{width,height,channels,bitDepth,samples,...(indexedPalette?{palette:indexedPalette}:{})};
}
