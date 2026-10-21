const ROLES=['baseline','default','custom'],LIMITS={packs:16,bytes:256*1024*1024,archive:64*1024*1024};
const manifest=state=>({version:1,mode:state.mode,entries:state.entries.filter(entry=>entry.remember).map(({id,role,enabled})=>({id,role,enabled}))});
const snapshot=state=>({mode:state.mode,entries:state.entries.map(entry=>({...entry}))});
function validate(state){
  if(!['overlay','replace'].includes(state.mode))throw new Error('Choose overlay or replace-default-overrides mode.');
  if(state.entries.length>LIMITS.packs)throw new Error('The rendering library is limited to 16 packs.');
  const seen=new Set();let archives=0,assets=0;
  for(const entry of state.entries){
    if(!/^[a-f0-9]{64}$/.test(entry.id)||seen.has(entry.id)||!ROLES.includes(entry.role)||typeof entry.enabled!=='boolean'||typeof entry.remember!=='boolean')throw new Error('Invalid or duplicate rendering-library entry.');seen.add(entry.id);
    if(!(entry.blob instanceof Blob)||entry.blob.size>LIMITS.archive||entry.blob.size<1||!Number.isSafeInteger(entry.pack.expandedBytes)||entry.pack.expandedBytes<0)throw new Error('Invalid rendering archive or size.');
    archives+=entry.blob.size;assets+=entry.pack.expandedBytes;
  }
  if(archives>LIMITS.bytes||assets>LIMITS.bytes)throw new Error('The rendering library exceeds its 256 MiB archive or expanded-asset budget.');
}

export class TextureLibrary{
  constructor({open,read,write}){this.open=open;this.read=read;this.write=write;this.state={mode:'overlay',entries:[]};this.queue=Promise.resolve();this.warnings=[];this.restored=false;this.storageReady=false;this.savedManifest=undefined;this.revision=0;}
  get entries(){return this.state.entries.map(entry=>({...entry}));}
  get mode(){return this.state.mode;}
  activePacks(){
    const enabled=this.state.entries.filter(entry=>entry.enabled),replace=this.mode==='replace'&&enabled.some(entry=>entry.role==='custom');
    return ROLES.flatMap(role=>enabled.filter(entry=>entry.role===role&&!(replace&&role==='default')).map(entry=>entry.pack));
  }
  enqueue(action){const result=this.queue.then(action);this.queue=result.catch(()=>{});return result;}
  restore({reload=false}={}){return this.enqueue(async()=>{
    if(this.restored&&this.storageReady&&!reload)return this.warnings;this.restored=true;this.storageReady=false;const warnings=[];let stored;const session=this.state.entries.filter(entry=>!entry.remember).map(entry=>({...entry}));
    try{stored=await this.read();}catch(error){this.warnings=[`Saved rendering packs are unavailable: ${error.message}. Session-only imports remain available.`];return this.warnings;}
    const records=new Map(stored.records.map(({key,value})=>[key,value])),config=stored.config;let specs,mode='overlay';
    if(config===undefined){specs=[...records.keys()].map(id=>({id,role:'custom',enabled:true}));if(specs.length)warnings.push('Legacy packs had no saved priority. Their previous storage-key order was retained; assign roles and order before saving.');}
    else if(config?.version===1&&['overlay','replace'].includes(config.mode)&&Array.isArray(config.entries)&&config.entries.length<=LIMITS.packs){
      mode=config.mode;specs=config.entries;
    }else{this.warnings=['Saved rendering-library settings are invalid. Stored archives were preserved; import a pack for this session or repair the settings.'];return this.warnings;}
    const merge=entries=>{const ids=new Set(entries.map(entry=>entry.id));return entries.concat(session.filter(entry=>!ids.has(entry.id)));};
    const next={mode:config===undefined&&session.length?this.mode:mode,entries:[]},seen=new Set();
    for(const spec of specs){
      try{
        if(!spec||!/^[a-f0-9]{64}$/.test(spec.id)||seen.has(spec.id)||!ROLES.includes(spec.role)||typeof spec.enabled!=='boolean')throw new Error('Invalid or duplicate saved entry.');seen.add(spec.id);
        if(next.entries.length>=LIMITS.packs){warnings.push('Additional saved packs were left on disk because the 16-pack limit was reached.');break;}
        const record=records.get(spec.id);if(!record?.blob)throw new Error('Saved archive is missing.');
        if(!(record.blob instanceof Blob)||record.blob.size>LIMITS.archive)throw new Error('Saved archive exceeds the input budget.');
        if(next.entries.reduce((sum,entry)=>sum+entry.blob.size,record.blob.size)>LIMITS.bytes)throw new Error('Saved archives exceed the 256 MiB input budget.');
        const pack=await this.open(record.blob,record.name);if(pack.digest!==spec.id)throw new Error('Saved archive hash differs from its identity.');
        const candidate={...next,entries:[...next.entries,{id:spec.id,pack,blob:record.blob,remember:true,role:spec.role,enabled:spec.enabled}]};validate({...candidate,entries:merge(candidate.entries)});next.entries=candidate.entries;
      }catch(error){warnings.push(`${spec?.id?.slice?.(0,12)??'Saved pack'}: ${error.message}`);}
    }
    next.entries=merge(next.entries);validate(next);this.state=next;this.savedManifest=structuredClone(config);this.storageReady=true;const known=new Set(specs.map(spec=>spec?.id)),unlisted=[...records.keys()].filter(id=>!known.has(id)).length;if(unlisted)warnings.push(`${unlisted} unreferenced saved archives were preserved on disk.`);this.warnings=warnings;this.revision++;return warnings;
  });}
  change(edit){return this.enqueue(async()=>{
    const before=this.state,next=snapshot(before),saveIntent=await edit(next);validate(next);
    const old=manifest(before),saved=manifest(next),operations=[];
    if(saveIntent!==false){
    for(const entry of before.entries)if(entry.remember&&!next.entries.some(value=>value.id===entry.id&&value.remember))operations.push({store:'resource-packs',key:entry.id,value:undefined});
    for(const entry of next.entries)if(entry.remember&&!before.entries.some(value=>value.id===entry.id&&value.remember))operations.push({store:'resource-packs',key:entry.id,value:{name:entry.pack.name,blob:entry.blob}});
    if((old.entries.length||saved.entries.length||this.savedManifest)&&JSON.stringify(this.savedManifest)!==JSON.stringify(saved))operations.push({store:'settings',key:'texture-library',value:saved});
    }
    if(operations.length){
      if(!this.storageReady)throw new Error('Saved rendering settings could not be read. Retry saved packs before remembering changes; session-only imports remain available.');
      try{await this.write(operations,this.savedManifest);}catch(error){if(error.name==='TextureLibraryConflict'){this.storageReady=false;this.warnings=[error.message];}throw error;}
      this.savedManifest=structuredClone(saved);
    } // Publish only after the entire storage transaction commits.
    this.state=next;this.revision++;return this.entries;
  });}
  add(file,{role='custom',remember=false,name=file.name??'Resource pack'}={}){
    return this.change(async next=>{
      const blob=file instanceof Blob?file:new Blob([file]);if(blob.size>LIMITS.archive)throw new Error('Resource-pack input exceeds 64 MiB.');
      if(next.entries.length>=LIMITS.packs||next.entries.reduce((sum,entry)=>sum+entry.blob.size,blob.size)>LIMITS.bytes)throw new Error('The rendering library exceeds its pack or archive budget.');
      const pack=await this.open(blob,name);if(next.entries.some(entry=>entry.id===pack.digest))throw new Error('This resource pack is already in the library.');
      next.entries.push({id:pack.digest,pack,blob,role,remember,enabled:true});return remember;
    });
  }
  update(id,patch){const captured=structuredClone(patch);return this.change(next=>{const entry=next.entries.find(entry=>entry.id===id);if(!entry)throw new Error('This rendering pack is no longer loaded.');for(const key of Object.keys(captured))if(!['role','enabled','remember'].includes(key))throw new Error('Unknown rendering-pack setting.');const wasRemembered=entry.remember;Object.assign(entry,captured);return wasRemembered||entry.remember;});}
  move(id,delta){return this.change(next=>{
    if(![-1,1].includes(delta))throw new Error('Priority moves one place within the assigned role.');
    const index=next.entries.findIndex(entry=>entry.id===id);if(index<0)throw new Error('This rendering pack is no longer loaded.');
    const peers=next.entries.map((entry,index)=>({entry,index})).filter(value=>value.entry.role===next.entries[index].role),at=peers.findIndex(value=>value.index===index),other=peers[at+delta];if(!other)return false;
    const saveIntent=next.entries[index].remember&&next.entries[other.index].remember;[next.entries[index],next.entries[other.index]]=[next.entries[other.index],next.entries[index]];return saveIntent;
  });}
  remove(id){return this.change(next=>{const entry=next.entries.find(entry=>entry.id===id);if(!entry)throw new Error('This rendering pack is no longer loaded.');next.entries=next.entries.filter(entry=>entry.id!==id);return entry.remember;});}
  setMode(mode){return this.change(next=>{next.mode=mode;});}
  restoreDefaults(){return this.change(next=>{
    if(!next.entries.some(entry=>entry.role!=='custom'))throw new Error('Assign your local baseline or default override packs before restoring defaults.');
    next.mode='overlay';for(const entry of next.entries)entry.enabled=entry.role!=='custom';
  });}
}
