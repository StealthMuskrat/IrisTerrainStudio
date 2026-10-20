import { JsonNumber } from './document.mjs';
import { compareDecimal,isIntegerDecimal,isMultipleDecimal } from './decimal.mjs';
import { pointerEscape,pointerParts } from '../shared/paths.mjs';
const numeric=value=>value instanceof JsonNumber||typeof value==='number';
const kind=value=>numeric(value)?'number':value===null?'null':Array.isArray(value)?'array':typeof value;
function equivalent(a,b){
  if(numeric(a)||numeric(b))return numeric(a)&&numeric(b)&&compareDecimal(a,b)===0;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equivalent(a[key],b[key]));
}
function reference(schema,ref){
  if(ref==='#')return schema;if(!ref.startsWith('#/'))throw new Error('External schema references must be bundled locally.');
  let target=schema;for(const part of pointerParts(decodeURIComponent(ref.slice(1)))){if(!target||typeof target!=='object'||!Object.hasOwn(target,part))throw new Error('Schema reference is missing: '+ref);target=target[part];}return target;
}
// Draft-07 keywords emitted by Iris's SchemaBuilder, plus ordinary Draft-07
// object, array and conditional constraints. No external schema/network reads.
export function validateSchema(document,schema){
  let steps=0;const maxErrors=200;
  const visit=(value,rule,pointer,depth=0)=>{
    const errors=[],report=message=>{if(errors.length<maxErrors)errors.push({pointer,message,severity:'error'});};
    if(++steps>100000||depth>100){report('Schema evaluation exceeds the application budget.');return errors;}
    if(rule===false){report('This value is not allowed.');return errors;}
    if(rule==null||rule===true)return errors;
    if(typeof rule!=='object'||Array.isArray(rule)){report('Invalid schema definition.');return errors;}
    const merge=issues=>{for(const issue of issues)if(errors.length<maxErrors)errors.push(issue);};
    try{
      if(rule.$ref)return visit(value,reference(schema,rule.$ref),pointer,depth+1);
      const type=kind(value),types=Array.isArray(rule.type)?rule.type:rule.type?[rule.type]:[];
      if(types.length&&!types.includes(type)&&!(type==='number'&&types.includes('integer')&&isIntegerDecimal(value))){report('Expected '+types.join(' or ')+'.');return errors;}
      if(rule.enum&&!rule.enum.some(item=>equivalent(item,value)))report('Choose one of the schema’s allowed values.');
      if(Object.hasOwn(rule,'const')&&!equivalent(rule.const,value))report('Value differs from the required constant.');
      for(const sub of rule.allOf||[])merge(visit(value,sub,pointer,depth+1));
      for(const keyword of ['anyOf','oneOf'])if(rule[keyword]){
        const branches=rule[keyword].map(sub=>visit(value,sub,pointer,depth+1)),valid=branches.filter(issues=>!issues.length).length;
        if(keyword==='anyOf'?!valid:valid!==1){report(keyword==='anyOf'?'Value does not match any allowed schema.':'Value must match exactly one allowed schema.');if(!valid&&branches.length)merge(branches.reduce((best,next)=>next.length<best.length?next:best));}
      }
      if(rule.not!==undefined&&!visit(value,rule.not,pointer,depth+1).length)report('Value matches a disallowed schema.');
      if(rule.if!==undefined){const match=!visit(value,rule.if,pointer,depth+1).length;if(match&&rule.then!==undefined)merge(visit(value,rule.then,pointer,depth+1));if(!match&&rule.else!==undefined)merge(visit(value,rule.else,pointer,depth+1));}
      if(type==='number'){
        for(const[key,relation,label]of[['minimum',c=>c<0,'Minimum'],['maximum',c=>c>0,'Maximum'],['exclusiveMinimum',c=>c<=0,'Must be greater than'],['exclusiveMaximum',c=>c>=0,'Must be less than']])if(rule[key]!==undefined){const legacy=typeof rule[key]==='boolean';if(legacy){const bound=key==='exclusiveMinimum'?rule.minimum:key==='exclusiveMaximum'?rule.maximum:undefined;if(rule[key]&&bound!==undefined&&relation(compareDecimal(value,bound)))report(`${label}: ${bound}.`);}else if(relation(compareDecimal(value,rule[key])))report(`${label}: ${rule[key]}.`);}
        if(rule.multipleOf!==undefined&&!isMultipleDecimal(value,rule.multipleOf))report(`Must be a multiple of ${rule.multipleOf}.`);
      }
      if(type==='string'){
        const length=Array.from(value).length;
        if(rule.minLength!==undefined&&length<Number(rule.minLength))report(`Use at least ${rule.minLength} characters.`);
        if(rule.maxLength!==undefined&&length>Number(rule.maxLength))report(`Use at most ${rule.maxLength} characters.`);
        if(rule.pattern&&!new RegExp(rule.pattern,'u').test(value))report('Value does not match the schema pattern.');
      }
      if(type==='array'){
        if(rule.minItems!==undefined&&value.length<Number(rule.minItems))report(`Use at least ${rule.minItems} entries.`);
        if(rule.maxItems!==undefined&&value.length>Number(rule.maxItems))report(`Use at most ${rule.maxItems} entries.`);
        if(rule.uniqueItems){let duplicate=false;for(let i=0;i<value.length&&!duplicate;i++)for(let j=0;j<i;j++){if(++steps>100000)throw new Error('Array uniqueness evaluation exceeds the application budget.');if(equivalent(value[j],value[i])){duplicate=true;break;}}if(duplicate)report('Array entries must be unique.');}
        value.forEach((item,index)=>{const sub=Array.isArray(rule.items)?rule.items[index]??rule.additionalItems:rule.items;if(sub!==undefined)merge(visit(item,sub,pointer+'/'+index,depth+1));});
        if(rule.contains!==undefined&&!value.some(item=>!visit(item,rule.contains,pointer,depth+1).length))report('Array must contain an entry matching its contains schema.');
      }
      if(type==='object'){
        const keys=Object.keys(value);
        if(rule.minProperties!==undefined&&keys.length<Number(rule.minProperties))report(`Use at least ${rule.minProperties} properties.`);
        if(rule.maxProperties!==undefined&&keys.length>Number(rule.maxProperties))report(`Use at most ${rule.maxProperties} properties.`);
        for(const key of rule.required||[])if(!Object.hasOwn(value,key))report('Missing required property: '+key);
        for(const key of keys){
          const child=pointer+'/'+pointerEscape(key);let matched=false;
          if(rule.properties&&Object.hasOwn(rule.properties,key)){merge(visit(value[key],rule.properties[key],child,depth+1));matched=true;}
          for(const[pattern,sub]of Object.entries(rule.patternProperties||{}))if(new RegExp(pattern,'u').test(key)){merge(visit(value[key],sub,child,depth+1));matched=true;}
          if(!matched&&rule.additionalProperties!==undefined)merge(visit(value[key],rule.additionalProperties,child,depth+1));
          if(rule.propertyNames!==undefined)merge(visit(key,rule.propertyNames,child,depth+1));
        }
        for(const[key,dependency]of Object.entries(rule.dependencies||{}))if(Object.hasOwn(value,key)){if(Array.isArray(dependency)){for(const required of dependency)if(!Object.hasOwn(value,required))report(`${key} requires property ${required}.`);}else merge(visit(value,dependency,pointer,depth+1));}
      }
    }catch(error){report(error.message||'Schema evaluation failed.');}
    return errors;
  };
  return visit(document.value,schema,'');
}
export function propertySchema(schema,parts){
  function resolve(rule,depth=0){if(depth>32||!rule||typeof rule!=='object')return{};if(rule.$ref)return resolve(reference(schema,rule.$ref),depth+1);const variants=rule.anyOf||rule.oneOf;if(variants){const object=variants.find(item=>item.type==='object'||item.properties||item.$ref);if(object)return resolve(object,depth+1);}return rule;}
  let current=schema;try{for(const part of parts){current=resolve(current);current=current.type==='array'?Array.isArray(current.items)?current.items[Number(part)]:current.items:current.properties?.[part];}return resolve(current);}catch{return{};}
}
