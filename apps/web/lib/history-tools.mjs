// Linear source comparison: one changed span, never a quadratic line diff or JSON rewrite.
export function sourceChange(before,after,{limit=4096,context=160}={}){
  let start=0,endBefore=before.length,endAfter=after.length;
  while(start<endBefore&&start<endAfter&&before.charCodeAt(start)===after.charCodeAt(start))start++;
  if(start===endBefore&&start===endAfter)return{same:true,start};
  while(endBefore>start&&endAfter>start&&before.charCodeAt(endBefore-1)===after.charCodeAt(endAfter-1)){endBefore--;endAfter--;}
  const excerpt=(text,end)=>{const from=Math.max(0,start-context),to=Math.min(text.length,end+context,from+limit);return{text:text.slice(from,to),from,to,truncated:to<Math.min(text.length,end+context)};};
  return{same:false,start,removed:endBefore-start,added:endAfter-start,before:excerpt(before,endBefore),after:excerpt(after,endAfter)};
}
export function sameEdit(before,after){return before?!!after&&before.owner===after.owner&&before.text===after.text&&before.baseText===after.baseText&&before.etag===after.etag:!after;}
export function restoreEditPlan(snapshot,current,backup,result,{replace=true}={}){
  if(!snapshot||!current||snapshot.owner!==current.owner)return null;
  const replaced=replace&&sameEdit(snapshot,current);
  return{text:replaced?backup.text:current.text,baseText:backup.text,etag:result.etag,replaced,preserved:!replaced&&current.text!==backup.text};
}
export class HistoryTools{
  constructor(options){Object.assign(this,options);}
  async open(path){
    const pack=this.getPack();if(!pack)throw new Error('Open a pack before viewing history.');
    let active=true,rows=null,page=0;const {element,copy}=this;
    const current=()=>active&&this.getPack()===pack,check=()=>{if(!current())throw new Error('The pack changed or history closed. Open history again.');};
    const search=element('input',{type:'search',maxlength:256,placeholder:'Filter resource path…','aria-label':'Filter history'}),status=copy('Loading saved history…'),list=element('ul',{class:'modal-list'}),position=copy(''),previous=element('button',{type:'button',text:'Previous',disabled:true}),next=element('button',{type:'button',text:'Next',disabled:true});
    const run=fn=>async()=>{try{check();await fn();}catch(error){this.onError(error);}};
    const draw=()=>{check();if(!rows)return;const matching=rows.filter(row=>row.path.toLowerCase().includes(search.value.toLowerCase())),pages=Math.max(1,Math.ceil(matching.length/32));page=Math.max(0,Math.min(page,pages-1));list.replaceChildren();
      for(const row of matching.slice(page*32,page*32+32))list.append(element('li',{},element('div',{class:'list-info'},element('strong',{text:row.path}),element('small',{text:new Date(row.createdAt).toLocaleString()+' · '+row.bytes+' bytes'})),element('button',{type:'button',class:'quiet-button',text:'Review version',onclick:run(()=>this.review(pack,row,{path}))})));
      status.textContent=matching.length+' saved versions';position.textContent='Page '+(page+1)+' of '+pages;previous.disabled=page===0;next.disabled=page+1>=pages;
      if(!matching.length)list.append(element('li',{class:'muted',text:'No saved versions match this filter.'}));
    };
    search.addEventListener('input',run(()=>{page=0;draw();}));previous.addEventListener('click',run(()=>{page--;draw();}));next.addEventListener('click',run(()=>{page++;draw();}));
    const dialog=this.ask(path?'Saved resource history':'Pack history',[copy('Backups precede saves, restores and deletion. Review a version before restoring it. Browsing leaves open edits intact.'),search,status,list,element('div',{class:'reference-pagination'},previous,position,next)],{submit:null,cancel:'Close',wide:true});
    this.lastTask=this.api.request('backups',{query:{pack,path}}).then(result=>{if(current()){rows=result.backups;draw();}}).catch(error=>{if(active)status.textContent=error.message;});
    try{await dialog;}finally{active=false;}
  }
  async review(pack,row,{path}={}){
    let active=true,loaded=null,applied=false;const {element,copy}=this,snapshot=this.getEdit(pack,row.path),allowed=this.canRestore(pack,row.path);
    const current=()=>active&&this.getPack()===pack,check=()=>{if(!current())throw new Error('The pack changed or review closed. Open this saved version again.');};check();
    const status=copy('Reading the saved version and current disk resource…'),content=element('div'),mode=element('select',{'aria-label':'Open edit after restoring'},element('option',{value:'keep',text:'Keep open text as unsaved changes'}),element('option',{value:'replace',text:'Replace the captured open text'}));mode.value=snapshot&&snapshot.text!==snapshot.baseText?'keep':'replace';
    const sourceArea=(label,text)=>{const node=element('textarea',{class:'history-source',readOnly:true,spellcheck:'false','aria-label':label});node.value=text.slice(0,65536);return node;};
    const showSource=(label,text)=>element('details',{},element('summary',{text:label+' · '+text.length+' UTF-16 units'}),sourceArea(label,text),...(text.length>65536?[copy('Source display stops at 65,536 UTF-16 units. Download contains the entire exact text.')]:[]),element('button',{type:'button',text:'Download '+label,onclick:()=>{try{check();this.download(new Blob([text],{type:'application/json'}),row.path.split('/').at(-1).replace(/\.json$/i,'')+'.'+label.toLowerCase().replaceAll(' ','-')+'.json');}catch(error){this.onError(error);}}}));
    const comparison=element('select',{'aria-label':'Compare saved version against'},element('option',{value:'disk',text:'Current disk file'}),...(snapshot?[element('option',{value:'open',text:'Captured open text'})]:[])),difference=element('div');
    const draw=()=>{check();if(!loaded)return;const text=comparison.value==='open'?snapshot.text:loaded.disk?.text??'',change=sourceChange(text,loaded.backup.text);difference.replaceChildren(copy(change.same?'Texts are identical.':`First difference at UTF-16 offset ${change.start}; one span removes ${change.removed} and adds ${change.added} units. This is a prefix/suffix comparison, not a minimal edit script.`));
      if(!change.same)for(const [label,span]of [['Comparison text',change.before],['Saved version',change.after]])difference.append(element('strong',{text:label+' excerpt · offset '+span.from}),element('pre',{class:'history-excerpt',text:span.text}),...(span.truncated?[copy('Excerpt truncated. Expand or download the source below.')]:[]));
    };
    comparison.addEventListener('change',()=>{try{draw();}catch(error){this.onError(error);}});
    const back=element('button',{type:'button',class:'quiet-button',text:'Back to history',onclick:async()=>{try{check();await this.open(path);}catch(error){this.onError(error);}}});
    const dialog=this.ask('Review saved version · '+row.path,[back,copy(new Date(row.createdAt).toLocaleString()+' · '+pack+'/'+row.path),status,content],{wide:true,submit:allowed?'Restore this version':null,cancel:'Close',onSubmit:async()=>{
      check();if(!loaded)throw new Error('Wait for both versions to load before restoring.');if(applied)throw new Error('This version was already restored. Close the review.');if(!sameEdit(snapshot,this.getEdit(pack,row.path)))throw new Error('The open edit changed. Review this version again before restoring.');
      await this.restore({pack,path:row.path,row,backup:loaded.backup,disk:loaded.disk,snapshot,replace:mode.value==='replace'});applied=true;
    }});
    this.lastTask=Promise.all([this.api.backup(pack,row.path,row.id),this.api.read(pack,row.path).catch(error=>{if(error.status===404)return null;throw error;})]).then(([backup,disk])=>{
      if(!current())return;if(backup.etag!==row.etag)throw new Error('The backup changed since history was listed. Reopen history.');loaded={backup,disk};status.textContent=disk?'Restoring replaces the captured disk version and backs it up first.':'The resource is absent on disk; restoring creates it only if it is still absent.';
      content.replaceChildren(...(!allowed?[copy('This resource is read-only. Preview and download remain available.')]:[]),...(snapshot?[this.field('Open buffer after restore',mode,'New typing during the restore is always retained. Undo history stays available.')]:[copy('No open buffer will be replaced. Open the resource from the explorer after restoration.')]),this.field('Compare saved version against',comparison),...(!disk?[copy('Disk comparison uses empty text because this resource is deleted.')]:[]),difference,showSource('Saved version',backup.text),...(disk?[showSource('Current disk file',disk.text)]:[]),...(snapshot?[showSource('Captured open text',snapshot.text)]:[]));draw();
    }).catch(error=>{if(active){loaded=null;status.textContent=error.message;}});
    try{await dialog;}finally{active=false;}
  }
}
