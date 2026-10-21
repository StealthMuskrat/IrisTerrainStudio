const LIMIT=160*1024*1024,PAGE=64*1024;
// Retain capacity across section remeshes; zero-length uploads only hide old contents.
// Both vertex buffers and the blend index buffer share one bounded owner.
export class MeshBufferStore{
  constructor(device,{byteLimit=LIMIT}={}){this.device=device;this.byteLimit=byteLimit;this.slots=new Map();this.bytes=0;this.disposed=false;}
  reserve(name,bytes,usage){return this.reserveMany([{name,bytes,usage}]).get(name);}
  reserveMany(requests){
    if(this.disposed)throw new DOMException('Mesh buffers disposed.','AbortError');
    const result=new Map(),growth=[];let bytesAfter=this.bytes;
    for(const {name,bytes,usage}of requests){
      if(result.has(name))throw new Error('Duplicate mesh buffer request.');
      if(!Number.isSafeInteger(bytes)||bytes<0||bytes%4)throw new Error('Mesh buffer length must be a nonnegative aligned integer.');
      const old=this.slots.get(name);if(old&&old.usage!==usage)throw new Error('Mesh buffer usage changed.');result.set(name,old?.buffer??null);
      if(bytes<=(old?.capacity??0))continue;
      const capacity=Math.ceil(bytes/PAGE)*PAGE,limit=this.device.limits.maxBufferSize??this.byteLimit;
      if(capacity>limit)throw new Error('Mesh buffer exceeds the GPU device allocation limit.');
      bytesAfter+=capacity-(old?.capacity??0);growth.push({name,capacity,usage,old});
    }
    if(bytesAfter>this.byteLimit)throw new Error('Mesh buffers exceed the 160 MiB retained allocation budget.');
    // Allocate the entire replacement before retiring any live buffer. Admission or allocation
    // failure leaves the displayed mesh usable; no bytes have been written yet.
    try{for(const entry of growth)entry.buffer=this.device.createBuffer({label:'Voxel '+entry.name,size:entry.capacity,usage:entry.usage});}
    catch(error){for(const entry of growth)entry.buffer?.destroy();throw error;}
    for(const {name,capacity,usage,buffer,old}of growth){this.slots.set(name,{buffer,capacity,usage});result.set(name,buffer);old?.buffer.destroy();}
    this.bytes=bytesAfter;return result;
  }
  write(name,data,usage){const buffer=this.reserve(name,data.byteLength,usage);if(data.byteLength)this.device.queue.writeBuffer(buffer,0,data);return buffer;}
  dispose(){if(this.disposed)return;this.disposed=true;for(const {buffer}of this.slots.values())buffer.destroy();this.slots.clear();this.bytes=0;}
}
