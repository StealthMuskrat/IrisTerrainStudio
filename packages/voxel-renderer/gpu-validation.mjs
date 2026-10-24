// Error scopes belong to the shared device. Push, execute and pop synchronously;
// never leave a scope on the stack while another renderer can issue GPU work.
const shaderChecks=new WeakMap();
export function checkedShaderModule(device,descriptor){
  const module=device.createShaderModule(descriptor),label=descriptor.label??'Rendering shader';
  let pending;
  try{pending=module.getCompilationInfo();}catch(error){pending=Promise.reject(error);}
  const check=Promise.resolve(pending).then(info=>{
    if(!info||!Array.isArray(info.messages))throw new Error('Shader compilation diagnostics are unavailable.');
    return ['error','warning'].flatMap(type=>info.messages.filter(message=>message.type===type).slice(0,32)).map(message=>({type:message.type,label,message:String(message.message),line:Number(message.lineNum)||0,column:Number(message.linePos)||0}));
  }).catch(error=>[{type:'error',label,message:error.message,line:0,column:0}]);
  let checks=shaderChecks.get(device);if(!checks){checks=[];shaderChecks.set(device,checks);}checks.push(check);return module;
}
export async function validateGpuOperation(device,label,operation){
  const pending=[],pushed=[];let value,failure;
  try{
    for(const filter of['out-of-memory','internal','validation']){device.pushErrorScope(filter);pushed.push(filter);}
    value=operation();if(value?.then){Promise.resolve(value).catch(()=>{});throw new Error('GPU validation operations must issue their commands synchronously.');}
  }catch(error){failure=error;}
  // Calling pop immediately also handles constructor exceptions and nested scopes.
  while(pushed.length){const filter=pushed.pop();try{pending.push(Promise.resolve(device.popErrorScope()).then(error=>error?{type:'error',label:filter,message:error.message}:null));}catch(error){pending.push(Promise.reject(error));}}
  const checks=shaderChecks.get(device)??[];shaderChecks.delete(device);
  const settled=await Promise.allSettled([...pending,...checks]),diagnostics=[];
  for(const result of settled){if(result.status==='rejected')diagnostics.push({type:'error',label,message:result.reason?.message??String(result.reason)});else if(Array.isArray(result.value))diagnostics.push(...result.value);else if(result.value)diagnostics.push(result.value);}
  const errors=diagnostics.filter(row=>row.type==='error');
  if(errors.length)throw new Error(`${label}: ${errors.map(row=>`${row.label}${row.line?` (${row.line}:${row.column})`:''}: ${row.message}`).join('\n')}`,failure?{cause:failure}:undefined);
  if(failure)throw failure;
  return{value,diagnostics};
}
