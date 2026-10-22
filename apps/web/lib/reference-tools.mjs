import{captureReferences}from'../../../packages/iris-resources/references.mjs';
export class ReferenceTools{
  constructor({element,field,copy,ask,getContext,read,reveal,close,onError}){Object.assign(this,{element,field,copy,ask,getContext,read,reveal,close,onError});this.sequence=0;}
  isCurrent(context){const next=this.getContext();return context.pack===next.pack&&context.revision===next.revision&&context.catalog===next.catalog;}
  async capture(context,current,onProgress){return captureReferences(context.rows,path=>this.read(context,path),{current:()=>current()&&this.isCurrent(context),onProgress});}
  async open(path){
    const context=this.getContext();if(!context.pack)throw new Error('Open a pack before inspecting resource matches.');const sequence=++this.sequence;let active=true,index=null,page=0;
    const current=()=>active&&sequence===this.sequence&&this.isCurrent(context),check=()=>{if(!current())throw new Error('Reference inputs changed. Reopen this inspection.');},{element,field,copy}=this;
    const run=action=>async()=>{try{check();await action();}catch(error){this.onError(error);}};
    const direction=element('select',{'aria-label':'Reference direction'},element('option',{value:'outgoing',text:'Outgoing string matches'}),element('option',{value:'incoming',text:'Incoming string matches'}));direction.value=/\.json$/i.test(path)?'outgoing':'incoming';
    const search=element('input',{type:'search',maxlength:256,placeholder:'Filter path, pointer or value…','aria-label':'Filter reference matches'}),status=copy('Reading JSON sources…'),warnings=element('pre',{class:'modal-copy reference-warnings'}),list=element('ul',{class:'modal-list'}),position=copy(''),previous=element('button',{type:'button',class:'quiet-button',text:'Previous',disabled:true}),next=element('button',{type:'button',class:'quiet-button',text:'Next',disabled:true});
    const render=()=>{check();if(!index)return;const result=index.page(path,{direction:direction.value,query:search.value,page});page=result.page;list.replaceChildren();
      status.textContent=result.total+' possible matches · '+index.stats.filesIndexed+' JSON sources inspected · '+(index.complete?'capture within limits':'incomplete capture');
      warnings.textContent=index.diagnostics.map(row=>row.path+': '+row.message).join('\n');warnings.hidden=!index.diagnostics.length;
      for(const row of result.rows){const source=element('button',{type:'button',class:'text-button',text:'Show source value',onclick:run(async()=>{this.close();await this.reveal(context.pack,row);})}),targets=element('select',{'aria-label':'Candidate target for '+row.path+row.pointer},element('option',{value:'',text:row.candidateCount>1?'Choose one of '+row.candidateCount+' candidates':'Choose target'}),...row.targets.map(target=>element('option',{value:target,text:target})));targets.value='';
        const open=element('button',{type:'button',class:'text-button',text:'Open target',onclick:run(async()=>{if(!targets.value)throw new Error('Choose a candidate target first.');this.close();await this.reveal(context.pack,{path:targets.value,pointer:''});})});
        list.append(element('li',{class:'reference-result'},element('div',{class:'list-info'},element('strong',{text:row.path}),element('code',{text:row.pointer||'(root)'}),element('small',{text:JSON.stringify(row.value)+' · '+row.candidateCount+' candidate'+(row.candidateCount===1?'':'s')+' · '+(row.owner?'open buffer':'saved file')})),element('div',{class:'reference-actions'},source,targets,open)));
      }
      if(!result.rows.length)list.append(element('li',{class:'muted',text:'No matching strings in this captured selection. This does not establish native reference validity.'}));position.textContent='Page '+(page+1)+' of '+result.pages;previous.disabled=page===0;next.disabled=page+1>=result.pages;
    };
    direction.addEventListener('change',run(()=>{page=0;render();}));search.addEventListener('input',run(()=>{page=0;render();}));previous.addEventListener('click',run(()=>{page--;render();}));next.addEventListener('click',run(()=>{page++;render();}));
    const dialog=this.ask('Resource string matches · '+path,[copy('Exact string matches suggest possible references. Ambiguous identifiers retain every admitted candidate; no references are rewritten or certified. Sources include captured open buffers and saved JSON. Incoming matches omit self references.'),field('Direction',direction),search,status,warnings,list,element('div',{class:'reference-pagination'},previous,position,next)],{wide:true,submit:null,cancel:'Close'});
    this.lastTask=this.capture(context,current,progress=>{if(current())status.textContent='Reading JSON sources '+progress.done+' / '+progress.total+'…';}).then(result=>{if(current()){index=result;render();}}).catch(error=>{if(active){status.textContent=error.message;previous.disabled=true;next.disabled=true;}});
    try{await dialog;}finally{active=false;if(this.sequence===sequence)this.sequence++;}
  }
  async mutationWarning(source,{description,submit,always=false}={}){
    const context=this.getContext(),sequence=++this.sequence;if(context.pack!==source.pack)throw new Error('The pack changed. Open this file action again.');let active=true,index=null,accepted=false;
    const current=()=>active&&sequence===this.sequence&&this.isCurrent(context),{element,copy}=this,status=copy('Checking JSON sources… Cancel stops this inspection.'),details=element('div');
    const dialog=this.ask('Review resource references',[copy(description??'Review possible references before continuing.'),status,details],{submit,onSubmit:()=>{if(!current())throw new Error('Reference inputs changed. Open this action again.');if(!index)throw new Error('Wait for reference inspection to finish, or cancel.');accepted=true;}});
    this.lastMutationTask=this.capture(context,current,progress=>{if(current())status.textContent='Checking JSON sources '+progress.done+' / '+progress.total+'…';}).then(result=>{
      if(!current())return;index=result;const rows=index.rows(source.path,'incoming');if(!rows.length&&index.complete&&!always){accepted=true;this.close();return;}
      status.textContent=rows.length+' possible incoming matches. '+(index.complete?'Capture completed within its limits.':'Capture is incomplete; some possible matches may be missing.');
      details.replaceChildren(element('ul',{class:'modal-list'},...rows.slice(0,40).map(row=>element('li',{},element('div',{class:'list-info'},element('strong',{text:row.path}),element('code',{text:row.pointer||'(root)'}),element('small',{text:JSON.stringify(row.value)+' · '+row.candidateCount+' candidate targets · '+(row.owner?'open buffer':'saved file')}))))),...(index.diagnostics.length?[element('pre',{class:'modal-copy',text:index.diagnostics.map(row=>row.path+': '+row.message).join('\n')})]:[]),copy('These are possible string matches, including open edits. Server saved-file checks still run. References and unknown fields are not rewritten.'),...(rows.length>40?[copy('Showing the first 40 matches. Use Resource matches for search and paging.')]:[]));
    }).catch(error=>{if(active)status.textContent=error.message;});
    try{await dialog;return accepted;}finally{active=false;if(this.sequence===sequence)this.sequence++;}
  }
}
