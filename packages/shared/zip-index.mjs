import{ARCHIVE_LIMIT,FILE_LIMIT,ENTRY_LIMIT,resourcePath}from'./paths.mjs';
export const ZIP_DIRECTORY_LIMIT=32*1024*1024;
const decoder=new TextDecoder('utf-8',{fatal:true});
// Preliminary central-directory metadata only; readZip remains the content/CRC authority.
export function zipDirectoryLocation(tail,archiveBytes){
  if(!(tail instanceof Uint8Array)||!Number.isSafeInteger(archiveBytes)||archiveBytes<22||archiveBytes>ARCHIVE_LIMIT||tail.length>65557||tail.length>archiveBytes)throw new Error('ZIP size is invalid or exceeds 256 MiB.');const view=new DataView(tail.buffer,tail.byteOffset,tail.byteLength);let end=-1;
  for(let i=tail.length-22;i>=0;i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===tail.length){end=i;break;}
  if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw new Error('Split or malformed ZIP archives are unsupported.');const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
  if(count===65535||count>ENTRY_LIMIT||offset===0xffffffff||size>ZIP_DIRECTORY_LIMIT||offset+size!==archiveBytes-tail.length+end||view.getUint16(end+8,true)!==count)throw new Error('ZIP directory is invalid, ZIP64 or exceeds the 32 MiB inspection budget.');return{count,size,offset,archiveBytes};
}
export function zipDirectoryEntries(bytes,location){
  if(!(bytes instanceof Uint8Array)||bytes.length!==location.size)throw new Error('ZIP directory read was incomplete.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),entries=[],seen=new Set();let cursor=0,total=0;
  for(let i=0;i<location.count;i++){
    if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw new Error('Invalid ZIP directory entry.');const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),packed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),offset=view.getUint32(cursor+42,true),mode=view.getUint32(cursor+38,true)>>>16;
    if(cursor+46+nameLength+extra+comment>bytes.length||flags&1||![0,8].includes(method)||size>FILE_LIMIT||packed===0xffffffff||size===0xffffffff||offset===0xffffffff||(mode&0xf000)===0xa000)throw new Error('Encrypted, symbolic, ZIP64, oversized or unsupported ZIP entry.');
    const raw=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));cursor+=46+nameLength+extra+comment;const directory=raw.endsWith('/'),path=resourcePath(directory?raw.slice(0,-1):raw);if(directory)continue;if(seen.has(path)||offset+30>location.offset||(total+=size)>ARCHIVE_LIMIT)throw new Error('Duplicate, truncated or oversized expanded ZIP contents.');seen.add(path);entries.push({path,size,packed});
  }
  if(cursor!==bytes.length)throw new Error('ZIP directory size differs from its entries.');return entries;
}
export async function inspectZipFile(file,{current=()=>true}={}){
  const guard=()=>{if(!current())throw new DOMException('ZIP inspection cancelled.','AbortError');};guard();if(!Number.isSafeInteger(file?.size)||file.size>ARCHIVE_LIMIT||file.size<22)throw new Error('ZIP archive must fit 256 MiB.');const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());guard();const location=zipDirectoryLocation(tail,file.size),directory=new Uint8Array(await file.slice(location.offset,location.offset+location.size).arrayBuffer());guard();return{entries:zipDirectoryEntries(directory,location),archiveBytes:file.size};
}
