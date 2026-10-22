import {navigationSettings} from '/packages/voxel-renderer/navigation.mjs';
import {CameraTools} from './lib/camera-tools.mjs';
import {JsonTools} from './lib/json-tools.mjs';
import {DraftTools} from './lib/draft-tools.mjs';
import {draftRecord,sameDraft} from './lib/draft-library.mjs';
import {ChangeTools} from './lib/change-tools.mjs';
import {editorTextToSource} from './lib/source-editor.mjs';
import {ViewLibrary,previewSetup,cameraBookmark} from './lib/view-library.mjs';
import {ViewTools} from './lib/view-tools.mjs';
import {ImportTools} from './lib/import-tools.mjs';
import {ProblemTools} from './lib/problem-tools.mjs';
import {PROBLEM_LIMITS} from '/packages/iris-resources/pack-problems.mjs';
import {SearchTools} from './lib/search-tools.mjs';
import {HistoryTools,restoreEditPlan,sameEdit} from './lib/history-tools.mjs';
import {ReferenceTools} from './lib/reference-tools.mjs';
import {jsonSelection,selectJsonText} from './lib/json-navigation.mjs';
import {EditWorkspace,DraftQueue,editorSnapshot,validateEdit} from './lib/edit-workspace.mjs';
import { StudioApi, ApiError } from './lib/api.mjs';
import { localGet, localSet, localBatch, localTextureSnapshot, localDraftSnapshot } from './lib/local-store.mjs';
import { TextureLibrary } from './lib/texture-library.mjs';
import { MapTools } from './lib/map-tools.mjs';
import {MapAnalysisTools} from './lib/map-analysis-tools.mjs';
import { capturePreviewInputs,previewDescription } from './lib/preview-inputs.mjs';
import { displayRange } from '/packages/voxel-renderer/field-data.mjs';
import { JsonDocument, JsonNumber, EditHistory, stringify } from '/packages/iris-config/document.mjs';
import { loadFieldInventory, fieldHint } from '/packages/iris-config/inventory.mjs';
import { validateSchema, propertySchema } from '/packages/iris-config/schema.mjs';
import { loadNativePackSchema } from '/packages/iris-config/native-schema.mjs';
import { ResourceCatalog, category, resourceId } from '/packages/iris-resources/catalog.mjs';
import { pointerEscape, pointerParts, JSON_LIMIT } from '/packages/shared/paths.mjs';
import { nativePackInputs, referencesNativePackResources } from '/packages/iris-engine/pack-inputs.mjs';
import { captureNativePack } from '/packages/iris-engine/pack-snapshot.mjs';
import { findStyles } from '/packages/iris-engine/style-config.mjs';
import { noiseTilePersistence } from '/packages/iris-engine/noise-cache-store.mjs';
import { GenerationClient } from '/packages/iris-engine/client.mjs';
import { createGpuDevice, MapRenderer } from '/packages/voxel-renderer/map.mjs';
import { volumeBiomeSlice } from '/packages/voxel-renderer/biome-slice.mjs';
import { WorldRenderer } from '/packages/voxel-renderer/world.mjs';
import { GpuSession } from '/packages/voxel-renderer/gpu-session.mjs';
import {voxelViewMode,CellPalette} from '/packages/voxel-renderer/cell-view.mjs';
import { sectionSettings,sectionClip,clipBounds,clipCenter,emptyClip } from '/packages/voxel-renderer/clip.mjs';
import { MinecraftResourcePack, ResourcePackStack } from '/packages/resource-packs/pack.mjs';
import { inspectRenderingDependencies } from '/packages/resource-packs/dependencies.mjs';
import { writeRenderingBundle, assetCurrent } from '/packages/resource-packs/bundle.mjs';

let editorWriteBusy=false;
const editWorkspace=new EditWorkspace(),draftQueue=new DraftQueue(localSet);
let closeDialog = null,dialogSequence=0, resourceLoadSequence=0, catalogLoadSequence=0,schemaLoadSequence=0,schemaSaveQueue=Promise.resolve();
const $ = id => document.getElementById(id), api = new StudioApi(), generation = new GenerationClient();
const state = { bufferOwner:null,pack:'',catalogPack:'', catalog:new ResourceCatalog(), selected:null, text:'', baseText:'', etag:'', history:null, document:null, schema:null, mode:'form', view:'map', mapRange:null, fieldsOpen:new Set(['']), gpu:null, map:null, world:null, field:null, volume:null, biomeSlice:false, textures:[], textureStack:new ResourcePackStack(), revision:0, rawTimer:null, draftTimer:null, generationTimer:null, ready:false, objectUrl:null, noiseStyle:null, styleSelection:null, inventory:null, pendingGeneration:false, proceduralSelection:null, section:sectionSettings(),worldLoading:false, voxelView:'textured',navigation:navigationSettings(), mapField:null, mapError:null, gpuSession:null, gpuRecovering:false, gpuError:null, recoveryCamera:null, validatedVolume:null, volumeField:null, volumeInputs:null, mapInputs:null, pendingVolume:null, previewDirty:false, renderError:null };
const textureLibrary=new TextureLibrary({open:(file,name)=>MinecraftResourcePack.open(file,name),read:localTextureSnapshot,write:(changes,expectedTextureConfig)=>localBatch(changes,{expectedTextureConfig})});
let textureImportOptions={role:'custom',remember:false};

const mapTools=new MapTools({map:()=>state.map,volume:()=>currentVoxelVolume(),world:()=>state.world,get:$,ask,element,field,copy,onError:errorMessage,onSelect:sample=>{$('coordinates-status').textContent=`X ${sample.x} · Z ${sample.z}`;$('sample-status').textContent=sample.category??String(sample.value);},onRange:value=>{state.mapRange=value;persistPreview();},onCoordinates:sample=>{cancelPreview();$('coordinate-x').value=String(sample.x);$('coordinate-z').value=String(sample.z);persistPreview();message('Preview X/Z updated. Generate when ready.');},onFocus:()=>setView('split')});

const mapAnalysisTools=new MapAnalysisTools({element,field,copy,ask,getContext:mapAnalysisContext,getSelection:context=>mapTools.selection?.index.data===context.data?mapTools.selection.sample:null,select:(context,sample)=>{if(state.map?.data!==context.data)throw new Error('Recover the retained map display before highlighting its samples.');mapTools.select(sample.row,sample.column,state.map.index);},download,onError:errorMessage});
function mapAnalysisContext(){return{data:state.mapField??state.map?.data??null,index:state.map?.index??null,inputs:state.mapInputs};}
async function analyseRetainedMap(){await mapAnalysisTools.open();}

function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) { if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value); else if (key === 'class') node.className = value; else if (key === 'text') node.textContent = value; else if (key === 'dataset') Object.assign(node.dataset, value); else if (key === 'checked' || key === 'disabled' || key === 'hidden' || key === 'readOnly' || key === 'open') node[key] = value; else if (value !== undefined && value !== null) node.setAttribute(key, String(value)); }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
function message(text, error = false) { $('message-status').textContent = text; $('message-status').title=text; $('message-status').classList.toggle('error-state', error); }
let toastTimer;
function toast(text, error = false) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.toggle('error',error); $('toast').hidden = false; message(text,error); toastTimer = setTimeout(() => { $('toast').hidden = true; },error ? 9000 : 4500); }
function errorMessage(error) { if (error?.name !== 'AbortError') toast(error?.message || String(error),true); }
function bind(id,event,handler) { $(id).addEventListener(event,async event => { try { await handler(event); } catch(error) { errorMessage(error); } }); }
const cameraTools=new CameraTools({$,element,field,copy,ask,errorMessage,getWorld:()=>state.world,getSettings:()=>state.navigation,saveSettings:value=>{state.navigation=value;persistPreview();}});
const jsonTools=new JsonTools({element,field,copy,ask,getContext:()=>({pack:state.pack,path:state.selected?.path,revision:state.revision,text:state.text,document:state.document,schema:state.schema,editable:editable()}),commit:(text,pointer)=>{for(const open of state.fieldsOpen)if(open!==pointer&&(!pointer||open.startsWith(pointer+'/')))state.fieldsOpen.delete(open);state.fieldsOpen.add(pointer);setText(text);}});
const referenceTools=new ReferenceTools({element,field,copy,ask,getContext:referenceContext,read:(context,path)=>Promise.resolve(context.overrides.get(path)??api.read(context.pack,path)),reveal:openReferenceValue,close:()=>closeDialog?.(null),onError:errorMessage});
const historyTools=new HistoryTools({api,element,copy,field,ask,getPack:()=>state.pack,getEdit:historyEdit,canRestore:(pack,path)=>!category(path).excluded&&!state.catalog.byPath.get(path)?.readOnly,restore:restoreHistoryVersion,download,onError:errorMessage});
const searchTools=new SearchTools({element,field,copy,ask,getContext:referenceContext,getEditContext:searchEditContext,read:(context,path)=>Promise.resolve(context.overrides.get(path)??api.read(context.pack,path)),reveal:openTextSearchMatch,revealEdit:(owner,row)=>revealSourceMatch(row,{expected:owner}),commit:applySourceReplacement,close:()=>closeDialog?.(null),onError:errorMessage});
const importTools=new ImportTools({element,field,copy,ask,download,onError:errorMessage,upload:(id,body,{stripRoot})=>api.request('import',{method:'POST',query:{pack:id,stripRoot},headers:{'Content-Type':'application/zip'},body}),imported:importedPack});
const problemTools=new ProblemTools({element,field,copy,ask,getContext:problemContext,read:readProblemSource,reveal:openProblemSource,close:()=>closeDialog?.(null),download,onError:errorMessage});
const viewLibrary=new ViewLibrary({read:()=>localGet('settings','view-library'),write:(value,expectedViewConfig)=>localBatch([{store:'settings',key:'view-library',value}],{expectedViewConfig})});
const viewTools=new ViewTools({library:viewLibrary,element,field,copy,ask,getPack:()=>state.pack,getDialogSequence:()=>dialogSequence,capture:captureSavedView,apply:applySavedView,download,onError:errorMessage});
const changeTools=new ChangeTools({element,field,copy,ask,getContext:()=>{const edit=activeEdit();return edit?{...edit,revision:state.revision}:null;},read:(pack,path)=>api.read(pack,path),commit:applyDiskReview,download,onError:errorMessage});
const draftTools=new DraftTools({element,copy,field,ask,read:async()=>{await draftQueue.settle();return localDraftSnapshot();},readOne:async key=>{await draftQueue.settle(key);return localGet('drafts',key);},write:async(changes,expectedDrafts)=>{await Promise.all(expectedDrafts.map(guard=>draftQueue.settle(guard.key)));return localBatch(changes,{expectedDrafts});},recover:recoverLocalDraft,download,onError:errorMessage});
function download(blob,name) { const url = URL.createObjectURL(blob), link = element('a',{href:url,download:name}); document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); }
const pretty = name => name.replace(/([a-z\d])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const formatBytes = bytes => bytes >= 1024*1024 ? (bytes/1024/1024).toFixed(1)+' MiB' : bytes >= 1024 ? (bytes/1024).toFixed(1)+' KiB' : bytes+' B';
function field(label,input,description) { const wrapper=element('div',{class:'modal-field'},element('label',{text:label}),input); if(description)wrapper.append(element('small',{class:'muted',text:description}));return wrapper; }
function copy(text) { return element('p',{class:'modal-copy',text}); }
function ask(title,content,{submit='Continue',read=()=>true,onSubmit,wide=false,cancel='Cancel'}={}) {
  return new Promise(resolve=>{
    dialogSequence++;const dialog=$('modal'); if(closeDialog)closeDialog(null); else if(dialog.open)dialog.close(); $('modal-title').textContent=title; $('modal-body').replaceChildren(...(Array.isArray(content)?content:[content]));$('modal-submit').textContent=submit;$('modal-submit').hidden=!submit;$('modal-submit').disabled=false;$('modal-cancel').textContent=cancel;$('modal-error').hidden=true;dialog.style.width=wide?'min(850px,calc(100vw - 40px))':'';
    let finished=false;const finish=value=>{if(finished)return;finished=true;closeDialog=null;dialog.close();$('modal-form').onsubmit=null;dialog.oncancel=null;resolve(value);};
    $('modal-close').onclick=() => finish(null);$('modal-cancel').onclick=()=>finish(null);dialog.oncancel=event=>{event.preventDefault();finish(null);};
    closeDialog=finish;
    $('modal-form').onsubmit=async event=>{event.preventDefault();if(!submit)return;$('modal-submit').disabled=true;try{const value=read();if(onSubmit)await onSubmit(value);finish(value);}catch(error){if(!finished){$('modal-error').textContent=error.message;$('modal-error').hidden=false;}}finally{if(!finished)$('modal-submit').disabled=false;}};
    dialog.showModal();setTimeout(()=>dialog.querySelector('input,select,textarea')?.focus(),0);
  });
}
function dirty() { return !!state.selected && state.text !== state.baseText; }
function editable() { return !!state.selected?.editable && !state.selected.readOnly && !category(state.selected.path).excluded; }
async function authenticate() {
  for(;;){try{return await api.request('status');}catch(error){if(error.status!==401)throw error;const input=element('input',{type:'password',autocomplete:'current-password',placeholder:'Server access token',required:true});const token=await ask('Connect to Iris Terrain Studio',[copy('This server requires an access token. It is kept only in this browser session.'),field('Access token',input)],{submit:'Connect',read:()=>input.value.trim()});if(!token)throw error;api.setToken(token);}}
}
async function loadPacks(select) { const data=await api.packs(),control=$('pack-select');control.replaceChildren(element('option',{value:'',text:'Open a pack…'}),...data.packs.map(pack=>element('option',{value:pack.id,text:pack.name})));if(select&&data.packs.some(pack=>pack.id===select))await openPack(select);else if(state.pack)control.value=state.pack; }
function flushHistory() { clearTimeout(state.rawTimer);if(state.history&&state.text!==state.history.text)state.history.push(state.text); }
function activeEdit(){return editorSnapshot(state);}
function editorIdle(){if(editorWriteBusy)throw new Error('A save is in progress. Wait before switching or changing resource files.');}
function draftValue(record){return record.text!==record.baseText?{text:record.text,baseText:record.baseText,baseEtag:record.etag,savedAt:Date.now()}:undefined;}
function persistEditDraft(record){if(!record)return Promise.resolve();return draftQueue.put(record.pack+'/'+record.path,draftValue(record));}
function stashActiveEdit(){editorIdle();flushHistory();if(state.selected?.editable&&state.bufferOwner)parseDocument();const record=activeEdit();editWorkspace.stash(record);persistEditDraft(record).catch(()=>message('A local draft could not be stored. Open edits remain in memory; save them to keep changes.',true));}
function resetActiveEditor(){state.bufferOwner=null;state.selected=null;state.document=null;state.history=null;state.text='';state.baseText='';state.etag='';state.schema=null;state.issues=[];state.revision++;}
async function confirmNavigation(){
  editorIdle();flushHistory();if(!dirty())return true;const owner=state.bufferOwner,pack=state.pack,path=state.selected.path,text=state.text;
  const choice=element('select',{},element('option',{value:'save',text:'Save changes before continuing'}),element('option',{value:'discard',text:'Discard unsaved changes'}));
  const result=await ask('Unsaved resource',[copy('Unsaved changes in '+path+'. Switching resources normally keeps open edits; this action needs the current resource saved or discarded.'),field('Before continuing',choice)],{read:()=>choice.value});
  if(!result)return false;if(state.bufferOwner!==owner||state.pack!==pack||state.selected?.path!==path||state.text!==text)throw new Error('The resource changed. Open this action again.');if(result==='save'){const saved=await saveResource();return saved&&!dirty();}
  clearTimeout(state.draftTimer);state.text=state.baseText;state.history=new EditHistory(state.text);state.revision++;parseDocument();renderInspector();renderExplorer();await persistEditDraft(activeEdit());return true;
}
function renderEditorTabs(){
  const active=activeEdit(),rows=editWorkspace.entries(active,state.pack),tabs=$('editor-tabs');tabs.replaceChildren();
  for(const record of rows)tabs.append(element('div',{class:'editor-tab'+(record.owner===state.bufferOwner?' active':'')},element('button',{type:'button',text:record.path.split('/').at(-1)+(record.text!==record.baseText?' ●':''),title:record.path,'aria-pressed':String(record.owner===state.bufferOwner),onclick:()=>activateEdit(record).catch(errorMessage)}),element('button',{type:'button',text:'×',title:'Close '+record.path,'aria-label':'Close '+record.path,onclick:()=>closeEdit(record).catch(errorMessage)})));
  $('save-all').disabled=editorWriteBusy||!editWorkspace.dirty(active,state.pack).length;$('open-edits').textContent='Open edits ('+editWorkspace.entries(active).length+')';
}
async function activateEdit(record){editorIdle();if(record.pack!==state.pack)await openPack(record.pack);if(state.pack!==record.pack)return;const row=state.catalog.byPath.get(record.path)??{path:record.path,editable:true,size:record.text.length};await openResource(row);}
async function closeEdit(record){
  editorIdle();const live=activeEdit(),active=live?.owner===record.owner,current=active?live:editWorkspace.peek(record.pack,record.path);if(!current||current.owner!==record.owner)return;
  if(current.text!==current.baseText){const result=await ask('Close unsaved edit',[copy('Discard the open edits in '+current.pack+'/'+current.path+'? The saved file is unchanged.')],{submit:'Discard and close'});if(!result)return;const next=activeEdit()?.owner===current.owner?activeEdit():editWorkspace.peek(current.pack,current.path);if(!next||next.owner!==current.owner||next.text!==current.text)throw new Error('This edit changed. Close it again.');}
  editWorkspace.remove(current.pack,current.path);if(state.bufferOwner===current.owner){clearTimeout(state.rawTimer);clearTimeout(state.draftTimer);resetActiveEditor();renderInspector();}state.revision++;cancelPreview();renderExplorer();renderEditorTabs();await draftQueue.put(current.pack+'/'+current.path,undefined);
}
async function showOpenEdits(){
  editorIdle();const list=element('ul',{class:'modal-list'}),rows=editWorkspace.entries(activeEdit());for(const row of rows)list.append(element('li',{},element('div',{class:'list-info'},element('strong',{text:row.pack+'/'+row.path}),element('small',{text:row.text!==row.baseText?'Unsaved changes':'Saved buffer'})),element('button',{type:'button',class:'text-button',text:'Open',onclick:async()=>{closeDialog?.(null);try{await activateEdit(row);}catch(error){errorMessage(error);}}})));
  await ask('Open resource edits',[copy('Open buffers stay in this browser session across resource and pack switches. Each keeps its own undo history. Save all applies to the current pack. Dirty buffers are never evicted to admit another resource.'),element('button',{type:'button',class:'quiet-button',text:'Local draft recovery…',onclick:()=>showLocalDrafts().catch(errorMessage)}),rows.length?list:copy('No open JSON resources.'),copy('Inactive buffers admit at most 16 resources / 64 MiB of counted source, undo and schema text. Clean buffers can be retired at that limit. Local drafts remain separate recovery copies.')],{submit:null,cancel:'Close',wide:true});
}
async function recoverLocalDraft(row,current=()=>true){
  editorIdle();const draft=draftRecord(row.key,row.value),pack=draft.pack,path=draft.path;
  if(state.pack!==pack)await openPack(pack);if(!current())throw new DOMException('Draft recovery was cancelled.','AbortError');if(state.pack!==pack||state.catalogPack!==pack)throw new Error('Open the matching pack before recovering this draft.');
  const existing=historyEdit(pack,path);if(existing){closeDialog?.(null);await activateEdit(existing);toast('Opened the existing buffer. Its edits and undo history were kept.');return;}
  const location=editorLocation(),request=resourceLoadSequence;
  await draftQueue.settle(row.key);const[result,schema,currentDraft]=await Promise.all([api.read(pack,path).catch(error=>{if(error.status===404)return null;throw error;}),localGet('settings','schema/'+pack+'/'+category(path).id).catch(()=>null),localGet('drafts',row.key)]);
  editorIdle();if(!current())throw new DOMException('Draft recovery was cancelled.','AbortError');if(resourceLoadSequence!==request||['pack','path','owner','text','revision'].some(key=>location[key]!==editorLocation()[key]))throw new Error('The open editor changed. Review the draft again.');if(!sameDraft(currentDraft,row.expected))throw new Error('This local draft changed. Refresh drafts before recovering.');
  const resource=state.catalog.byPath.get(path);if(resource?.readOnly||resource&&!resource.editable)throw new Error('This resource is read-only.');
  const attachedSchema=schema?.text?new JsonDocument(schema.text).value:schema??null;
  stashActiveEdit();cancelPreview();schemaLoadSequence++;resourceLoadSequence++;clearTimeout(state.rawTimer);clearTimeout(state.draftTimer);if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;}
  state.bufferOwner=Symbol(path);state.selected=resource??{path,editable:true,size:draft.value.text.length};state.fieldsOpen=new Set(['']);state.text=draft.value.text;state.baseText=draft.value.baseText;state.etag=result?draft.value.baseEtag:'*';state.history=new EditHistory(state.baseText);if(state.text!==state.baseText)state.history.push(state.text);state.schema=attachedSchema;state.revision++;parseDocument();renderInspector();renderExplorer();
  toast(result?'Recovered local source. Save checks the original version against disk.':'Recovered source for an absent file. Save will require recreation review.');
}
async function showLocalDrafts(){editorIdle();flushHistory();const sequence=dialogSequence,edit=activeEdit();if(edit&&dirty()){clearTimeout(state.draftTimer);await persistEditDraft(edit);}if(dialogSequence!==sequence)throw new DOMException('Draft recovery opening was superseded.','AbortError');await draftTools.open();}
async function readPreviewResource(pack,path){const active=activeEdit(),record=active?.pack===pack&&active.path===path?active:editWorkspace.peek(pack,path);return record&&record.text!==record.baseText?{text:record.text,etag:record.etag}:api.read(pack,path);}
function previewResourceRows(){const rows=new Map(state.catalog.resources.map(row=>[row.path,row]));for(const record of editWorkspace.dirty(activeEdit(),state.pack))if(!rows.has(record.path))rows.set(record.path,{path:record.path,editable:true});return[...rows.values()];}
function referenceContext(){
  const rows=new Map(state.catalog.resources.map(row=>[row.path,row])),overrides=new Map();for(const record of editWorkspace.entries(activeEdit(),state.pack)){overrides.set(record.path,{text:record.text,etag:record.etag,owner:record.owner});rows.set(record.path,{...rows.get(record.path),path:record.path,size:undefined,readOnly:false});}
  return{pack:state.pack,listingPack:state.catalogPack,revision:state.revision,catalog:state.catalog,rows:[...rows.values()],overrides};
}
function problemContext(){const context=referenceContext();context.schemaSequence=schemaLoadSequence;context.schemaRecords=new Map(editWorkspace.entries(activeEdit(),state.pack).map(record=>[record.path,record]));context.schemaCache=new Map();context.schemaTextCache=new Map();context.schemaBytes=0;return context;}
function problemSchemaInput(context,value,{raw=false,cache=true}={}){
  if(value===null||value===undefined)return{schemaText:null};if(cache&&!raw&&context.schemaTextCache.has(value))return context.schemaTextCache.get(value);
  const text=raw?value:stringify(value),bytes=typeof text==='string'?text.length*2:Infinity;let result;
  if(bytes>PROBLEM_LIMITS.schemaBytes)result={schemaError:'Attached schema exceeds 256 KiB of counted UTF-16 text.'};else if(context.schemaBytes+bytes>PROBLEM_LIMITS.schemaTotalBytes)result={schemaError:'Captured schemas exceed the 2 MiB counted payload budget.'};else{context.schemaBytes+=bytes;result={schemaText:text};}
  if(cache&&!raw)context.schemaTextCache.set(value,result);return result;
}
async function readProblemSource(context,path){
  const opened=context.overrides.get(path),record=context.schemaRecords.get(path),source=opened??await api.read(context.pack,path);
  if(record)return{...source,...problemSchemaInput(context,record.schema),schemaSource:record.schema===null||record.schema===undefined?null:'Captured open-buffer schema'};
  const id=category(path).id;if(!context.schemaCache.has(id)){
    if(context.schemaCache.size>=PROBLEM_LIMITS.schemaCategories)return{...source,schemaError:'Captured schema category limit reached (64).',schemaSource:'Browser category schema not read'};
    context.schemaCache.set(id,localGet('settings','schema/'+context.pack+'/'+id).then(saved=>({...problemSchemaInput(context,saved?.text??saved,{raw:typeof saved?.text==='string',cache:false}),schemaSource:saved===null||saved===undefined?null:'Captured browser schema for '+id})).catch(error=>({schemaError:'Browser schema could not be read: '+error.message,schemaSource:'Browser category schema unavailable'})));
  }
  return{...source,...await context.schemaCache.get(id)};
}
async function openProblemSource(context,row){
  editorIdle();if(!problemTools.isCurrent(context))throw new Error('Source or schema inputs changed. Check JSON again.');const target=state.catalog.byPath.get(row.path)??(context.overrides.has(row.path)&&{path:row.path,editable:true});if(!target)throw new Error('The inspected resource is no longer listed.');
  await openResource(target);if(state.pack!==context.pack||state.selected?.path!==row.path)throw new Error('The selected resource changed. Check JSON again.');const captured=context.overrides.get(row.path);
  if(row.owner?state.bufferOwner!==row.owner||state.text!==captured?.text:!row.etag||state.etag!==row.etag||dirty())throw new Error('The inspected source version changed. Check JSON again.');
  revealSourceMatch({start:row.start,end:row.end},{expected:editorLocation()});
}
async function showPackProblems(){editorIdle();flushHistory();await problemTools.open();}
function editorLocation(){return{pack:state.pack,path:state.selected?.path,owner:state.bufferOwner,text:state.text,revision:state.revision};}
function revealJsonPointer(pointer='',{expected,offset,matchValue}={}){
  if(!state.selected?.editable)throw new Error('Open a JSON resource before navigating its values.');
  if(expected&&['pack','path','owner','text','revision'].some(key=>expected[key]!==editorLocation()[key]))throw new Error('The resource changed. Choose this location again.');
  const selection=jsonSelection(state.text,pointer,{offset,document:state.document});if(matchValue!==undefined&&(selection.type!=='string'||selection.value!==matchValue))throw new Error('The source value changed. Reopen resource matches.');
  showSourceSelection(selection);
}
function showSourceSelection(selection){
  let editor=$('inspector-content').querySelector('.json-editor');state.mode='json';if(!editor){renderInspector();editor=$('inspector-content').querySelector('.json-editor');}else{$('form-mode').classList.toggle('active',false);$('json-mode').classList.toggle('active',true);}
  if(!editor)throw new Error('The JSON viewer is unavailable.');selectJsonText(editor,selection,{source:state.text});
}
function revealSourceMatch(row,{expected}={}){
  if(!state.selected?.editable)throw new Error('Open a JSON resource before navigating source text.');
  if(expected&&['pack','path','owner','text','revision'].some(key=>expected[key]!==editorLocation()[key]))throw new Error('The resource changed. Search again.');
  if(!Number.isSafeInteger(row.start)||!Number.isSafeInteger(row.end)||row.start<0||row.end<row.start||row.end>state.text.length||row.value!==undefined&&state.text.slice(row.start,row.end)!==row.value)throw new Error('The matched source text changed. Search again.');
  showSourceSelection({start:row.start,end:row.end});
}
function searchEditContext(){return state.selected?.editable&&state.bufferOwner?{...editorLocation(),schema:state.schema,editable:editable()}:null;}
function applySourceReplacement(owner,plan){
  editorIdle();searchTools.editCurrent(owner);if(!editable())throw new Error('This resource is read-only.');flushHistory();setText(plan.text);revealSourceMatch(plan.first,{expected:editorLocation()});toast('Applied '+plan.count+' source replacements · unsaved changes.');
}
async function openTextSearchMatch(context,row){
  editorIdle();if(!searchTools.isCurrent(context))throw new Error('Source inputs changed. Run Search again.');const target=state.catalog.byPath.get(row.path)??(context.overrides.has(row.path)&&{path:row.path,editable:true});if(!target)throw new Error('The matching resource is no longer listed.');
  await openResource(target);if(state.pack!==context.pack||state.selected?.path!==row.path)throw new Error('The selected resource changed. Run Search again.');
  const captured=context.overrides.get(row.path);if(row.owner?state.bufferOwner!==row.owner||state.text!==captured?.text:!row.etag||state.etag!==row.etag||dirty())throw new Error('The matched source version changed. Run Search again.');
  revealSourceMatch(row,{expected:editorLocation()});
}
async function searchPackJson(){editorIdle();await searchTools.open();}
async function findReplaceSource(){editorIdle();flushHistory();await searchTools.edit();}

async function openReferenceValue(pack,row){
  editorIdle();if(state.pack!==pack)throw new Error('The pack changed. Reopen resource matches.');const target=state.catalog.byPath.get(row.path)??(editWorkspace.peek(pack,row.path)&&{path:row.path,editable:true});if(!target)throw new Error('The target resource is no longer listed.');
  await openResource(target);if(state.pack!==pack||state.selected?.path!==row.path)throw new Error('The selected resource changed. Reopen resource matches.');
  if(row.owner&&state.bufferOwner!==row.owner||!row.owner&&row.etag&&state.etag!==row.etag)throw new Error('The source version changed. Reopen resource matches.');
  if(state.selected.editable)revealJsonPointer(row.pointer??'',{matchValue:row.value});
}
async function goToJsonPointer(){
  if(!state.selected?.editable)throw new Error('Open a JSON resource first.');const expected=editorLocation(),pointer=element('input',{type:'text',value:'',placeholder:'/regions/0','aria-label':'JSON pointer'});
  await ask('Go to JSON value',[field('JSON pointer',pointer,'Empty selects the root. Escape / as ~1 and ~ as ~0 in property names.')],{submit:'Show value',read:()=>pointer.value,onSubmit:value=>revealJsonPointer(value,{expected})});
}
async function openPack(id) {
  if(id===state.pack)return;try{stashActiveEdit();}catch(error){$('pack-select').value=state.pack;throw error;}
  cancelPreview({clear:true});resourceLoadSequence++;state.proceduralSelection=null;if(['procedural-object','procedural-placement'].includes($('field-mode').value))$('field-mode').value='terrain-stage';$('field-mode').querySelector('option[value="procedural-placement"]').hidden=true;$('field-mode').querySelector('option[value="procedural-object"]').hidden=true;state.pack=id;state.bufferOwner=null;state.selected=null;state.document=null;state.history=null;state.text='';state.baseText='';state.etag='';state.schema=null;state.revision++;
  state.catalog=new ResourceCatalog();state.catalogPack=null;$('search-pack-json').disabled=true;$('pack-problems').disabled=true;renderExplorer();
  $('pack-select').value=id;await localSet('settings','last-pack',id).catch(()=>{});if(state.pack!==id)return;await refreshResources();if(state.pack!==id)return;renderInspector();message(`Opened ${id}.`);
}
async function refreshResources() {
  if(!state.pack){state.catalog=new ResourceCatalog();state.catalogPack='';renderExplorer();return;}
  const pack=state.pack,request=++catalogLoadSequence,data=await api.resources(pack);if(state.pack!==pack||request!==catalogLoadSequence)return;state.catalog=new ResourceCatalog(data.resources);state.catalogPack=pack;renderExplorer();$('search-pack-json').disabled=false;$('pack-problems').disabled=false;$('resource-count').textContent=String(data.resources.length);$('pack-status').textContent=state.pack;
  const selected=$('dimension-select').value;const dimensions=data.resources.filter(row=>row.path.startsWith('dimensions/')&&row.path.endsWith('.json'));
  $('dimension-select').replaceChildren(element('option',{value:'',text:'Select dimension'}),...dimensions.map(row=>element('option',{value:row.path,text:resourceId(row.path)})));if(dimensions.some(row=>row.path===selected))$('dimension-select').value=selected;else if(dimensions.length===1)$('dimension-select').value=dimensions[0].path;
}
function renderExplorer() {
  const tree=$('resource-tree');tree.replaceChildren();const groups=state.catalog.groups($('resource-search').value);
  if(!groups.length){tree.append(element('div',{class:'sidebar-empty',text:state.pack?'This pack has no matching resources. Import a native Iris pack or create a JSON resource.':'Open an Iris pack to explore its resources.'}));return;}
  for(const group of groups){const section=element('details',{class:'resource-group',open:true},element('summary',{},group.label,element('span',{class:'count',text:group.resources.length})));for(const row of group.resources){const active=state.selected?.path===row.path,button=element('button',{class:'resource-row'+(active?' active':''),title:row.path,onclick:()=>openResource(row).catch(errorMessage)},element('span',{class:'file-icon',text:row.editable?'{}':'◇'}),element('span',{class:'file-name',text:row.path.split('/').slice(1).join('/')||row.path}));if((active&&dirty())||(!active&&editWorkspace.peek(state.pack,row.path)?.text!==undefined&&editWorkspace.peek(state.pack,row.path).text!==editWorkspace.peek(state.pack,row.path).baseText))button.append(element('span',{class:'dirty-dot'}));if(row.readOnly||group.excluded)button.append(element('span',{class:'read-only-tag',text:'READ ONLY'}));section.append(button);}tree.append(section);}
}
async function openResource(row,{skipNavigation=false}={}) {
  if(!row)return;editorIdle();if(state.selected?.path===row.path&&!skipNavigation&&(state.bufferOwner||!row.editable))return;stashActiveEdit();
  cancelPreview();
  schemaLoadSequence++;const pack=state.pack,request=++resourceLoadSequence,current=()=>state.pack===pack&&request===resourceLoadSequence;
  clearTimeout(state.rawTimer);clearTimeout(state.draftTimer);
  if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;}
  state.bufferOwner=null;state.selected=row;state.schema=null;state.fieldsOpen=new Set(['']);state.document=null;state.history=null;state.etag='';state.text='';state.baseText='';$('inspector-content').replaceChildren(element('div',{class:'loading-skeleton',text:'Loading resource…'}));renderExplorer();updateDocumentState();
  if(!row.editable){
    renderInspector();if(/\.(?:png|jpe?g|webp)$/i.test(row.path)){const response=await api.request('resource',{query:{pack,path:row.path},raw:true}),blob=await response.blob();if(!current())return;state.objectUrl=URL.createObjectURL(blob);$('inspector-content').append(element('img',{src:state.objectUrl,alt:row.path,style:'max-width:100%;height:auto;padding:15px;image-rendering:pixelated'}));}return;
  }
  const retained=!skipNavigation?editWorkspace.take(pack,row.path):null;
  if(retained){state.bufferOwner=retained.owner;state.text=retained.text;state.baseText=retained.baseText;state.etag=retained.etag;state.history=retained.history;state.schema=retained.schema;state.revision++;parseDocument();renderInspector();renderExplorer();message('Restored open edit '+row.path+'. Disk changes are checked when saving.');return;}
  const[result,savedSchema,draft]=await Promise.all([api.read(pack,row.path),localGet('settings','schema/'+pack+'/'+category(row.path).id).catch(()=>null),localGet('drafts',pack+'/'+row.path).catch(()=>null)]);
  if(!current())return;
  editWorkspace.remove(pack,row.path);state.bufferOwner=Symbol(row.path);state.revision++;state.text=result.text;state.baseText=result.text;state.etag=result.etag;state.history=new EditHistory(result.text);state.schema=savedSchema?.text?new JsonDocument(savedSchema.text).value:savedSchema||null;
  if(draft&&draft.text!==result.text){
    const choice=element('select',{},element('option',{value:'recover',text:'Recover local draft'}),element('option',{value:'discard',text:'Discard draft and open saved file'}));const recovered=await ask('Recover local changes',[copy(`A local draft for ${row.path} was saved ${new Date(draft.savedAt).toLocaleString()}.`),copy(draft.baseEtag===result.etag?'The file on disk is unchanged.':'The file on disk has changed since this draft was created. Recovered edits will be checked for conflicts before saving.'),field('Open resource',choice)],{submit:'Open resource',read:()=>choice.value});
    if(!current())return;if(recovered===null){resetActiveEditor();renderInspector();renderExplorer();return;}
    if(recovered==='recover'){state.text=draft.text;state.history.push(draft.text);state.etag=draft.baseEtag;state.baseText=draft.baseText;}
    else await draftQueue.put(pack+'/'+row.path,undefined).catch(()=>{});
  }
  if(!current())return;parseDocument();renderInspector();renderExplorer();message(`Opened ${row.path}.`);
}
function parseDocument() {
  state.issues=[];try{state.document=new JsonDocument(state.text);state.issues.push(...state.document.issues);if(state.document.root.type!=='object')state.issues.push({pointer:'',message:'Iris resources must be JSON objects.',severity:'error'});if(state.schema!==null&&state.schema!==undefined)state.issues.push(...validateSchema(state.document,state.schema));}catch(error){state.document=null;state.issues.push({pointer:'',message:`${error.message}${error.line?` Line ${error.line}, column ${error.column}.`:''}`,offset:error.offset,severity:'error'});}
  renderValidation();updateDocumentState();
}
function renderValidation() {
  const panel=$('validation-panel');panel.replaceChildren();panel.hidden=!state.issues?.length;
  const expected=editorLocation();for(const issue of (state.issues||[]).slice(0,30))panel.append(element('button',{type:'button',class:'validation-message validation-location '+issue.severity,title:'Show JSON value',onclick:()=>{try{revealJsonPointer(issue.pointer??'',{expected,offset:issue.offset});}catch(error){errorMessage(error);}}},issue.message,element('code',{text:issue.pointer||'(root)'})));
  if((state.issues?.length||0)>30)panel.append(element('div',{class:'validation-message',text:`${state.issues.length-30} more issues.`}));
}
function updateDocumentState() {
  renderEditorTabs();const changed=dirty();$('save').disabled=editorWriteBusy||!changed||!editable()||!state.document||state.issues?.some(issue=>issue.severity==='error');$('undo').disabled=!state.history?.canUndo;$('redo').disabled=!state.history?.canRedo;$('document-state').textContent=changed?'Unsaved changes':state.selected?'Saved on disk':'No changes';$('document-state').classList.toggle('dirty',changed);$('show-references').hidden=!state.selected;$('go-to-json').disabled=!state.selected?.editable;$('find-source').disabled=!state.selected?.editable||!state.bufferOwner;$('review-changes').disabled=!state.selected?.editable||!state.bufferOwner;$('search-pack-json').disabled=!state.pack||state.catalogPack!==state.pack;$('pack-problems').disabled=!state.pack||state.catalogPack!==state.pack;
}
function scheduleDraft(){
  clearTimeout(state.draftTimer);const owner=state.bufferOwner;state.draftTimer=setTimeout(()=>{if(!owner||state.bufferOwner!==owner)return;persistEditDraft(activeEdit()).catch(()=>message('Local draft storage is unavailable. Save the resource to keep your changes.',true));},350);
}
function setText(text,{render=true,history=true}={}) { if(text===state.text)return;state.text=text;state.revision++;if(history)state.history?.push(text);parseDocument();scheduleDraft();if(render)renderInspector();renderExplorer();if($('field-mode').value.startsWith('lab-'))return;const active=state.pendingGeneration;if(state.document)scheduleGeneration(active);else cancelPreview(); }
function renderInspector() {
  const holder=$('inspector-content'),selected=$('selected-resource');holder.replaceChildren();$('resource-actions').hidden=!state.selected||!editable();$('form-mode').classList.toggle('active',state.mode==='form');$('json-mode').classList.toggle('active',state.mode==='json');
  if(!state.selected){selected.replaceChildren(element('span',{class:'resource-kind',text:'RESOURCE'}),element('strong',{text:'No resource selected'}),element('span',{class:'muted',text:'Select a resource in the explorer.'}));holder.append(element('div',{class:'inspector-empty'},element('span',{class:'outline-icon',text:'⌘'}),element('p',{text:'Configuration, without the clutter.'}),element('span',{text:'Select a JSON resource to edit its properties. Unknown fields are preserved.'})));$('validation-panel').hidden=true;updateDocumentState();return;}
  selected.replaceChildren(element('span',{class:'resource-kind',text:category(state.selected.path).label.toUpperCase()}),element('strong',{text:resourceId(state.selected.path).split('/').at(-1)}),element('span',{class:'muted',text:state.selected.path}));
  if(!state.selected.editable){holder.append(element('div',{class:'readonly-note',text:`${formatBytes(state.selected.size)} · This asset is preserved without modification. Binary assets and non-JSON resources do not use the configuration editor.`}));if(!state.selected.readOnly&&(/^(objects\/.+\.iob|images\/.+\.png)$/.test(state.selected.path)))holder.append(element('button',{class:'quiet-button compact',text:state.selected.path.startsWith('images/')?'Inspect native image':'Inspect native object',onclick:()=>inspectNativeResource().catch(errorMessage)}));updateDocumentState();return;}
  if(!editable())holder.append(element('div',{class:'readonly-note',text:'This resource is outside the terrain-authoring scope. It is preserved and shown read-only.'}));
  if(state.mode==='json'||!state.document){const owner=state.bufferOwner,pack=state.pack,path=state.selected.path;const current=()=>owner===state.bufferOwner&&pack===state.pack&&path===state.selected?.path&&holder.querySelector('.json-editor')===editor;const editor=element('textarea',{class:'json-editor',spellcheck:'false',wrap:'off','aria-label':'Resource JSON',readOnly:!editable()});editor.value=state.text;editor.addEventListener('input',()=>{if(!current())return;try{state.text=editorTextToSource(state.text,editor.value);}catch(error){editor.value=state.text;errorMessage(error);return;}state.revision++;clearTimeout(state.rawTimer);state.rawTimer=setTimeout(()=>{if(!current())return;state.history.push(state.text);parseDocument();scheduleDraft();renderExplorer();if(!$('field-mode').value.startsWith('lab-')){const active=state.pendingGeneration;if(state.document)scheduleGeneration(active);else cancelPreview();}},200);});editor.addEventListener('keydown',event=>{if(event.key==='Tab'&&editable()){event.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;editor.setRangeText('  ',start,end,'end');editor.dispatchEvent(new Event('input'));}});holder.append(editor);}
  else {holder.append(element('div',{class:'schema-badge',text:state.schema!==null&&state.schema!==undefined?'Local schema loaded · Unknown fields preserved':state.inventory?'Native field guidance · Structural JSON editing':'Structural JSON editing · Import a pinned Iris schema for field validation'}));renderObject(state.document.root,holder,0);}
  if(state.document && (findStyles(state.document).length||/^snippet\/style\//.test(state.selected?.path)))holder.prepend(element('button',{class:'quiet-button compact',text:'Preview a noise style',onclick:()=>chooseNoiseStyle({resource:true}).catch(errorMessage)}));
  if(state.document&&/^(biomes|regions)\//.test(state.selected.path))holder.prepend(element('button',{class:'quiet-button compact',text:'Preview procedural object or tree',onclick:()=>chooseProceduralPreview().catch(errorMessage)}));
  if(state.document&&state.selected?.path.startsWith('expressions/'))holder.prepend(element('button',{class:'quiet-button compact',text:'Preview this expression',onclick:()=>{state.styleSelection={pack:state.pack,path:state.selected.path,expressionResource:true};state.noiseStyle=`Expression: ${resourceId(state.selected.path)}`;$('field-mode').value='iris-style2d';$('noise-style').hidden=false;$('noise-style').textContent=state.noiseStyle;setView('map');regenerate().catch(errorMessage);}}));
  if(state.document&&state.selected?.path.startsWith('dimensions/'))holder.prepend(element('button',{class:'quiet-button compact',text:'Inspect dimension image bindings',onclick:()=>sampleDimensionBindings().catch(errorMessage)}));
  if(state.document&&/^image-maps\//.test(state.selected?.path))holder.prepend(element('button',{class:'quiet-button compact',text:'Sample this image map',onclick:()=>sampleNativeImageMap().catch(errorMessage)}));
  if(state.document&&state.selected?.path.startsWith('generators/'))holder.prepend(element('button',{class:'quiet-button compact',text:'Preview this generator',onclick:()=>{if(!state.document)return;$('field-mode').value='iris-generator';$('noise-style').hidden=true;setView('map');regenerate().catch(errorMessage);}}));
  if(state.document&&/^(dimensions|regions|biomes|generators|blocks|expressions|image-maps|imagemaps)\//.test(state.selected.path))holder.prepend(element('button',{class:'quiet-button compact',text:'Inspect native resource loading',onclick:()=>inspectNativeResource().catch(errorMessage)}));
  if(state.document&&editable())holder.prepend(element('button',{class:'quiet-button compact',text:'Load matching native schema',onclick:()=>loadMatchingNativeSchema().catch(errorMessage)}));
  renderValidation();updateDocumentState();
}
async function loadMatchingNativeSchema(){
  const pack=state.pack,path=state.selected?.path,revision=state.revision;if(!pack||!path)return;const request=++schemaLoadSequence,current=()=>request===schemaLoadSequence&&pack===state.pack&&path===state.selected?.path&&revision===state.revision;
  message('Checking the native schema against the saved pack…');
  const {schema,manifest}=await loadNativePackSchema(path,state.catalog.resources,async name=>{const response=await api.request('resource',{method:'HEAD',query:{pack,path:name},raw:true});return response.headers.get('etag');},{current,headers:api.token?{Authorization:'Bearer '+api.token}:{}});if(!current())return;
  state.schema=schema;parseDocument();renderInspector();toast(`Loaded native schema for the matching saved pack${manifest.warningCount?' · '+manifest.warningCount+' native metadata warnings':''}.`);
}
async function importLocalSchema(file){
  if(!state.selected?.editable||!state.document)throw new Error('Open a JSON resource before importing its schema.');
  if(file.size>JSON_LIMIT)throw new Error('Schema exceeds 8 MiB.');
  const pack=state.pack,path=state.selected.path,revision=state.revision,request=++schemaLoadSequence,current=()=>request===schemaLoadSequence&&pack===state.pack&&path===state.selected?.path&&revision===state.revision;
  const text=await file.text(),document=new JsonDocument(text);if(document.issues.length)throw new Error('Schema contains duplicate properties.');
  if(document.root.type!=='object'&&document.root.type!=='boolean')throw new Error('Import a JSON Schema object or boolean.');
  if(!current())throw new Error('The resource changed. Import this schema again.');
  const save=schemaSaveQueue.catch(()=>{}).then(async()=>{if(current())await localSet('settings','schema/'+pack+'/'+category(path).id,{formatVersion:1,text});});schemaSaveQueue=save;await save;
  if(!current())throw new Error('The resource changed. Open it again to use its saved schema.');
  state.schema=document.value;parseDocument();renderInspector();toast('Loaded local schema for '+category(path).label);
}
function imageMapDetails(resource){
  if(!resource.mapType)return[];
  return[copy(`${resource.mapType} · ${resource.sampling} · outside: ${resource.outOfBounds} · alpha: ${resource.alphaPolicy}`),copy(`${resource.sourceColorMode} source · ${resource.sourceBitDepth}-bit · ${resource.sourceChannels} channels · alpha ${resource.minimumAlpha}–${resource.maximumAlpha}`),copy(`${resource.clippedPixelCount} clipped pixels · ${resource.unknownColorPixelCount} unknown-color pixels`)];
}
async function sampleDimensionBindings(){
  if(!state.pack||!state.selected?.path.startsWith('dimensions/'))return;
  flushHistory();parseDocument();if(!state.document)throw new Error('Correct this JSON before inspecting its dimension bindings.');
  cancelPreview();const pack=state.pack,path=state.selected.path,revision=state.revision,request=++previewRequest,current=()=>request===previewRequest&&pack===state.pack&&revision===state.revision&&path===state.selected?.path;
  const input=element('textarea',{'aria-label':'Binding world coordinates',rows:5,spellcheck:'false'});input.value='0, 0';
  const points=await ask('Sample dimension image bindings',[copy('Enter up to sixteen world X, Z pairs, one per line. The current unsaved dimension and other open edits and saved pack resources are used.'),field('World X, Z',input)],{submit:'Inspect',read:()=>{
    const lines=input.value.trim().split(/\r?\n/);if(lines.length>16)throw new Error('Use at most sixteen coordinate pairs.');
    return lines.map(line=>{const parts=line.trim().split(/[,\s]+/);if(parts.length!==2||parts.some(part=>!part||!Number.isFinite(Number(part))))throw new Error('Each line needs two finite numbers: X, Z.');return parts.map(Number);});
  }});if(!points||!current())return;
  message('Resolving native dimension image bindings…');
  const snapshot=await captureNativePack(previewResourceRows(),name=>readPreviewResource(pack,name),{readBinary:name=>api.readBinary(pack,name),current,override:{path,text:state.text}});if(!current())return;
  const result=await generation.sampleDimensionImageMaps(snapshot,resourceId(path),points);if(!current())return;
  const bindings=result.dimension.bindings.map(binding=>`${binding.key}: ${binding.application} ← ${binding.map} (${binding.sourceWidth} × ${binding.sourceHeight})\n  ${binding.sampling} · ${binding.outOfBounds} · ${binding.masks.length} masks`);
  const samples=result.samples.map(sample=>{
    if(sample.error)return`${sample.x}, ${sample.z}: ${sample.error}`;
    const values=sample.bindings.map(binding=>{const value=binding.sample,raw=value.type==='COLOR_MAP'?`target ${value.target??'(none)'}`:`normalized ${value.normalized}${value.worldHeight===undefined?'':` · mapped world Y ${value.worldHeight}`}`;return`  ${binding.key}: mask ${binding.maskWeight}${binding.categoricalSelected===undefined?'':` · selected ${binding.categoricalSelected?'yes':'no'}`} · ${raw}`;});
    return`${sample.x}, ${sample.z}:\n  Region override: ${sample.regionOverride??'(none)'}\n  Biome override: ${sample.biomeOverride??'(none)'}\n  Surface block override: ${sample.surfaceBlockOverride??'(none)'}\n${values.join('\n')}`;
  });
  await ask('Native dimension image bindings',[copy(`${result.dimension.bindings.length} bindings · minimum world Y ${result.dimension.minimumWorldY}`),element('pre',{class:'modal-copy',text:bindings.length?bindings.join('\n\n'):'This dimension declares no image bindings.'}),element('pre',{class:'modal-copy',text:samples.join('\n\n')}),copy('Overrides show native binding results. Procedural fallback and later terrain stages are not evaluated here. Mapped heights are raw map heights before terrain blending.')],{submit:null,cancel:'Close'});if(current())message('Native dimension image binding inspection finished.');
}
async function sampleNativeImageMap(){
  if(!state.pack||!state.selected?.path.startsWith('image-maps/'))return;
  flushHistory();parseDocument();if(!state.document)throw new Error('Correct this JSON before sampling its native image map.');
  cancelPreview();const pack=state.pack,path=state.selected.path,revision=state.revision,request=++previewRequest,current=()=>request===previewRequest&&pack===state.pack&&revision===state.revision&&path===state.selected?.path;
  const input=element('textarea',{'aria-label':'World coordinates',rows:5,spellcheck:'false'});input.value='0, 0';
  const points=await ask('Sample native image map',[copy('Enter up to sixteen world X, Z pairs, one per line. The current unsaved map and saved image resources are used.'),field('World X, Z',input)],{submit:'Sample',read:()=>{
    const lines=input.value.trim().split(/\r?\n/);if(lines.length>16)throw new Error('Use at most sixteen coordinate pairs.');
    return lines.map(line=>{const parts=line.trim().split(/[,\s]+/);if(parts.length!==2||parts.some(part=>!part||!Number.isFinite(Number(part))))throw new Error('Each line needs two finite numbers: X, Z.');return parts.map(Number);});
  }});if(!points||!current())return;
  message('Sampling the native image map…');
  const snapshot=await captureNativePack(previewResourceRows(),name=>readPreviewResource(pack,name),{readBinary:name=>api.readBinary(pack,name),current,override:{path,text:state.text}});if(!current())return;
  const result=await generation.sampleImageMap(snapshot,resourceId(path),points);if(!current())return;
  const rows=result.samples.map(sample=>{
    if(sample.error)return`${sample.x}, ${sample.z}: ${sample.error}`;
    const value=sample.type==='COLOR_MAP'?`target: ${sample.target??'(none)'}`:`normalized: ${sample.normalized}${sample.worldHeight===undefined?'':` · world Y: ${sample.worldHeight}`}`;
    return`${sample.x}, ${sample.z}: ${value}\n  inside source: ${sample.insideSource?'yes':'no'} · filter kernel inside: ${sample.samplingKernelInsideSource?'yes':'no'}`;
  });
  await ask('Native image-map samples',[...imageMapDetails(result.resource),element('pre',{class:'modal-copy',text:rows.join('\n\n')}),copy('Bounds describe the transformed source and sampling kernel before the configured outside behavior is applied.')],{submit:null,cancel:'Close'});if(current())message('Native image-map sampling finished.');
}
async function inspectNativeResource(){
  if(!state.selected||!state.pack)return;if(state.selected.editable){flushHistory();parseDocument();if(!state.document)throw new Error('Correct this JSON before loading its native resource.');}
  cancelPreview();const pack=state.pack,path=state.selected.path,revision=state.revision,request=++previewRequest,current=()=>request===previewRequest&&pack===state.pack&&revision===state.revision&&path===state.selected?.path;
  message('Loading the native pack snapshot…');
  const snapshot=await captureNativePack(previewResourceRows(),name=>readPreviewResource(pack,name),{readBinary:name=>api.readBinary(pack,name),current,override:state.selected.editable?{path,text:state.text}:null});if(!current())return;
  const result=await generation.inspectPack(snapshot,path.split('/')[0],path.endsWith('.iob')?path.slice(8,-4):path.endsWith('.png')?path.slice(7,-4):resourceId(path));if(!current())return;
  await ask('Native resource loading',[copy(result.resource.found?`Loaded ${result.resource.type} “${result.resource.key}” from ${result.resources} pack resources.`:'The native resource could not be resolved.'),copy(state.selected.editable?'The current unsaved resource is included. Other open edits are included; remaining resources use saved contents.':'Binary asset bytes are read from the saved pack.'),...(result.resource.width?[copy(`${result.resource.width} × ${result.resource.height} · ${result.resource.colorMode} · ${result.resource.bitDepth}-bit · ${result.resource.channels} channels`)]:[]),...(result.resource.sampleBands?[copy('Raw source bands · up to eight pixels'),element('pre',{class:'modal-copy',text:result.resource.sampleBands.map(row=>`${row[0]}, ${row[1]}: [${row.slice(2).join(', ')}]`).join('\n')})]:[]),...imageMapDetails(result.resource),...(result.resource.contentHash?[copy(`${result.resource.sourceWidth} × ${result.resource.sourceHeight} source pixels`),element('pre',{class:'modal-copy',text:`Native decoded source: ${result.resource.sourceHash}\nCompiled image map: ${result.resource.contentHash}`})]:[]),...(result.resource.dimensions?[copy(`${result.resource.dimensions.join(' × ')} · ${result.resource.blockCount} blocks`),element('pre',{class:'modal-copy',text:result.resource.blocks.map(block=>`${block.slice(0,3).join(', ')}: ${block[3]}`).join('\n')}),copy('Showing up to 32 stored blocks. Object placement and tile-entity payloads are unfinished.')]:[]),copy(result.resource.excluded?'The native compatibility gate excluded this resource.':'The native compatibility gate did not exclude this resource.'),...((result.resource.findings||[]).length?[element('pre',{class:'modal-copy',text:result.resource.findings.join('\n')})]:[]),element('div',{class:'info-box',text:'Native content gating and load-time pools are evaluated in the browser. Complete terrain generation and production qualification remain unfinished.'})],{submit:null,cancel:'Close'});message('Native resource inspection finished.');
}
async function chooseProceduralPreview(){
  if(!state.pack||!state.selected?.editable)return;flushHistory();parseDocument();if(!state.document)throw new Error('Correct this JSON before previewing its procedural entries.');
  cancelPreview();const pack=state.pack,path=state.selected.path,revision=state.revision,request=++previewRequest,current=()=>request===previewRequest&&pack===state.pack&&revision===state.revision&&path===state.selected?.path;
  message('Reading native procedural entries…');const snapshot=await captureNativePack(previewResourceRows(),name=>readPreviewResource(pack,name),{readBinary:name=>api.readBinary(pack,name),current,override:{path,text:state.text}});if(!current())return;
  const info=await generation.inspectPack(snapshot,path.split('/')[0],resourceId(path));if(!current())return;
  const entries=info.resource.proceduralObjects||[];if(!entries.length){toast('This resource has no natural procedural object or tree entries.');return;}
  const select=element('select',{},...entries.map((entry,i)=>element('option',{value:String(i),text:`${entry.family} · ${entry.name} · seed ${entry.seed}`}))),variant=element('input',{type:'number',min:'0',max:String(Math.min(entries[0].variants,8)-1),step:'1',value:'0',required:true});select.addEventListener('change',()=>{variant.max=String(Math.min(entries[Number(select.value)].variants,8)-1);variant.value='0';});
  const previewMode=element('select',{},element('option',{value:'procedural-object',text:'Isolated variant'}),element('option',{value:'procedural-placement',text:'Single placement on terrain'}));
  const choice=await ask('Preview native procedural variant',[copy('Uses the entry’s configured seed for its baked variants. Isolated mode uses local object coordinates. Automatic scatter and cross-source collision replay remain unfinished.'),field('Preview mode',previewMode),copy('Single placement uses the selected dimension and world seed for terrain and its standalone placement RNG. It attempts one object at the chunk centre; automatic scatter and cross-source collision replay remain unfinished. Native structure obstacles are not included. Native state rotation is connected for this development preview. Procedural entries retain their native placement settings. Tile payloads remain unavailable.'),field('Native entry',select),field('Baked variant index (starting at 0)',variant),copy('Preview pools are limited to eight variants. Block assets are required for 3D rendering.')],{submit:'Preview',read:()=>({entry:entries[Number(select.value)],variant:Number(variant.value),mode:previewMode.value})});if(!choice||!current())return;
  const option=$('field-mode').querySelector('option[value="'+choice.mode+'"]');option.hidden=false;state.proceduralSelection={pack,path,family:choice.entry.family,index:choice.entry.index,variant:choice.variant,name:choice.entry.name};$('field-mode').value=choice.mode;$('noise-style').hidden=true;setView('world');await regenerate();
}
function renderObject(node,holder,depth,editOwner={pack:state.pack,path:state.selected?.path,revision:state.revision,text:state.text}) {
  if(editable())holder.append(element('div',{class:'collection-actions'},element('button',{class:'text-button',text:node.pointer?'Edit '+node.type+'…':'Edit resource JSON…',onclick:()=>jsonTools.actions(node,editOwner).catch(errorMessage)}),element('button',{class:'add-property',text:node.type==='array'?'+ Insert entry':'+ Add property',onclick:()=>jsonTools.add(node,editOwner).catch(errorMessage)})));
  if(depth>12){holder.append(element('div',{class:'readonly-note',text:'Use JSON view to edit deeper nested properties.'}));return;}
  const entries=node.children;if(entries.length>300){holder.append(element('div',{class:'readonly-note',text:'This collection has more than 300 entries. Use JSON view to keep editing responsive.'}));return;}
  const fields=element('div',{class:'property-fields'});
  for(const child of entries){const key=pointerParts(child.pointer).at(-1),rule={...fieldHint(state.inventory,state.selected.path,pointerParts(child.pointer)),...propertySchema(state.schema,pointerParts(child.pointer))};
    if(child.type==='object'||child.type==='array'){const group=element('details',{class:'property-group'+(depth?' nested':''),open:state.fieldsOpen.has(child.pointer)},element('summary',{},pretty(key),element('span',{class:'property-type',text:child.type==='array'?`${child.value.length} entries`:'Object'})));let drawn=false;const fill=()=>{if(!drawn){drawn=true;renderObject(child,group,depth+1,editOwner);}};group.addEventListener('toggle',()=>{if(group.open){state.fieldsOpen.add(child.pointer);fill();}else state.fieldsOpen.delete(child.pointer);});if(group.open)fill();holder.append(group);continue;}
    const label=element('label',{text:pretty(key),title:rule.description||child.pointer});let input;
    if(rule.enum){input=element('select',{disabled:!editable()});for(let i=0;i<rule.enum.length;i++)input.append(element('option',{value:i,text:String(rule.enum[i])}));input.selectedIndex=rule.enum.findIndex(value=>String(value)===String(child.value));if(input.selectedIndex<0){input.prepend(element('option',{value:'-1',text:String(child.value)+' (current value)'}));input.value='-1';}input.addEventListener('change',()=>{if(input.value==='-1')return;changeField(child,child.type==='number'?new JsonNumber(String(rule.enum[input.value])):rule.enum[input.value],editOwner);});}
    else if(child.type==='boolean'){input=element('input',{type:'checkbox',checked:child.value,disabled:!editable(),'aria-label':pretty(key)});input.addEventListener('change',()=>changeField(child,input.checked,editOwner));}
    else{input=element('input',{type:'text',value:child.type==='null'?'null':String(child.value),class:child.type==='number'?'number-input':'',readOnly:!editable(),spellcheck:'false','aria-label':pretty(key),...(child.type==='number'?{inputmode:'decimal'}:{})});input.addEventListener('change',()=>{try{const value=child.type==='number'?new JsonNumber(input.value.trim()):child.type==='null'?new JsonDocument(input.value).value:input.value;changeField(child,value,editOwner);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}});input.addEventListener('input',()=>input.setCustomValidity(''));}
    const row=element('div',{class:'property-row'},label,input);if(child.type==='string'){const matches=state.catalog.candidates(child.value);if(matches.length===1&&matches[0].path!==state.selected.path){const control=element('div',{class:'reference-control'},input,element('button',{title:`Open matching resource: ${matches[0].path}`,text:'↗',onclick:()=>openResource(matches[0]).catch(errorMessage)}));row.replaceChild(control,input);}}
    if(editable()){row.classList.add('with-json-actions');row.append(element('button',{class:'json-value-actions',text:'…',title:'Edit, rename, remove or reorder '+child.pointer,'aria-label':'Actions for '+child.pointer,onclick:()=>jsonTools.actions(child,editOwner).catch(errorMessage)}));}
    fields.append(row);
  }
  if(fields.childNodes.length)holder.append(fields);
}
function changeField(node,value,owner){try{if(!editable()||!state.document?.nodes.has(node.pointer)||(owner?owner.pack!==state.pack||owner.path!==state.selected?.path||owner.revision!==state.revision||owner.text!==state.text:state.document.nodes.get(node.pointer)!==node))throw new Error('The selected JSON changed. Open this field again.');setText(state.document.replace(node.pointer,value));}catch(error){errorMessage(error);}}
async function commitSavedEdit(snapshot,result){
  let record;
  if(state.pack===snapshot.pack&&state.selected?.path===snapshot.path&&state.bufferOwner===snapshot.owner){state.baseText=snapshot.text;state.etag=result.etag;record=activeEdit();updateDocumentState();renderExplorer();}
  else if(editWorkspace.saved(snapshot,result))record=editWorkspace.peek(snapshot.pack,snapshot.path);
  if(record)await persistEditDraft(record).catch(()=>message('Saved on disk, but local draft cleanup failed. Open edits remain available.',true));
}
async function saveResource(){
  editorIdle();flushHistory();parseDocument();const initial=activeEdit();if(!initial)throw new Error('Open an editable JSON resource before saving.');if(validateEdit(initial,{allowCreate:initial.etag==='*'}).length)throw new Error('Resolve configuration errors before saving.');if(!dirty())return true;
  editorWriteBusy=true;updateDocumentState();let createAuthorized=false;
  try{
    for(;;){const snapshot=activeEdit();if(snapshot?.owner!==initial.owner)throw new Error('The active resource changed during saving.');if(snapshot.etag==='*'&&!createAuthorized){const review=await resolveConflict(snapshot);if(!review)return false;createAuthorized=!!review.create;continue;}const issues=validateEdit(snapshot,{allowCreate:createAuthorized});if(issues.length)throw new Error(issues[0].message);if(snapshot.text===snapshot.baseText)return true;
      try{const result=await api.save(snapshot.pack,snapshot.path,snapshot.text,snapshot.etag);await commitSavedEdit(snapshot,result);toast('Saved '+snapshot.path+(dirty()?' · newer edits remain unsaved':''));await refreshResources().catch(error=>message('Resource saved; listing refresh failed: '+error.message,true));return true;}
      catch(error){if(error.status!==409)throw error;const review=await resolveConflict(snapshot);if(!review)return false;createAuthorized=!!review.create;}
    }
  }finally{editorWriteBusy=false;updateDocumentState();}
}
async function resolveConflict(snapshot=activeEdit()){
  const live=activeEdit();if(!snapshot||live?.owner!==snapshot.owner||live.pack!==snapshot.pack||live.path!==snapshot.path)throw new Error('The conflicting edit changed. Open it again.');return changeTools.open({conflict:true});
}
function applyDiskReview({stamp,disk,text,mode,conflict=false}){
  if(!conflict)editorIdle();changeTools.current(stamp);if(!editable())throw new Error('This resource is read-only.');
  if(mode==='merged'){const issues=validateEdit({...stamp,text,etag:disk?.etag??'*'},{allowCreate:!disk});if(issues.length)throw new Error(issues[0].message);}
  flushHistory();state.baseText=disk?.text??'';state.etag=disk?.etag??'*';setText(text);scheduleDraft();updateDocumentState();renderExplorer();
}
async function reviewResourceChanges(){editorIdle();flushHistory();await changeTools.open();}
async function saveReport(pack,rows){
  const list=element('ul',{class:'modal-list'});for(const row of rows)list.append(element('li',{},element('div',{class:'list-info'},element('strong',{text:row.record.path}),element('small',{text:row.status})),element('button',{type:'button',class:'text-button',text:'Open',onclick:async()=>{closeDialog?.(null);try{await activateEdit(row.record);}catch(error){errorMessage(error);}}})));
  await ask('Save all · '+pack,[copy('Each file uses its own version check, atomic save and backup. A partial save is reported per resource; it is not a multi-file transaction.'),list],{submit:null,cancel:'Close',wide:true});
}
async function saveAllResources(){
  editorIdle();if(!state.pack)throw new Error('Open a pack before saving its edits.');flushHistory();if(state.selected?.editable&&state.bufferOwner)parseDocument();const pack=state.pack,records=editWorkspace.dirty(activeEdit(),pack).map(record=>({...record}));if(!records.length){toast('No open changes in this pack.');return;}
  const rows=records.map(record=>({record,issues:validateEdit(record),status:'Not attempted'}));
  if(rows.some(row=>row.issues.length)){for(const row of rows)row.status=row.issues.length?'Invalid: '+row.issues[0].message:'Not saved: correct invalid open resources first.';await saveReport(pack,rows);return;}
  editorWriteBusy=true;updateDocumentState();let saved=0;
  try{for(const row of rows){
    try{const result=await api.save(pack,row.record.path,row.record.text,row.record.etag);await commitSavedEdit(row.record,result);const current=activeEdit()?.owner===row.record.owner?activeEdit():editWorkspace.peek(row.record.pack,row.record.path);row.status='Saved captured version'+(current?.owner===row.record.owner&&current.text!==row.record.text?' · newer edits remain unsaved':'');saved++;}
    catch(error){row.status=error.status===409?'Conflict: open this resource and Save to review the disk version.':'Failed: '+error.message;if(error.status!==409)break;}
  }await refreshResources().catch(error=>message('Save results are retained; listing refresh failed: '+error.message,true));}
  finally{editorWriteBusy=false;updateDocumentState();renderExplorer();}
  toast('Saved '+saved+' of '+records.length+' captured resources in '+pack+'.'+(editWorkspace.dirty(activeEdit(),pack).length?' Open changes remain.':''),saved!==records.length);await saveReport(pack,rows);
}
async function duplicateResource(){
  editorIdle();if(!editable())return;flushHistory();const source=activeEdit(),target=element('input',{value:source.path.replace(/\.json$/i,'-copy.json'),required:true});
  const result=await ask('Duplicate resource',[copy('The copy includes the current edits. The original and other open resources remain unchanged.'),field('New resource path',target)],{submit:'Duplicate',read:()=>target.value.trim()});if(!result)return;editorIdle();
  if(activeEdit()?.owner!==source.owner||state.text!==source.text)throw new Error('The source edit changed. Duplicate it again.');await api.save(source.pack,result,source.text,'*');
  if(state.pack===source.pack){await refreshResources();if(state.bufferOwner===source.owner&&state.text===source.text)await openResource(state.catalog.byPath.get(result));}toast('Created '+source.pack+'/'+result);
}
async function renameResource(){
  if(!editable()||!await confirmNavigation())return;const source=activeEdit(),target=element('input',{value:source.path,required:true});
  const result=await ask('Rename resource',[copy('Review possible references before renaming. References in saved files and open edits are not rewritten automatically.'),field('New resource path',target)],{submit:'Rename',read:()=>target.value.trim()});if(!result||result===source.path)return;editorIdle();
  if(activeEdit()?.owner!==source.owner||state.text!==source.text)throw new Error('The source changed. Rename it again.');editorWriteBusy=true;updateDocumentState();
  try{if(!await referenceTools.mutationWarning(source,{submit:'Rename anyway',description:'Review incoming string matches before renaming '+source.path+'.'}))return;if(activeEdit()?.owner!==source.owner||state.text!==source.text)throw new Error('The source changed. Rename it again.');let renamed;try{renamed=await api.operation(source.pack,{type:'rename',path:source.path,target:result,etag:source.etag});}catch(error){if(error.status!==409||!error.details?.references)throw error;if(!await confirmReferences(error.details.references,'Rename anyway'))return;renamed=await api.operation(source.pack,{type:'rename',path:source.path,target:result,etag:source.etag,confirmReferences:true});}
    editWorkspace.remove(source.pack,source.path);await draftQueue.put(source.pack+'/'+source.path,undefined).catch(()=>{});state.selected={...state.selected,path:result};state.baseText=source.text;state.etag=renamed.etag;state.revision++;parseDocument();renderInspector();await persistEditDraft(activeEdit()).catch(()=>{});await refreshResources();toast('Renamed '+result+'. Review references to its old identifier.');
  }finally{editorWriteBusy=false;updateDocumentState();renderExplorer();}
}
async function confirmReferences(references,submit){return await ask('Possible resource references',[copy('These string values match this resource identifier. They may need updating. Unknown fields will remain unchanged.'),element('ul',{class:'modal-list'},references.slice(0,40).map(ref=>element('li',{},element('div',{class:'list-info'},element('strong',{text:ref.path}),element('small',{text:ref.pointer})))) )],{submit});}
async function deleteResource(){
  editorIdle();if(!editable())return;const source=activeEdit();
  editorWriteBusy=true;updateDocumentState();try{
    if(!await referenceTools.mutationWarning(source,{submit:'Delete resource',always:true,description:'Delete '+source.path+'? The saved file is backed up before removal. Current unsaved edits to this resource will be discarded.'}))return;if(activeEdit()?.owner!==source.owner||state.text!==source.text)throw new Error('The resource changed. Delete it again.');
    try{await api.operation(source.pack,{type:'delete',path:source.path,etag:source.etag});}catch(error){if(error.status!==409||!error.details?.references)throw error;if(!await confirmReferences(error.details.references,'Delete anyway'))return;await api.operation(source.pack,{type:'delete',path:source.path,etag:source.etag,confirmReferences:true});}
    editWorkspace.remove(source.pack,source.path);clearTimeout(state.draftTimer);clearTimeout(state.rawTimer);
    if(state.text===source.text){resetActiveEditor();renderInspector();await draftQueue.put(source.pack+'/'+source.path,undefined).catch(()=>{});}
    else{state.baseText='';state.revision++;parseDocument();await persistEditDraft(activeEdit()).catch(()=>{});}
    await refreshResources();renderInspector();toast('Deleted '+source.path+(state.bufferOwner===source.owner?' · newer local edits remain open; duplicate them to create a new file.':''));
  }finally{editorWriteBusy=false;updateDocumentState();renderExplorer();}
}
async function createResource(){
  editorIdle();if(!state.pack){toast('Open or create a pack first.');return;}const pack=state.pack,initialOwner=state.bufferOwner,target=element('input',{placeholder:'biomes/new-biome.json',required:true}),template=element('select',{},element('option',{value:'',text:'Enter JSON manually'}),...state.catalog.resources.filter(row=>row.editable&&!category(row.path).excluded).map(row=>element('option',{value:row.path,text:row.path}))),source=element('textarea',{spellcheck:'false'});source.value='{}';let sequence=0,active=true;
  template.addEventListener('change',async()=>{const path=template.value,request=++sequence;if(!path)return;try{const result=await readPreviewResource(pack,path);if(active&&request===sequence&&state.pack===pack)source.value=result.text;}catch(error){if(active)errorMessage(error);}});
  let result;try{result=await ask('Create JSON resource',[copy('Use a real Iris resource as a template or enter configuration from the pinned schema. Empty JSON is not an engine-valid template.'),field('Resource path',target),field('Template',template),field('Configuration',source)],{submit:'Create resource',read:()=>({path:target.value.trim(),text:source.value}),onSubmit:async value=>{editorIdle();if(state.pack!==pack)throw new Error('The pack changed. Create this resource again.');const doc=new JsonDocument(value.text);if(doc.root.type!=='object'||doc.issues.length)throw new Error('Enter a JSON resource object without duplicate properties.');await api.save(pack,value.path,value.text,'*');}});}finally{active=false;sequence++;}
  if(result&&state.pack===pack){await refreshResources();if(state.bufferOwner===initialOwner)await openResource(state.catalog.byPath.get(result.path));toast('Created '+result.path);}
}
function historyEdit(pack,path){const active=activeEdit();return active?.pack===pack&&active.path===path?active:editWorkspace.peek(pack,path)??null;}
async function restoreHistoryVersion({pack,path,row,backup,disk,snapshot,replace}){
  editorIdle();if(state.pack!==pack||category(path).excluded||state.catalog.byPath.get(path)?.readOnly)throw new Error('The restore destination is unavailable or read-only.');
  if(state.selected?.path===path&&state.selected.editable&&!state.bufferOwner)throw new Error('Wait for this resource to finish loading, then review the saved version again.');
  if(!sameEdit(snapshot,historyEdit(pack,path)))throw new Error('The open edit changed. Review this version again.');
  editorWriteBusy=true;updateDocumentState();renderEditorTabs();let result;
  try{
    result=await api.request('restore',{method:'POST',query:{pack,path},headers:{'Content-Type':'application/json',[disk?'If-Match':'If-None-Match']:disk?.etag??'*'},body:JSON.stringify({id:row.id,backupEtag:backup.etag})});
    const current=historyEdit(pack,path),plan=restoreEditPlan(snapshot,current,backup,result,{replace});let warning='';
    if(plan){
      if(state.bufferOwner===current.owner&&state.pack===pack&&state.selected?.path===path){
        flushHistory();clearTimeout(state.draftTimer);state.text=plan.text;state.baseText=plan.baseText;state.etag=plan.etag;if(state.history?.text!==state.text)state.history?.push(state.text);state.revision++;parseDocument();renderInspector();renderExplorer();cancelPreview();
      }else{
        const history=new EditHistory(current.text,current.history?.maxBytes);if(current.history)Object.assign(history,{entries:current.history.entries.slice(),index:current.history.index});if(history.text!==plan.text)history.push(plan.text);
        try{editWorkspace.stash({...current,...plan,history});}catch(error){warning=' Open buffer kept with its earlier disk version: '+error.message;}
      }
      if(!warning)await persistEditDraft(historyEdit(pack,path)).catch(()=>{warning=' Local draft storage failed; the open edit remains in memory.';});
    }
    await refreshResources().catch(error=>{warning+=' Resource listing refresh failed: '+error.message;});
    toast('Restored '+path+(plan?.preserved?' · open text remains unsaved':'')+warning,!!warning);return result;
  }finally{editorWriteBusy=false;updateDocumentState();renderEditorTabs();}
}
async function showHistory(){editorIdle();if(!state.selected?.editable)throw new Error('Open a JSON resource before viewing its history.');await historyTools.open(state.selected.path);}
async function showReferences(){editorIdle();if(!state.selected)return;await referenceTools.open(state.selected.path);}
async function showPackHistory(){editorIdle();await historyTools.open();}
async function packMenu(){editorIdle();const choice=element('select',{},element('option',{value:'create',text:'Create an empty pack folder'}),element('option',{value:'zip',text:'Import a pack ZIP'}),element('option',{value:'directory',text:'Import a local folder'}),element('option',{value:'export',text:'Export the current pack'}),element('option',{value:'history',text:'Pack history and deleted resources'}));const result=await ask('Pack actions',field('Action',choice),{read:()=>choice.value});if(result==='history')await showPackHistory();if(result==='zip')$('pack-file').click();if(result==='directory')$('pack-directory').click();if(result==='create'){const id=element('input',{required:true,pattern:'[A-Za-z0-9][A-Za-z0-9_-]{0,63}',placeholder:'my-terrain-pack'});const name=await ask('Create pack folder',[copy('This creates an empty pack directory. Add real Iris resources from a native pack or the pinned schema.'),field('Pack name',id)],{submit:'Create folder',read:()=>id.value.trim(),onSubmit:async value=>api.request('packs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:value})})});if(name)await loadPacks(name);}if(result==='export'){editorIdle();if(!state.pack)throw new Error('Open a pack before exporting.');const pack=state.pack;if(editWorkspace.dirty(activeEdit(),pack).length){const mode=element('select',{},element('option',{value:'save',text:'Save all open changes before exporting'}),element('option',{value:'saved',text:'Export saved files only'}));const choice=await ask('Export pack with open edits',[copy('Pack ZIP export reads saved files. Open unsaved buffers are kept in this browser.'),field('Export contents',mode)],{read:()=>mode.value});if(!choice)return;if(choice==='save'){await saveAllResources();if(editWorkspace.dirty(activeEdit(),pack).length)throw new Error('Open changes remain unsaved. Resolve them before exporting, or choose saved files only.');}}if(state.pack!==pack)throw new Error('The pack changed. Export it again.');download(await api.export(pack),pack+'.zip');toast('Exported the saved pack.');}}
async function importedPack(result,{open,current=()=>true}){
  const sequence=dialogSequence;try{await loadPacks();if(open&&current()&&dialogSequence===sequence)await openPack(result.id);toast('Imported '+result.id+(open?'':'. Select it from the pack list.'));}catch(error){toast('Imported '+result.id+', but opening/refreshing the pack list failed: '+error.message,true);}
}
async function importArchive(file){editorIdle();await importTools.open('zip',file);}
async function importDirectory(files){editorIdle();if(files.length)await importTools.open('folder',files);}

function scalarMode(){return $('field-mode').value==='procedural-object'||$('field-mode').value.startsWith('lab-')||$('field-mode').value.startsWith('iris-');}
async function chooseNoiseStyle({resource=false}={}){
  const available=await generation.info(),choices=element('select');
  const candidates=state.document?findStyles(state.document).filter(candidate=>!(state.selected?.path.startsWith('expressions/')&&candidate.pointer==='')):[];if(state.document&&/^snippet\/style\//.test(state.selected?.path)&&!candidates.some(candidate=>candidate.pointer===''))candidates.unshift({pointer:'',value:state.document.value,style:typeof state.document.value.style==='string'?state.document.value.style:'Inline style'});
  if(resource&&!candidates.length)throw new Error('This resource contains no inline noise-style objects.');
  if(!resource)for(const style of available.styles)choices.append(element('option',{value:'preset:'+style,text:style}));
  candidates.forEach((item,index)=>choices.append(element('option',{value:'resource:'+index,text:`${state.selected.path} ${item.pointer||'/'} · ${item.style}`})));
  if(state.noiseStyle&&!resource)choices.value='preset:'+state.noiseStyle;
  const choice=await ask('Preview Iris noise style',[copy('Evaluate the actual Iris NoiseStyle or inline IrisGeneratorStyle. This view shows the style itself; it does not include a dimension or generator layer. Native/browser qualification remains pending.'),field('Style',choices)],{submit:'Preview style',read:()=>choices.value});
  if(!choice)return false;
  if(choice.startsWith('resource:')){const candidate=candidates[Number(choice.slice(9))];state.styleSelection={pack:state.pack,path:state.selected.path,pointer:candidate.pointer};state.noiseStyle=candidate.style;}
  else{state.styleSelection=null;state.noiseStyle=choice.slice(7);}
  if(!$('field-mode').value.startsWith('iris-style'))$('field-mode').value='iris-style2d';
  $('noise-style').hidden=false;$('noise-style').textContent=state.styleSelection?'Selected resource style':state.noiseStyle;setView('map');persistPreview();await regenerate();return true;
}
function captureSavedView(kind){
  const pack=state.pack;if(pack&&state.catalogPack!==undefined&&state.catalogPack!==pack)throw new Error('Wait for the pack resource listing before saving a view.');
  if(kind==='camera'){
    const world=state.world,volume=currentVoxelVolume();if(!volume||world.disposed||state.pendingGeneration||state.worldLoading||state.gpuRecovering)throw new Error('Display a settled stored volume before saving its camera.');world.stopNavigation();
    const inputs=state.volumeInputs,data=cameraBookmark({volume:{origin:volume.origin.slice(),width:volume.width,height:volume.height,depth:volume.depth},camera:world.cameraView(),navigation:navigationSettings(state.navigation),source:inputs?{field:inputs.field??null,seed:inputs.seed===undefined?null:String(inputs.seed),dimension:inputs.dimensionKey??null}:null});return{pack,data};
  }
  if(kind!=='preview')throw new Error('Choose a preview setup or camera bookmark.');
  const field=$('field-mode').value,style=field.startsWith('iris-style')?{name:state.noiseStyle,path:state.styleSelection?.path??null,pointer:state.styleSelection?.pointer??'',expressionResource:!!state.styleSelection?.expressionResource}:null;
  if(style?.path&&(state.styleSelection.pack!==pack||state.selected?.path!==style.path))throw new Error('Open the selected style resource before saving its setup.');
  if(field==='iris-generator'&&(!state.selected?.path.startsWith('generators/')||!state.document))throw new Error('Open a valid generator before saving its setup.');
  for(const id of ['coordinate-x','coordinate-z','slice-y','preview-span','resolution'])if(!$(id).value.trim())throw new Error('Enter all preview coordinates and dimensions before saving.');
  return{pack,data:previewSetup({field,seed:$('seed').value,x:Number($('coordinate-x').value),z:Number($('coordinate-z').value),y:Number($('slice-y').value),span:Number($('preview-span').value),resolution:Number($('resolution').value),dimension:$('dimension-select').value,resource:field==='iris-generator'?state.selected.path:null,style,grid:$('grid-toggle').checked,studioLayout:$('studio-layout').checked,palette:$('palette').value,view:state.view})};
}
async function applySavedView(entry){
  editorIdle();if(state.pack!==entry.pack)throw new Error('Open '+(entry.pack||'the no-pack workspace')+' before applying this saved view.');
  if(entry.kind==='camera'){
    const data=cameraBookmark(entry.data),world=state.world,volume=currentVoxelVolume();if(!volume||world.disposed||state.pendingGeneration||state.worldLoading||state.gpuRecovering)throw new Error('Display a settled stored volume before applying its camera.');
    if(['width','height','depth'].some(key=>volume[key]!==data.volume[key])||volume.origin.some((value,axis)=>value!==data.volume.origin[axis]))throw new Error('This camera belongs to different stored-volume bounds. Generate the matching region first.');
    world.setCameraView(data.camera);world.configureNavigation(data.navigation);state.navigation=data.navigation;cameraTools.sync();persistPreview();toast('Applied saved camera to the displayed volume.');return;
  }
  if(entry.kind!=='preview')throw new Error('Unknown saved-view kind.');if(state.pack&&state.catalogPack!==undefined&&state.catalogPack!==state.pack)throw new Error('Wait for the pack resource listing before applying a setup.');const data=previewSetup(entry.data),pack=state.pack,catalog=state.catalog;
  const available=(id,value)=>[...$(id).options].some(option=>option.value===String(value));if(!available('field-mode',data.field)||!available('resolution',data.resolution))throw new Error('This setup uses unavailable preview controls.');
  if(data.dimension&&(!catalog.byPath.has(data.dimension)||!available('dimension-select',data.dimension)))throw new Error('The saved dimension is missing from this pack.');
  const resource=data.resource??data.style?.path;if(resource){const row=catalog.byPath.get(resource)??(editWorkspace.peek(pack,resource)&&{path:resource,editable:true});if(!row?.editable||row.readOnly||category(resource).excluded)throw new Error('The saved preview resource is unavailable or read-only.');await openResource(row);if(state.pack!==pack||state.catalog!==catalog||state.selected?.path!==resource||!state.bufferOwner)throw new Error('The preview resource changed while opening. Apply the setup again.');}
  editorIdle();if(state.pack!==pack||state.catalog!==catalog)throw new Error('The pack changed. Apply the setup again.');
  if(data.resource&&!state.document)throw new Error('Correct the selected generator JSON before applying this setup.');
  if(data.style?.path){parseDocument();if(!state.document||!data.style.expressionResource&&!state.document.nodes.has(data.style.pointer)||data.style.expressionResource&&!data.style.path.startsWith('expressions/'))throw new Error('The saved style location is unavailable. Choose its style again.');}
  cancelPreview();for(const [id,value]of Object.entries({'field-mode':data.field,seed:data.seed,'coordinate-x':data.x,'coordinate-z':data.z,'slice-y':data.y,'preview-span':data.span,resolution:data.resolution,'dimension-select':data.dimension,palette:data.palette}))$(id).value=String(value);
  $('grid-toggle').checked=data.grid;$('studio-layout').checked=data.studioLayout;state.noiseStyle=data.style?.name??null;state.styleSelection=data.style?.path?{pack,path:data.style.path,pointer:data.style.pointer,expressionResource:data.style.expressionResource}:null;
  $('noise-style').hidden=!data.field.startsWith('iris-style');$('noise-style').textContent=state.styleSelection?'Selected resource style':state.noiseStyle??'Choose noise style';state.map?.configure({palette:data.palette,grid:data.grid,studioLayout:data.studioLayout});setView(data.view);persistPreview();toast('Preview controls restored. Generate when ready; retained data is unchanged.');
}
async function savedViews(){editorIdle();await viewTools.open();}
function previewOptions(){
  const rect=$('map-canvas').getBoundingClientRect(),width=Number($('resolution').value),options={field:$('field-mode').value,seed:$('seed').value,x:Number($('coordinate-x').value),z:Number($('coordinate-z').value),y:Number($('slice-y').value),span:Number($('preview-span').value),width,height:Math.max(1,Math.min(512,Math.round(width*Math.max(rect.height,1)/Math.max(rect.width,1))))};
  if(['procedural-object','procedural-placement'].includes(options.field)){
    const selected=state.proceduralSelection;if(!selected||selected.pack!==state.pack)throw new Error('Choose a procedural entry from a native biome or region.');
    if(state.selected?.editable){flushHistory();parseDocument();if(!state.document)throw new Error('Correct the selected JSON before capturing native resources.');}
    Object.assign(options,{...(options.field==='procedural-object'?{seed:'0',width:1,height:1,span:1,x:0,y:0,z:0}:{width:16,height:16,span:16}),procedural:{folder:selected.path.split('/')[0],key:resourceId(selected.path),family:selected.family,index:selected.index,variant:selected.variant}});
  }
  if(['caves','biome-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode'].includes(options.field)){options.width=16;options.height=16;options.span=16;}
  if(options.field.startsWith('iris-style')){
    options.style=state.noiseStyle;
    if(state.styleSelection){const selected=state.styleSelection;if(selected.pack!==state.pack||selected.path!==state.selected?.path)throw new Error('Open the selected style resource again, or choose another noise style.');flushHistory();parseDocument();if(!state.document)throw new Error('Correct the JSON before previewing its style.');if(selected.expressionResource){options.nativeConfig={kind:'style',id:selected.path,text:JSON.stringify({expression:resourceId(selected.path)})};}else{const node=state.document.nodes.get(selected.pointer);if(!node)throw new Error('The selected style was removed. Choose another style.');options.nativeConfig={kind:'style',id:selected.path+selected.pointer,text:state.text.slice(node.start,node.end)};}}
  }
  if(['regions','terrain','biomes','density','terrain-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode','biome-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage','procedural-source','procedural-neighborhood','procedural-placement','caves'].includes(options.field)){const path=$('dimension-select').value;if(!path)throw new Error('Select a native dimension for its map.');if(state.selected?.editable){flushHistory();parseDocument();if(!state.document)throw new Error('Correct the selected JSON before capturing native pack resources.');}options.dimensionKey=resourceId(path);options.style=options.dimensionKey;options.buffet=$('studio-layout').checked;}
  if(options.field==='iris-generator'){flushHistory();parseDocument();if(!state.selected?.path.startsWith('generators/')||!state.document)throw new Error('Open a valid generator JSON resource to preview its standalone output.');options.nativeConfig={kind:'generator',id:state.selected.path,text:state.text};options.style=resourceId(state.selected.path);}
  if(['iris-continent','iris-region-control'].includes(options.field)){const path=$('dimension-select').value;if(!path)throw new Error('Select a dimension for its native control fields.');if(state.selected?.path===path){flushHistory();parseDocument();if(!state.document)throw new Error('Correct the dimension JSON before previewing.');}options.nativeConfig={kind:'dimension',id:path,text:state.selected?.path===path?state.text:null};options.style=resourceId(path);}
  return options;
}
let gpuOpenSequence=0;
function retainGpuData(session){
  const map=session.map,world=session.world;
  if(map?.data)state.mapField=map.data;
  if(world?.volume&&state.volume&&world.volume.blocks===state.volume.blocks){
    state.validatedVolume=world.volume;
    const camera=world.camera;if(camera&&[camera.yaw,camera.pitch,camera.distance,...(camera.target??[])].every(Number.isFinite)&&camera.target?.length===3)state.recoveryCamera={...camera,target:camera.target.slice()};
  }
}
function loseGpu(session,error){
  if(state.gpuSession!==session)return;
  const dirty=state.previewDirty;retainGpuData(session);gpuOpenSequence++;state.gpuSession=null;state.gpu=null;state.map=null;state.world=null;state.gpuRecovering=false;state.gpuError=error.message;
  session.dispose();cancelPreview();state.previewDirty=dirty;mapTools.sync();cameraTools.sync();syncPreviewStatus();$('render-status').textContent='WebGPU unavailable';errorMessage(error);
}
async function retryMapRendering(){
  if(!state.map)throw new Error('Recover WebGPU before rendering the retained map.');
  if(!state.mapField)throw new Error('Generate a map before retrying its display.');
  try{state.map.setData(state.mapField);state.mapError=null;}
  catch(error){state.mapError=error.message;throw error;}
  finally{syncPreviewStatus();}
}
async function recoverGpu({notify=true}={}){
  if(state.gpuRecovering)return false;if(state.gpuSession&&!state.gpuSession.disposed&&!state.gpuSession.lost)return true;
  const sequence=++gpuOpenSequence;state.gpuRecovering=true;state.gpuError=null;syncPreviewStatus();
  const session=new GpuSession({createGpu:createGpuDevice,createMap:gpu=>new MapRenderer($('map-canvas'),gpu),createWorld:gpu=>new WorldRenderer($('world-canvas'),gpu),onLost:error=>loseGpu(session,error),onError:errorMessage});state.gpuSession=session;
  try{
    await session.open();if(sequence!==gpuOpenSequence||session.disposed||session.lost)return false;
    state.gpu=session.gpu;state.map=session.map;state.world=session.world;
    const map=session.map,world=session.world;
    cameraTools.apply(world);
    world.onInspect=hit=>inspectWorldVoxel(hit).catch(errorMessage);world.onError=errorMessage;map.onError=errorMessage;
    map.onData=data=>{if(state.map!==map)return;state.mapField=data;state.mapError=null;mapTools.sync();syncPreviewStatus();};
    map.configure({palette:$('palette').value,grid:$('grid-toggle').checked,studioLayout:$('studio-layout').checked,range:state.mapRange});
    $('render-status').textContent='WebGPU';$('empty-noise').disabled=false;
    if(state.mapField)try{await retryMapRendering();}catch(error){errorMessage(error);}
    if(state.volume)try{await renderStoredVolume(state.volume,state.textureStack);}catch(error){if(error.name!=='AbortError')errorMessage(error);}
    if(sequence!==gpuOpenSequence||state.gpuSession!==session)return false;
    if(!state.mapField&&!state.volume)$('preview-description').textContent='Generate a native field or voxel preview. Generated data stays in your browser.';
    if(notify)message(state.mapError||state.renderError?'WebGPU is ready. Some retained previews need a rendering retry.':'WebGPU previews restored without regenerating terrain.',!!(state.mapError||state.renderError));return true;
  }catch(error){
    if(sequence!==gpuOpenSequence)return false;
    retainGpuData(session);state.gpuSession=null;state.gpu=null;state.map=null;state.world=null;state.gpuError=error.message;session.dispose();$('render-status').textContent='WebGPU unavailable';throw error;
  }finally{if(sequence===gpuOpenSequence){state.gpuRecovering=false;mapTools.sync();syncWorldNotice();}}
}
let previewRequest=0;
function cancelPreview({clear=false}={}){
  clearTimeout(state.generationTimer);state.generationTimer=null;previewRequest++;generation.cancel();worldRenderSequence++;sectionSequence++;
  state.world?.cancelMesh();state.worldLoading=false;state.pendingGeneration=false;$('preview-progress').hidden=true;
  if(clear){
    state.map?.clear();state.world?.clear();state.field=null;state.mapField=null;state.mapError=null;state.recoveryCamera=null;state.validatedVolume=null;state.volume=null;state.volumeField=null;state.pendingVolume=null;state.mapInputs=null;state.volumeInputs=null;state.biomeSlice=false;state.previewDirty=false;state.renderError=null;
    $('preview-scope').textContent='No generated data';$('preview-description').textContent='Generate a native field or voxel preview. Generated data stays in your browser.';$('map-caption').textContent='2D FIELD';$('map-scale').textContent='';
  }else state.previewDirty=!!(state.mapField||state.map?.data||state.volume||state.pendingVolume);
  syncWorldNotice();syncPreviewStatus();
}
function syncPreviewStatus(){
  const retained=!!(state.mapField||state.map?.data||state.volume||state.world?.volume),pending=!!state.pendingVolume;
  $('preview-empty').hidden=retained&&!state.gpuError;
  $('recover-gpu').hidden=!state.gpuError&&!state.gpuRecovering;$('recover-gpu').disabled=!!state.gpuRecovering;
  $('retry-map-rendering').disabled=!state.map||!state.mapField||state.map.data===state.mapField||!!state.gpuRecovering;
  if(state.gpuError)$('preview-description').textContent=state.gpuError;
  $('voxel-view').disabled=!!state.worldLoading||!!state.pendingGeneration||!!state.gpuRecovering;
  $('empty-noise').disabled=!!state.gpuError||!!state.gpuRecovering;$('generate').disabled=!state.map||!!state.gpuError||!!state.gpuRecovering;
  $('preview-state').textContent=state.gpuRecovering?'Recovering WebGPU · generated data retained':state.gpuError?(retained?'WebGPU unavailable · generated data retained':'WebGPU unavailable'):state.mapError?'Map upload failed · retry map rendering':state.worldLoading?(retained?'Updating 3D rendering · showing retained preview':'Preparing 3D rendering'):state.pendingGeneration?(retained?'Generating · showing retained previews':'Generating'):pending?'New voxel data retained · retry 3D rendering':state.renderError?'3D update failed · retained preview available':state.previewDirty&&retained?'Inputs changed · showing retained previews':retained?'Stored previews':'No generated data';
  $('preview-state').title=state.gpuError||state.mapError||state.renderError||'';
  $('retry-rendering').disabled=state.worldLoading||state.pendingGeneration||state.gpuRecovering||!((pending||state.renderError||state.volume&&(state.voxelView??'textured')!==(state.world?.mode??'textured'))&&state.world);
  $('preview-details').disabled=!retained&&!pending;$('analyse-map').disabled=!(state.mapField||state.map?.data);
  $('clear-preview').disabled=!retained&&!pending&&!state.pendingGeneration&&!state.worldLoading;
}
async function previewDetails(){
  const rows=[copy('Map and 3D previews retain their own generation inputs. Changing controls does not relabel existing data. Retained previews can differ from each other and from the next request.')];
  for(const [label,data,inputs]of[['Map',state.mapField??state.map?.data,state.mapInputs],['Displayed 3D',state.volume,state.volumeInputs],['Awaiting 3D rendering',state.pendingVolume?.field.volume,state.pendingVolume?.inputs]]){
    rows.push(element('h3',{text:label}),...previewDescription(data,inputs).map(copy));
  }
  await ask('Retained preview details',rows,{wide:true,submit:null,cancel:'Close'});
}
function resetPreviewView(){state.world?.reset();state.map?.draw();}
async function presentPendingVolume(record,stack=state.textureStack){
  if(state.pendingVolume!==record)throw new DOMException('Voxel preview superseded.','AbortError');
  try{
    const result=await renderStoredVolume(record.field.volume,stack);
    if(result===false||state.pendingVolume!==record||state.textureStack!==stack&&(state.world?.mode??'textured')==='textured')throw new DOMException('Voxel preview superseded.','AbortError');
    state.volume=record.field.volume;state.validatedVolume=state.world?.volume??null;state.recoveryCamera=null;state.volumeField=record.field;state.volumeInputs=record.inputs;state.field=record.field;state.pendingVolume=null;state.biomeSlice=false;state.renderError=null;
    state.previewDirty=record.inputs.request!==previewRequest||record.inputs.pack!==state.pack||record.inputs.revision!==state.revision;
    showVolumePreview(record);syncWorldNotice();syncPreviewStatus();return true;
  }catch(error){if(state.pendingVolume===record&&error.name!=='AbortError')state.renderError=error.message;syncPreviewStatus();throw error;}
}
async function retryVolumeRendering(){
  if(!state.world||state.gpuRecovering)throw new Error('Recover WebGPU before rendering retained voxels.');
  if(state.pendingGeneration||state.worldLoading)throw new Error('Wait for the current preview operation or cancel it first.');
  if(state.pendingVolume)await presentPendingVolume(state.pendingVolume);
  else if(state.volume){if(await renderStoredVolume(state.volume,state.textureStack)===false)throw new DOMException('Voxel preview superseded.','AbortError');}
  else throw new Error('Generate voxel data before retrying its appearance.');
  syncPreviewStatus();message('Rendered the retained voxel data. No terrain generation was requested.');
}
async function regenerate(){
  cancelPreview();const request=++previewRequest;
  if(!state.map||state.gpuRecovering)throw new Error('WebGPU is unavailable. Pack editing and saving remain available.');
  if($('field-mode').value.startsWith('iris-style')&&!state.noiseStyle){await chooseNoiseStyle();return;}
  const options=previewOptions();if(!scalarMode()&&!$('dimension-select').value)throw new Error('Choose an Iris dimension before generating terrain.');
  state.pendingVolume=null;$('preview-progress').hidden=false;state.pendingGeneration=true;syncPreviewStatus();const start=performance.now(),pack=state.pack,revision=state.revision,inputs=capturePreviewInputs(options,{pack,revision,request});
  try{if(['procedural-object','regions','terrain','biomes','density','terrain-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode','biome-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage','procedural-source','procedural-neighborhood','procedural-placement','caves'].includes(options.field))options.packSnapshot=await captureNativePack(previewResourceRows(),name=>readPreviewResource(pack,name),{readBinary:name=>api.readBinary(pack,name),current:()=>request===previewRequest&&pack===state.pack&&revision===state.revision,override:state.selected?.editable&&state.document?{path:state.selected.path,text:state.text}:null});if(options.nativeConfig){if(options.nativeConfig.text===null)options.nativeConfig.text=(await readPreviewResource(pack,options.nativeConfig.id)).text;options.nativeConfig.snippets=await nativePackInputs(options.nativeConfig.kind,options.nativeConfig.text,path=>readPreviewResource(pack,path),{current:()=>request===previewRequest&&pack===state.pack&&revision===state.revision,inventory:state.inventory});}if(!options.packSnapshot&&options.nativeConfig&&[options.nativeConfig.text,...options.nativeConfig.snippets.map(row=>row.text)].some(referencesNativePackResources))options.packSnapshot=await captureNativePack(previewResourceRows(),name=>readPreviewResource(pack,name),{readBinary:name=>api.readBinary(pack,name),current:()=>request===previewRequest&&pack===state.pack&&revision===state.revision,override:state.selected?.editable&&state.document?{path:state.selected.path,text:state.text}:null});if(request!==previewRequest||pack!==state.pack||revision!==state.revision)return;const field=await generation.generate(options);if(request!==previewRequest||pack!==state.pack||revision!==state.revision)return;
    if(field.volume){
      const record=state.pendingVolume={field,inputs};await presentPendingVolume(record);if(request!==previewRequest||pack!==state.pack||revision!==state.revision)return;

      const diagnostics=state.world.diagnostics||[];if(['terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode'].includes(options.field)){message(`Generated native ${field.volume.metadata.mode} terrain and physical biomes in ${Math.round(performance.now()-start)} ms.`+(diagnostics.length?` ${diagnostics.length} block assets need attention: ${diagnostics[0].message}`:''),diagnostics.length>0);return;}if(options.field==='procedural-neighborhood'){message(`Generated native procedural contributions from ${field.volume.metadata.sourceChunks} source chunks in ${Math.round(performance.now()-start)} ms.`+(diagnostics.length?` ${diagnostics.length} block assets need attention: ${diagnostics[0].message}`:''),diagnostics.length>0);return;}if(options.field==='procedural-source'){message(`Generated native procedural content for one source chunk in ${Math.round(performance.now()-start)} ms.`+(diagnostics.length?` ${diagnostics.length} block assets need attention: ${diagnostics[0].message}`:''),diagnostics.length>0);return;}if(options.field==='procedural-placement'){message(`Native single placement ${field.volume.metadata.accepted?'accepted':'rejected'} in ${Math.round(performance.now()-start)} ms.`+(diagnostics.length?` ${diagnostics.length} block assets need attention: ${diagnostics[0].message}`:''),diagnostics.length>0);return;}if(['procedural-object','procedural-placement'].includes(options.field)){message(`Generated native ${field.volume.metadata.family} variant ${field.volume.metadata.variant} in ${Math.round(performance.now()-start)} ms.`+(diagnostics.length?` ${diagnostics.length} block assets need attention: ${diagnostics[0].message}`:''),diagnostics.length>0);return;}message(`Generated one native ${options.field==='subterrain-finish-stage'?'subterrain-preserved terrain':options.field==='material-finish-stage'?'decorated terrain':options.field==='deposit-stage'?'deposit':options.field==='cave-decoration-stage'?'cave-decorated':options.field==='floating-stage'?'floating-biome':options.field==='post-stage'?'post-processed terrain':options.field==='carving-stage'?'cave':options.field==='cave-stage'?'dimension cave':'terrain'} material chunk in ${Math.round(performance.now()-start)} ms.`+(diagnostics.length?` ${diagnostics.length} block assets need attention: ${diagnostics[0].message}`:''),diagnostics.length>0);return;
    }
    state.map.setData(field);state.mapField=field;state.mapError=null;state.field=field;state.mapInputs=inputs;state.biomeSlice=false;state.previewDirty=false;$('preview-empty').hidden=true;
    const native=field.scope.startsWith('iris-');$('preview-scope').textContent=options.field==='biome-stage'?'Native physical biome stage · one chunk slice · development':options.field==='caves'?'Native dimension cave profile markers · development':['terrain','biomes','density'].includes(options.field)?'Native '+(options.field==='terrain'?'procedural height':options.field==='density'?'volumetric occupancy':'surface biome')+' · development':options.field==='regions'?'Native region selection · development':options.nativeConfig?.kind==='dimension'?'Dimension control noise · input is world seed':options.generator||options.nativeConfig?.kind==='generator'?'Standalone Iris generator · input is superSeed':native?'Iris noise style · development':'Experimental native primitive';
    $('map-caption').textContent=native?`${options.style} · ${options.field==='biome-stage'?'PHYSICAL BIOME STAGE · Y '+field.y:options.field==='caves'?'DIMENSION CAVE MARKERS · Y '+field.y:options.field==='density'?'NATIVE VOLUMETRIC OCCUPANCY':options.field==='terrain'?'NATIVE PROCEDURAL HEIGHT':options.field==='biomes'?'NATIVE SURFACE BIOMES':options.field==='regions'?'NATIVE REGIONS':options.nativeConfig?.kind==='dimension'?(options.field==='iris-continent'?'CONTINENT CONTROL':'REGION CONTROL'):options.generator||options.nativeConfig?.kind==='generator'?'IRIS GENERATOR':'IRIS NOISE STYLE'}`:options.field.replace('lab-','').toUpperCase()+' · NATIVE NOISE LAB';
    $('map-scale').textContent=field.span+' blocks';$('preview-description').textContent=options.field==='biome-stage'?'Physical biome keys written by the native biome actuator at Slice Y. Dimension stacks, historical transitions and custom biome registry contributions remain unfinished.':options.field==='caves'?'Dimension profile markers before native block resolution. Biome cave profiles and later cave stages remain unfinished.':'';if(['caves','biome-stage'].includes(options.field)&&state.view==='world')setView('map');message(`Generated ${field.width} × ${field.height} samples in ${Math.round(performance.now()-start)} ms.`);
    if(state.view==='world')toast('Scalar noise previews use the 2D view. Voxel generation requires the full Iris terrain engine.');
  }catch(error){if(request===previewRequest&&pack===state.pack&&revision===state.revision)throw error;}finally{if(request===previewRequest){state.pendingGeneration=false;$('preview-progress').hidden=true;syncPreviewStatus();}}
}
function showVolumePreview(record){const {field,inputs:options}=record;$('preview-empty').hidden=true;$('preview-description').textContent=options.field==='overworld-mode'?'Native Overworld terrain and content stages, including procedural contributions, deposits and decoration. Full world lifecycle and unsupported options remain unfinished.':options.field==='overworld-terrain'?'Runs the original Overworld terrain stages with native cave matter, post-processing and floating terrain. Content generation remains unfinished.':['terrain-mode-stage','terrain-mode'].includes(options.field)?options.field==='terrain-mode'?'Runs native mode generation for the selected Superflat, Enclosure or Islands dimension. Complete-world generation remains unfinished.':'Native registered terrain and biome stages for Superflat, Enclosure or Islands. Blocks and physical biome keys share the same native context. Full engine lifecycle remains unfinished.':options.field==='procedural-neighborhood'?'Native surface and cave procedural contributions from neighboring source chunks. Nearby previews reuse the current dimension snapshot. Full terrain generation remains unfinished.':options.field==='procedural-source'?'Native surface and cave procedural placement for one source chunk using authored chance, density and cave profiles. Use the neighborhood view for neighboring sources. Full terrain generation remains unfinished.':options.field==='procedural-placement'?'One selected native variant placed at the chunk centre through native placement and destination transactions. Automatic scatter, cross-source collision replay and custom blocks remain unfinished.':options.field==='procedural-object'?'Native baked procedural variant using its configured seed. Coordinates are local to the object. Terrain placement and collision checks remain unfinished.':options.field==='subterrain-finish-stage'?'Native material finishing followed by authored subterrain preservation. Object/structure content and custom blocks remain unfinished.':options.field==='material-finish-stage'?'Native deposits, surface and floating-biome decoration, and material cleanup. Object/structure generation and custom blocks remain unfinished.':options.field==='deposit-stage'?'Native deposits and block-matter insertion. Object/structure generation and later stages remain unfinished.':options.field==='cave-decoration-stage'?'Native cave floors and ceilings decorated after Overworld carving, post-processing and floating solids. Content insertion and later stages remain unfinished.':options.field==='floating-stage'?'Native Overworld floating-biome solids after cave carving and post-processing. Decoration and later stages remain unfinished.':options.field==='post-stage'?'Native Overworld cave selection, carving and post-processing. Floating biomes, decoration and later stages remain unfinished.':options.field==='carving-stage'?'Native dimension, region, biome and configured-Y cave profiles. Decoration and later generation stages remain unfinished.':options.field==='cave-stage'?'Dimension profile carving with native cave materials. Biome-profile carving, decoration and later stages remain unfinished.':'';$('preview-scope').textContent=options.field==='overworld-mode'?'Native Overworld generation · development':options.field==='overworld-terrain'?'Native Overworld terrain · content pending':['terrain-mode-stage','terrain-mode'].includes(options.field)?`Native ${field.volume.metadata.mode} terrain stages · physical biome volume`:options.field==='procedural-neighborhood'?'Native procedural neighborhood · one destination chunk':options.field==='procedural-source'?'Native procedural content · one source chunk · neighboring sources pending':options.field==='procedural-placement'?`${field.volume.metadata.placement.key} · native single placement ${field.volume.metadata.accepted?'accepted':'rejected'}`:options.field==='procedural-object'?`${field.volume.metadata.key} · seed ${field.volume.metadata.seed} · isolated native variant`:options.field==='subterrain-finish-stage'?'Native subterrain preservation · content and custom blocks pending':options.field==='material-finish-stage'?'Native decorations and material cleanup · object/structure content pending':options.field==='deposit-stage'?'Native deposits · object/structure content pending':options.field==='cave-decoration-stage'?'Native Overworld cave decoration · later stages pending':options.field==='floating-stage'?'Native Overworld floating-biome solids · later stages pending':options.field==='post-stage'?'Native Overworld post-processing · later stages pending':options.field==='carving-stage'?'Native cave profiles and materials · later stages pending':options.field==='cave-stage'?'Native dimension cave material stage · later stages pending':'Native terrain material stage · later stages pending';if(state.view==='map')setView('world');syncWorldNotice();}
function storedBiomeVolume(){return state.volumeField?.volume===state.volume&&state.volume?.biomes&&state.world?.volume?.blocks===state.volume.blocks?state.world.volume:null;}
function updateBiomeSlice(){
  const worldY=Math.floor(Number($('slice-y').value));
  const slice=volumeBiomeSlice(storedBiomeVolume(),worldY);state.map.setData(slice);state.mapField=slice;state.mapError=null;state.mapInputs=state.volumeInputs;state.biomeSlice=true;$('map-caption').textContent=`PHYSICAL BIOMES · GENERATED VOLUME · Y ${slice.y}`;$('map-scale').textContent=slice.span+' blocks';syncPreviewStatus();
}
function scheduleGeneration(force=false){const needed=state.field||state.pendingGeneration||force;cancelPreview();if(!state.map||state.gpuRecovering)return;if(needed)state.generationTimer=setTimeout(()=>regenerate().catch(errorMessage),250);}
function setView(view){state.world?.stopNavigation();state.view=view;$('canvas-workspace').dataset.view=view;for(const button of document.querySelectorAll('button[data-view]')){button.classList.toggle('active',button.dataset.view===view);button.setAttribute('aria-selected',String(button.dataset.view===view));}state.map?.draw();state.world?.draw();syncWorldNotice();persistPreview();}
function syncWorldNotice(){
  syncSectionControls();syncPreviewStatus();cameraTools.sync();
  $('voxel-view').value=state.voxelView??'textured';
  $('cell-legend').disabled=!currentVoxelVolume()||(state.world?.mode??'textured')==='textured';
  $('voxel-view-status').textContent=(state.world?.mode??'textured')==='textured'?'Textured block models':state.world.mode==='blocks'?'Block ID cells · identity colors':'Physical biome cells · identity colors';
  $('biome-slice').disabled=!storedBiomeVolume();
  const holder=$('world-empty');if(!holder)return;holder.hidden=!!state.world?.volume&&state.world.faces>0;
  const volume=state.world?.volume,empty=volume&&emptyClip(state.world.clip),missing=volume&&state.world.diagnostics?.length;
  holder.querySelector('strong').textContent=!volume?'Native terrain material preview':empty?'Section outside stored volume':missing?'Block assets needed':'No visible geometry in this section';
  holder.querySelector('p').textContent=!volume?'Generate native voxel data and load matching block assets.':empty?'Adjust the section position or choose Full volume.':missing?'Load matching local resource packs; unavailable models and biome tints are reported.':'Choose another section to inspect stored materials.';
}
let voxelViewSequence=0;
async function changeVoxelView(){
  const mode=voxelViewMode($('voxel-view').value),previous=state.voxelView??'textured',source=state.pendingVolume?.field.volume??state.volume;
  if(state.pendingGeneration||state.worldLoading||state.gpuRecovering){$('voxel-view').value=previous;throw new Error('Wait for the preview operation or cancel it before changing the voxel view.');}
  if(mode==='biomes'&&source&&!source.biomes){$('voxel-view').value=previous;throw new Error('This stored volume has no physical biome data.');}
  if(mode===previous&&(state.world?.mode??'textured')===mode)return;
  const sequence=++voxelViewSequence,request=previewRequest;let renderOwner=0;state.voxelView=mode;persistPreview();
  try{
    if(state.world&&source){renderOwner=worldRenderSequence+1;if(state.pendingVolume)await presentPendingVolume(state.pendingVolume);else await renderStoredVolume(state.volume,state.textureStack);}
    persistPreview();syncWorldNotice();
  }catch(error){if(sequence===voxelViewSequence&&request===previewRequest&&(!renderOwner||worldRenderSequence===renderOwner)){state.voxelView=previous;$('voxel-view').value=previous;persistPreview();}syncWorldNotice();throw error;}
}
async function cellLegend(){
  const world=state.world,volume=currentVoxelVolume(),mode=world?.mode??'textured';if(!volume||mode==='textured')throw new Error('Choose a stored cell view before opening its palette.');
  const palette=new CellPalette(volume,mode),search=element('input',{type:'search',maxlength:'1024',placeholder:'Search palette keys'}),list=element('ul',{class:'modal-list'}),status=copy('');let page=0,active=true;
  const guard=()=>{if(!active||state.world!==world||currentVoxelVolume()!==volume||world.mode!==mode)throw new Error('The displayed cell view changed. Open its palette again.');};
  const action=callback=>()=>{try{guard();callback();}catch(error){errorMessage(error);}};
  const previous=element('button',{type:'button',class:'quiet-button',text:'Previous page',onclick:action(()=>{page--;render();})}),next=element('button',{type:'button',class:'quiet-button',text:'Next page',onclick:action(()=>{page++;render();})});
  const render=()=>{guard();const result=palette.page(search.value||'',page);page=result.page;previous.disabled=page===0;next.disabled=page===result.pages-1;status.textContent=`${result.total} palette keys · page ${page+1} of ${result.pages}`;list.replaceChildren(...result.rows.map(row=>element('li',{},element('span',{class:'category-swatch',style:`background:rgb(${row.color.slice(0,3).map(value=>Math.round(value*255)).join(',')})`,'aria-hidden':'true'}),element('span',{class:'category-name',text:row.key}))));};
  search.addEventListener('input',action(()=>{page=0;render();}));render();
  try{await ask(mode==='biomes'?'Physical biome cell palette':'Block ID cell palette',[copy('Identity colors label block or physical biome keys on nonair unit cells. Palette entries can include keys outside the visible section. Colors match the map identity legends.'),field('Find palette key',search),list,status,element('div',{class:'map-dialog-actions'},previous,next)],{wide:true,submit:null,cancel:'Close'});}finally{active=false;}
}
let worldRenderSequence=0,sectionSequence=0;
function currentVoxelVolume(){return state.volume&&state.world?.volume&&state.volume.blocks===state.world.volume.blocks&&!state.worldLoading?state.world.volume:null;}
async function renderStoredVolume(volume,stack){
  const sequence=++worldRenderSequence;sectionSequence++;state.worldLoading=true;syncSectionControls();syncPreviewStatus();if(state.pendingGeneration)$('preview-progress').querySelector('p').textContent='Preparing 3D rendering…';
  try{const input=volume===state.volume&&state.validatedVolume?.blocks===volume.blocks?state.validatedVolume:volume,result=await state.world.setVolume(input,stack,{clip:sectionClip(volume,state.section),mode:state.voxelView??'textured'});if(sequence!==worldRenderSequence)return false;if(volume===state.volume&&state.recoveryCamera){state.world.camera={...state.recoveryCamera,target:state.recoveryCamera.target.slice()};state.world.draw();state.recoveryCamera=null;}if(volume===state.volume)state.validatedVolume=state.world.volume;state.renderError=null;return result;}
  catch(error){if(sequence===worldRenderSequence&&error.name!=='AbortError')state.renderError=error.message;throw error;}
  finally{if(sequence===worldRenderSequence){state.worldLoading=false;syncWorldNotice();}}
}
function syncSectionControls(){
  const volume=currentVoxelVolume(),pending=state.pendingVolume?.field.volume,source=pending??volume,active=state.section.axis!=='off';
  $('section-axis').disabled=!source||!state.world||state.worldLoading;$('section-mode').disabled=!source||!state.world||!active||state.worldLoading;$('section-position').disabled=!source||!state.world||!active||state.worldLoading;
  $('frame-section').disabled=!volume||emptyClip(state.world?.clip);$('focus-point').disabled=!volume||emptyClip(state.world?.clip);
  if(!source){$('section-status').textContent=state.worldLoading?'Loading stored voxel geometry…':'Generate voxel data to inspect sections.';return;}
  const bounds=pending?clipBounds(source,sectionClip(source,state.section)):clipBounds(source,state.world.clip);
  $('section-status').textContent=(pending?'Awaiting rendering · ':'')+(emptyClip(bounds)?'No stored cells in this section.':bounds.min.map((value,axis)=>`${['X','Y','Z'][axis]} ${source.origin[axis]+value}…${source.origin[axis]+bounds.max[axis]-1}`).join(' · '));
}
async function applySection(){
  const position=$('section-position').value.trim();if(!position)throw new Error('Enter an integer world section position.');
  state.section=sectionSettings({axis:$('section-axis').value,mode:$('section-mode').value,position:Number(position)});persistPreview();
  if(state.pendingVolume){await retryVolumeRendering();return;}
  const volume=currentVoxelVolume();if(!volume){syncSectionControls();return;}
  const sequence=++sectionSequence;$('section-status').textContent='Updating stored voxel section…';
  try{await state.world.setClip(sectionClip(volume,state.section));}
  finally{if(sequence===sectionSequence)syncWorldNotice();}
}
async function focusWorldPoint(){
  const volume=currentVoxelVolume();if(!volume)return;const center=clipCenter(volume,state.world.clip),inputs=center.map((value,axis)=>element('input',{type:'number',step:'any',value:String(value),'aria-label':['World X','World Y','World Z'][axis]}));
  await ask('Focus stored voxel coordinates',inputs.map((input,axis)=>field(['World X','World Y','World Z'][axis],input)),{submit:'Focus',read:()=>{if(inputs.some(input=>!input.value.trim()))throw new Error('Enter three finite world coordinates.');return inputs.map(input=>Number(input.value));},onSubmit:point=>{if(currentVoxelVolume()!==volume)throw new Error('The displayed volume changed. Open Focus point again.');state.world.focus(point);}});
}
async function inspectWorldVoxel(hit){
  if(!hit)return;const volume=currentVoxelVolume();if(!volume||hit.meshOwner&&hit.meshOwner!==state.world.picker)return;
  $('coordinates-status').textContent=`X ${hit.x} · Y ${hit.y} · Z ${hit.z}`;$('sample-status').textContent=(hit.block.stateKey||hit.block.id)+(hit.biome?' · '+hit.biome:'');
  const properties=Object.entries(hit.block.properties||{}).map(([key,value])=>`${key}: ${value}`).join('\n'),metadata=hit.metadata||{};
  const details=[copy((state.world.mode??'textured')==='textured'?'Textured model geometry':'Diagnostic cell extents · identity colors'),copy(`World X ${hit.x} · Y ${hit.y} · Z ${hit.z}`),copy(hit.block.stateKey||hit.block.id),...(properties?[element('pre',{class:'modal-copy',text:properties})]:[]),copy(hit.biome?`Stored physical biome: ${hit.biome}`:'This volume contains no physical biome output.'),...(metadata.scope?[copy(`Generation scope: ${metadata.scope}`)]:[]),...(metadata.mode?[copy(`Native mode: ${metadata.mode}`)]:[]),...(hit.point?[copy(`Surface hit: ${hit.point.map(value=>value.toFixed(4)).join(' · ')} · distance ${hit.distance.toFixed(4)} blocks`)]:[]),copy((state.world.mode??'textured')==='textured'?'Transparent pixels can be selected through. Press Esc in the world view to clear the face outline.':'Cell faces show opaque voxel extents. Press Esc in the world view to clear the face outline.')];
  await ask('Stored voxel inspection',details,{submit:'Focus block',read:()=>[hit.x+.5,hit.y+.5,hit.z+.5],onSubmit:point=>{if(currentVoxelVolume()!==volume||hit.meshOwner&&state.world.picker!==hit.meshOwner)throw new Error('The displayed mesh changed. Select a block again.');state.world.focus(point);}});
}
let previewTimer;
function persistPreview(){clearTimeout(previewTimer);previewTimer=setTimeout(()=>{localSet('settings','preview',{view:state.view,field:['procedural-object','procedural-placement'].includes($('field-mode').value)?'terrain-stage':$('field-mode').value,noiseStyle:state.styleSelection?null:state.noiseStyle,seed:$('seed').value,x:$('coordinate-x').value,z:$('coordinate-z').value,span:$('preview-span').value,y:$('slice-y').value,resolution:$('resolution').value,palette:$('palette').value,grid:$('grid-toggle').checked,studioLayout:$('studio-layout').checked,section:state.section,mapRange:state.mapRange,voxelView:state.voxelView,navigation:state.navigation}).catch(()=>{});},300);}
function mapControls(){const canvas=$('map-canvas');let start=null,moved=false;let selected=null;canvas.addEventListener('pointerdown',event=>{selected=state.map?.index;const data=state.map?.data;start=data?{pointerId:event.pointerId,index:selected,x:event.clientX,y:event.clientY,worldX:data.x,worldZ:data.z,span:data.span,depth:data.depth}:null;moved=false;canvas.setPointerCapture(event.pointerId);});canvas.addEventListener('pointermove',event=>{const sample=state.map?.inspect(event.clientX,event.clientY);if(sample){$('coordinates-status').textContent=`X ${sample.x.toFixed(2)} · Z ${sample.z.toFixed(2)}`;$('sample-status').textContent=state.map?.data?.categories?.[sample.value]??sample.value.toPrecision(10);}if(!start||event.pointerId!==start.pointerId)return;if(state.map?.index!==start.index){start=null;return;}const rect=canvas.getBoundingClientRect(),dx=event.clientX-start.x,dz=event.clientY-start.y;if(Math.abs(dx)+Math.abs(dz)>3)moved=true;if(state.biomeSlice)return;$('coordinate-x').value=String(Number((start.worldX-dx*start.span/rect.width).toFixed(4)));$('coordinate-z').value=String(Number((start.worldZ-dz*start.depth/rect.height).toFixed(4)));});canvas.addEventListener('pointerup',event=>{if(start&&event.pointerId===start.pointerId&&state.map?.index===start.index){if(moved){if(!state.biomeSlice)scheduleGeneration();}else if(event.button===0&&state.map?.index===selected){const sample=state.map.inspect(event.clientX,event.clientY);if(sample)mapTools.select(sample.row,sample.column,selected);}}start=null;persistPreview();});canvas.addEventListener('pointercancel',()=>{start=null;});canvas.addEventListener('wheel',event=>{event.preventDefault();if(state.biomeSlice)return;const before=Number($('preview-span').value),next=Math.max(16,Math.min(4096,before*(event.deltaY>0?1.2:1/1.2)));$('preview-span').value=String(Number(next.toFixed(2)));scheduleGeneration();persistPreview();},{passive:false});canvas.addEventListener('dblclick',event=>{if(state.biomeSlice)return;const sample=state.map?.inspect(event.clientX,event.clientY);if(sample){$('coordinate-x').value=String(Number(sample.x.toFixed(3)));$('coordinate-z').value=String(Number(sample.z.toFixed(3)));scheduleGeneration();persistPreview();}});canvas.addEventListener('keydown',event=>{if(state.biomeSlice)return;const step=['caves','biome-stage'].includes(state.field?.field)?16:Number($('preview-span').value)/4;if(['ArrowLeft','ArrowRight'].includes(event.key))$('coordinate-x').value=String(Number($('coordinate-x').value)+(event.key==='ArrowLeft'?-step:step));else if(['ArrowUp','ArrowDown'].includes(event.key))$('coordinate-z').value=String(Number($('coordinate-z').value)+(event.key==='ArrowUp'?-step:step));else return;event.preventDefault();scheduleGeneration();persistPreview();});}
async function textureDialog(){
  const content=element('div'),list=element('ul',{class:'modal-list texture-library'}),roles={baseline:'Vanilla baseline',default:'Default overrides',custom:'Custom overrides'};
  let active=true,busy=false;
  const run=async action=>{
    if(!active||busy)return;busy=true;const controls=[...content.querySelectorAll('button,input,select')].map(node=>({node,disabled:node.disabled}));for(const {node}of controls)node.disabled=true;
    try{await action();await rebuildTextureStack();if(active){closeDialog?.(null);textureDialog().catch(errorMessage);}}
    catch(error){errorMessage(error);if(active){closeDialog?.(null);textureDialog().catch(errorMessage);}}finally{busy=false;if(active)for(const {node,disabled}of controls)node.disabled=disabled;}
  };
  const entries=textureLibrary.entries,ordered=['custom','default','baseline'].flatMap(role=>entries.filter(entry=>entry.role===role).reverse());
  for(const entry of ordered){
    const {pack,id}=entry,peers=entries.filter(peer=>peer.role===entry.role),index=peers.findIndex(peer=>peer.id===id);
    const enabled=element('input',{type:'checkbox',checked:entry.enabled,'aria-label':'Enable '+pack.name,onchange:()=>run(()=>textureLibrary.update(id,{enabled:enabled.checked}))});
    const remember=element('input',{type:'checkbox',checked:entry.remember,'aria-label':'Remember '+pack.name,onchange:()=>run(()=>textureLibrary.update(id,{remember:remember.checked}))});
    const role=element('select',{'aria-label':'Role for '+pack.name,onchange:()=>run(()=>textureLibrary.update(id,{role:role.value}))},Object.entries(roles).map(([value,text])=>element('option',{value,text})));role.value=entry.role;
    list.append(element('li',{class:'texture-row'},element('div',{class:'list-info'},element('strong',{text:pack.name}),element('small',{text:`${entry.remember?'Saved locally':'Session only'} · ${pack.metadata.studioRenderingBundle?'Studio bundle · ':''}${pack.entries.size} files · ${formatBytes(pack.expandedBytes)} · ${id.slice(0,12)}`})),element('div',{class:'texture-actions'},element('label',{},enabled,' Enabled'),element('label',{},remember,' Remember'),role,element('button',{type:'button',class:'text-button',text:'Higher',disabled:index===peers.length-1,title:'Increase priority within '+roles[entry.role],onclick:()=>run(()=>textureLibrary.move(id,1))}),element('button',{type:'button',class:'text-button',text:'Lower',disabled:index===0,title:'Decrease priority within '+roles[entry.role],onclick:()=>run(()=>textureLibrary.move(id,-1))}),element('button',{type:'button',class:'text-button',text:'Remove',onclick:()=>run(()=>textureLibrary.remove(id))}))));
  }
  const mode=element('select',{'aria-label':'Custom pack resolution',onchange:()=>run(()=>textureLibrary.setMode(mode.value))},element('option',{value:'overlay',text:'Overlay configured defaults'}),element('option',{value:'replace',text:'Replace default overrides'}));mode.value=textureLibrary.mode;
  const importRole=element('select',{'aria-label':'Role for next imported pack'},Object.entries(roles).map(([value,text])=>element('option',{value,text})));importRole.value=textureImportOptions.role;
  const importRemember=element('input',{type:'checkbox',checked:textureImportOptions.remember});
  const button=element('button',{type:'button',class:'quiet-button',text:'Load resource pack or Studio bundle',onclick:()=>{textureImportOptions={role:importRole.value,remember:importRemember.checked};closeDialog?.(null);$('texture-file').click();}});
  const inspect=element('button',{type:'button',class:'quiet-button',text:'Inspect rendering dependencies',disabled:!currentVoxelVolume(),onclick:()=>{closeDialog?.(null);inspectTextureDependencies().catch(errorMessage);}});
  const names=textureLibrary.activePacks().map(pack=>pack.name).reverse();
  content.append(copy('Priority is custom overrides, configured default overrides, then the matching vanilla baseline. Rows are shown highest first within each role. Packs stay in this browser.'),...(textureLibrary.warnings.length?[element('div',{class:'info-box',text:textureLibrary.warnings.join('\n')}),element('button',{type:'button',class:'quiet-button',text:'Retry saved packs',onclick:()=>run(()=>textureLibrary.restore({reload:true}))})]:[]),entries.length?list:copy('No resource packs loaded.'),field('Custom packs',mode,'Replace mode omits default overrides while any custom pack is enabled; the baseline stays available.'),copy(names.length?'Active, highest first: '+names.join(' · '):'No rendering packs are enabled.'),element('button',{type:'button',class:'quiet-button',text:'Restore configured defaults',disabled:!entries.some(entry=>entry.role!=='custom'),onclick:()=>run(()=>textureLibrary.restoreDefaults())}),copy('Assign your authorized local F8thful pack as Default overrides and a matching vanilla pack as Vanilla baseline. These role assignments do not verify source compatibility. No built-in asset baseline is installed.'),field('Next import role',importRole),element('label',{class:'settings-check'},importRemember,' Remember the next import in this browser'),button,inspect,copy('Session-only imports work without browser storage. Remembering saves the archive and its role, order and enabled setting together. Changing rendering packs retains generated terrain.'));
  try{await ask('Minecraft resource packs',content,{wide:true,submit:null,cancel:'Close'});}finally{active=false;}
}
async function inspectTextureDependencies(){
  const volume=currentVoxelVolume(),stack=state.textureStack;if(!volume)return;
  let active=true;const isCurrent=()=>active&&currentVoxelVolume()===volume&&state.textureStack===stack&&!stack.disposed;
  message('Inspecting model and texture dependencies for stored block types…');
  try{
    const capture=await inspectRenderingDependencies(stack,volume.palette,{isCurrent}),report=capture.report;assetCurrent(isCurrent);
    const counts=report.counts,details=element('pre',{class:'modal-copy',text:report.errors.map(error=>`${error.context}: ${error.message}`).join('\n')||'No missing references were found in this dependency capture.'});
    const reportButton=element('button',{type:'button',class:'quiet-button',text:'Download dependency report',onclick:()=>{try{assetCurrent(isCurrent);download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'rendering-dependencies.json');}catch(error){errorMessage(error);}}});
    message(`Dependencies: ${counts.blockTypes} block types · ${counts.models} models · ${counts.textures} textures · ${report.errors.length} errors.`,!!report.errors.length);
    await ask('Rendering dependencies',[copy(`${counts.blockTypes} distinct block types · ${counts.models} models · ${counts.textures} texture references · ${counts.files} retained files · ${formatBytes(counts.bytes)}`),copy('Every model candidate is followed without enumerating block states. Required JSON, PNG, animation metadata and source notices remain unchanged. Unrelated assets are omitted.'),details,copy(report.sources.map(source=>`${source.index+1}. ${source.name}`).join(' · ')||'No asset sources loaded.'),reportButton,copy('The Studio ZIP can be loaded here for local reuse. Minecraft pack-format conversion and complete client rendering remain unfinished; a complete dependency capture does not establish rendering parity.')],{wide:true,submit:report.errors.length?null:'Export Studio rendering bundle',cancel:'Close',onSubmit:async()=>{const bundle=await writeRenderingBundle(capture,{isCurrent});assetCurrent(isCurrent);download(new Blob([bundle.bytes],{type:'application/zip'}),'studio-rendering-bundle.zip');toast('Exported local rendering bundle.');}});
  }finally{active=false;}
}
let textureRevision=0;
async function rebuildTextureStack({notify=true}={}){
  state.textures=textureLibrary.activePacks();
  const revision=++textureRevision,previous=state.textureStack,stack=new ResourcePackStack([...state.textures]);
  if((state.world?.mode??'textured')==='textured')state.world?.suspendTextures();state.textureStack=stack;await previous.dispose();if(revision!==textureRevision)return;
  const pending=state.pendingVolume,volume=state.volume;if((pending||volume)&&state.world&&((state.voxelView??'textured')==='textured'||(state.world.mode??'textured')!==(state.voxelView??'textured'))){if(pending)await presentPendingVolume(pending,stack);else await renderStoredVolume(volume,stack);if(revision!==textureRevision)return;syncWorldNotice();}
  if(notify)toast(state.world?'Resource-pack appearance updated. Generation data was retained.':'Rendering packs updated. Recover WebGPU to apply them to retained data.');
}
async function settingsDialog(){const token=element('input',{type:'password',value:api.token,placeholder:'Optional access token',autocomplete:'off'}),schema=element('button',{type:'button',class:'quiet-button',text:'Import local JSON Schema',onclick:()=>{closeDialog?.(null);$('schema-file').click();}});await ask('Workspace settings',[field('Server access token',token,'Required only when the server is configured with IRIS_STUDIO_TOKEN.'),copy('World seed, preview coordinates, drafts, rendering settings and resource packs stay in the browser. Only pack files and file-management metadata are sent to the server.'),schema,copy('Native noise tiles for scalar, voxel and registered-mode previews can be reused from local browser storage. This cache is limited to 32 MiB and can be removed without changing pack files.'),element('button',{type:'button',class:'quiet-button',text:'Clear native noise cache',onclick:async event=>{const button=event.currentTarget;button.disabled=true;generation.invalidate();try{await noiseTilePersistence.clear();message('Local native noise cache cleared.');}catch{message('Local native noise cache storage is unavailable.',true);}finally{button.disabled=false;}}}),element('div',{class:'info-box',text:'Iris terrain reference qualification remains blocked by the upstream checksum mismatch. Native noise lab results are experimental primitive values, not dimension terrain.'})],{submit:'Save settings',read:()=>token.value,onSubmit:async value=>api.setToken(value)});}
function resizer(id,property,min,max,inverse=false){const handle=$(id),workspace=document.querySelector('.workspace');let start;handle.addEventListener('pointerdown',event=>{start={x:event.clientX,width:parseFloat(getComputedStyle(workspace).getPropertyValue(property))};handle.setPointerCapture(event.pointerId);});handle.addEventListener('pointermove',event=>{if(!start)return;const width=Math.max(min,Math.min(max,start.width+(event.clientX-start.x)*(inverse?-1:1)));workspace.style.setProperty(property,width+'px');});handle.addEventListener('pointerup',()=>{start=null;localSet('settings',property,workspace.style.getPropertyValue(property)).catch(()=>{});});handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const current=parseFloat(getComputedStyle(workspace).getPropertyValue(property));workspace.style.setProperty(property,Math.max(min,Math.min(max,current+(event.key==='ArrowRight'?10:-10)*(inverse?-1:1)))+'px');event.preventDefault();});}
function workspaceShortcut(event){
  if(event.defaultPrevented||event.isComposing||event.altKey||$('modal').open)return;
  const target=document.activeElement,typing=['INPUT','TEXTAREA','SELECT'].includes(target?.tagName),json=target?.classList.contains('json-editor'),modifier=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
  if(modifier&&event.shiftKey&&key==='f'){event.preventDefault();searchPackJson().catch(errorMessage);return;}
  if(modifier&&!event.shiftKey&&['f','h'].includes(key)&&json){event.preventDefault();findReplaceSource().catch(errorMessage);return;}
  if(modifier&&key==='s'){event.preventDefault();(event.shiftKey?saveAllResources():saveResource()).catch(errorMessage);}
  if(modifier&&key==='z'&&(!typing||json)){event.preventDefault();$(event.shiftKey?'redo':'undo').click();}
  if(event.key==='/'&&!typing){event.preventDefault();$('resource-search').focus();}
  if(event.key==='Escape')cancelPreview();
}
function wire(){cameraTools.wire();
  bind('map-range','click',()=>mapTools.rangeDialog());bind('map-legend','click',()=>mapTools.legend());bind('map-inspect','click',()=>mapTools.inspect());
  for(const id of ['section-axis','section-mode','section-position'])bind(id,'change',applySection);bind('frame-section','click',()=>state.world?.reset());bind('focus-point','click',focusWorldPoint);
  bind('pack-select','change',event=>event.target.value?openPack(event.target.value):undefined);bind('pack-menu','click',packMenu);bind('import-pack','click',()=>{$('pack-file').click();});bind('empty-open','click',packMenu);bind('refresh','click',refreshResources);bind('resource-search','input',renderExplorer);bind('add-resource','click',createResource);bind('save','click',saveResource);bind('save-all','click',saveAllResources);bind('open-edits','click',showOpenEdits);bind('local-drafts','click',showLocalDrafts);bind('duplicate-resource','click',duplicateResource);bind('rename-resource','click',renameResource);bind('delete-resource','click',deleteResource);bind('resource-history','click',showHistory);bind('review-changes','click',reviewResourceChanges);bind('show-references','click',showReferences);bind('go-to-json','click',goToJsonPointer);bind('search-pack-json','click',searchPackJson);bind('pack-problems','click',showPackProblems);bind('find-source','click',findReplaceSource);bind('settings','click',settingsDialog);bind('textures','click',textureDialog);
  bind('form-mode','click',()=>{flushHistory();parseDocument();state.mode='form';renderInspector();});bind('json-mode','click',()=>{state.mode='json';renderInspector();});bind('undo','click',()=>{flushHistory();if(state.history?.canUndo)setText(state.history.undo(),{history:false});});bind('redo','click',()=>{flushHistory();if(state.history?.canRedo)setText(state.history.redo(),{history:false});});
  bind('pack-file','change',async event=>{const file=event.target.files[0];event.target.value='';if(file)await importArchive(file);});bind('pack-directory','change',async event=>{const files=[...event.target.files];event.target.value='';await importDirectory(files);});
  bind('texture-file','change',async event=>{const file=event.target.files[0],options={...textureImportOptions};event.target.value='';if(!file)return;message('Loading local rendering pack…');await textureLibrary.add(file,options);await rebuildTextureStack();if(!closeDialog)await textureDialog();});
  bind('schema-file','change',async event=>{const file=event.target.files[0];event.target.value='';if(file)await importLocalSchema(file);});
  bind('biome-slice','click',()=>{updateBiomeSlice();setView('split');message('Showing physical biomes from the generated volume.');});
  bind('noise-style','click',()=>chooseNoiseStyle());bind('generate','click',regenerate);bind('empty-noise','click',async()=>{$('field-mode').value='iris-style2d';$('noise-style').hidden=false;setView('map');await regenerate();});bind('cancel-generation','click',()=>{cancelPreview();message('Preview work cancelled. Retained data stays available.');});bind('clear-preview','click',()=>{cancelPreview({clear:true});message('Local preview data cleared.');});bind('retry-rendering','click',retryVolumeRendering);bind('retry-map-rendering','click',retryMapRendering);bind('voxel-view','change',changeVoxelView);bind('cell-legend','click',cellLegend);bind('recover-gpu','click',()=>recoverGpu());bind('preview-details','click',previewDetails);bind('analyse-map','click',analyseRetainedMap);bind('saved-views','click',savedViews);bind('reset-camera','click',resetPreviewView);
  for(const button of document.querySelectorAll('button[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));for(const id of ['field-mode','seed','coordinate-x','coordinate-z','preview-span','slice-y','resolution','dimension-select'])bind(id,'change',()=>{const active=state.pendingGeneration;if(id==='slice-y'&&!active&&state.biomeSlice&&storedBiomeVolume()){updateBiomeSlice();persistPreview();return;}cancelPreview();if(id==='field-mode'){$('noise-style').hidden=!$('field-mode').value.startsWith('iris-style');if(!state.map?.data&&!state.volume){$('preview-empty').hidden=false;$('preview-description').textContent=['regions','terrain','biomes','density','terrain-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode','biome-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage','procedural-source','procedural-neighborhood','procedural-placement','caves'].includes($('field-mode').value)?'Select a dimension to preview native region, biome or procedural height fields. Cave profile markers use one chunk at Slice Y; complete chunk generation remains unfinished.':scalarMode()?'Evaluate native Iris noise, standalone generators or dimension control fields in your browser. These fields precede complete dimension terrain generation.':'Choose a dimension and generate its terrain when the qualified Iris engine is available.';$('preview-scope').textContent='No generated data';}}persistPreview();if(id==='field-mode'&&(scalarMode()||['regions','terrain','biomes','density','terrain-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode','biome-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage','procedural-source','procedural-neighborhood','procedural-placement','caves'].includes($('field-mode').value)))regenerate().catch(errorMessage);else scheduleGeneration(active);});bind('palette','change',()=>{state.map?.configure({palette:$('palette').value});persistPreview();});bind('studio-layout','change',()=>{cancelPreview();persistPreview();if(['regions','terrain','biomes','density','terrain-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode','biome-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage','procedural-source','procedural-neighborhood','procedural-placement','caves'].includes($('field-mode').value))scheduleGeneration(true);});bind('grid-toggle','change',()=>{state.map?.configure({grid:$('grid-toggle').checked,studioLayout:$('studio-layout').checked});persistPreview();});
  generation.addEventListener('progress',event=>{if(state.worldLoading)return;$('preview-progress').querySelector('p').textContent=`Generating ${Math.round(event.detail*100)}%`;});
  window.addEventListener('keydown',workspaceShortcut);window.addEventListener('beforeunload',event=>{if(editWorkspace.dirty(activeEdit()).length){event.preventDefault();event.returnValue='';}});
  mapControls();resizer('left-resizer','--explorer-width',170,420);resizer('right-resizer','--inspector-width',260,600,true);
}
async function initialize(){const restoringTextures=textureLibrary.restore();wire();syncSectionControls();const preview=await localGet('settings','preview').catch(()=>null);if(preview){try{state.mapRange=displayRange(preview.mapRange);}catch{}state.noiseStyle=preview.noiseStyle||null;for(const [key,id]of Object.entries({field:'field-mode',seed:'seed',x:'coordinate-x',z:'coordinate-z',span:'preview-span',y:'slice-y',resolution:'resolution',palette:'palette'}))if(preview[key]!==undefined)$(id).value=preview[key];if(preview.grid!==undefined)$('grid-toggle').checked=preview.grid;if(preview.studioLayout!==undefined)$('studio-layout').checked=preview.studioLayout;try{state.section=sectionSettings(preview.section);}catch{}try{state.voxelView=voxelViewMode(preview.voxelView);}catch{}try{state.navigation=navigationSettings(preview.navigation);}catch{}$('voxel-view').value=state.voxelView;$('section-axis').value=state.section.axis;$('section-mode').value=state.section.mode;$('section-position').value=state.section.position;setView(preview.view||'map');$('noise-style').hidden=!$('field-mode').value.startsWith('iris-style');if(state.noiseStyle)$('noise-style').textContent=state.noiseStyle;}for(const property of ['--explorer-width','--inspector-width']){const width=await localGet('settings',property).catch(()=>null);if(width)document.querySelector('.workspace').style.setProperty(property,width);}
  try{const status=await authenticate();$('target-version').textContent=`Iris ${status.target.iris} · Minecraft ${status.target.minecraft}`;const last=await localGet('settings','last-pack').catch(()=>null);await loadPacks(last);state.ready=true;}catch(error){$('connection-state').textContent='Server connection unavailable';errorMessage(error);}
  try{state.inventory=await loadFieldInventory();if(state.inventory&&state.document)renderInspector();}catch(error){message(error.message,true);}
  try{await recoverGpu({notify:false});}catch(error){errorMessage(error);}
  await restoringTextures;await rebuildTextureStack({notify:false});if(textureLibrary.warnings.length)message(textureLibrary.warnings.join(' '),true);
}
initialize().catch(errorMessage);
