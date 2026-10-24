import {JsonNumber} from '../iris-config/document.mjs';
import {decimal} from '../iris-config/decimal.mjs';
import {pointerEscape} from '../shared/paths.mjs';
import {numericSeed} from './client.mjs';
import {compileStyle} from './style-config.mjs';
const layerKeys=new Set(['zoom','negative','opacity','offsetX','offsetY','offsetZ','seed','parametric','bezier','sinCentered','exponent','enabled','style','octaves','fracture']);
const generatorKeys=new Set(['zoom','opacity','surfaceDetail','multiplicitive','cellFractureZoom','cellFractureShuffle','cellFractureHeight','cellPercentSize','offsetX','offsetZ','seed','interpolator','cliffHeightMax','cliffHeightMin','composite','cliffHeightGenerator','$schema']);
function object(value,pointer,keys){if(!value||typeof value!=='object'||Array.isArray(value)||value instanceof JsonNumber)throw new Error(`${pointer||'/'} must be an inline object. Native snippet loading is not connected yet.`);for(const key of Object.keys(value))if(!keys.has(key))throw new Error(`The browser generator bridge does not yet support ${pointer}/${pointerEscape(key)}. The original field is preserved.`);return value;}
function number(value,fallback,pointer){if(value===undefined)return fallback;if(!(value instanceof JsonNumber)&&typeof value!=='number')throw new Error(`${pointer} must be numeric.`);const n=Number(value);if(!Number.isFinite(n))throw new Error(`${pointer} must be finite.`);return n;}
function boolean(value,fallback,pointer){if(value===undefined)return fallback;if(typeof value!=='boolean')throw new Error(`${pointer} must be true or false.`);return value;}
function long(value,fallback,pointer){if(value===undefined)return String(fallback);if(!(value instanceof JsonNumber)&&typeof value!=='number')throw new Error(`${pointer} must be an integer seed.`);const n=decimal(value);if(n.sign===0)return'0';if(n.exponent<0n||BigInt(n.digits.length)+n.exponent>19n)throw new Error(`${pointer} must fit a Java long.`);return numericSeed((n.sign<0?'-':'')+n.digits+'0'.repeat(Number(n.exponent)));}
function collection(value,pointer){if(!Array.isArray(value))throw new Error(`${pointer} must be an inline array.`);if(value.length>256)throw new Error(`${pointer} exceeds the preview layer budget.`);return value;}
export function compileGenerator(value,{pointer='',kind='generator'}={}){
  const layers=[],styles=[];let sequence=0;
  function style(source,path){const result=compileStyle(source,{pointer:path}),prefix=`${sequence++}-`,translate=id=>prefix+id;for(const definition of result.definitions)styles.push({...definition,id:translate(definition.id),fracture:definition.fracture?translate(definition.fracture):''});if(styles.length>256)throw new Error('The generator exceeds the browser style-definition budget.');return translate(result.root);}
  function layer(source,path,depth=0){
    if(depth>32||layers.length+sequence>512)throw new Error('Noise-layer nesting exceeds the browser bridge budget.');object(source,path,layerKeys);
    const id='layer-'+sequence++,get=(key,fallback)=>number(source[key],fallback,`${path}/${key}`),flag=(key,fallback)=>boolean(source[key],fallback,`${path}/${key}`);
    const octaves=get('octaves',1);if(!Number.isInteger(octaves)||octaves<1||octaves>16)throw new Error(`${path}/octaves must be an integer from 1 to 16.`);
    const definition={id,style:style(source.style??{style:'IRIS'},path+'/style'),seed:long(source.seed,0,path+'/seed'),zoom:get('zoom',1),opacity:get('opacity',1),offsetX:get('offsetX',0),offsetY:get('offsetY',0),offsetZ:get('offsetZ',0),exponent:get('exponent',1),negative:flag('negative',false),enabled:flag('enabled',true),parametric:flag('parametric',false),bezier:flag('bezier',false),sinCentered:flag('sinCentered',false),octaves,children:collection(source.fracture??[],path+'/fracture').map((child,index)=>layer(child,`${path}/fracture/${index}`,depth+1))};
    layers.push(definition);return id;
  }
  if(kind==='layer')return{kind,root:layer(value,pointer),styles,layers,pointer};
  object(value,pointer,generatorKeys);const get=(key,fallback)=>number(value[key],fallback,`${pointer}/${key}`),interpolator=value.interpolator??{};
  object(interpolator,pointer+'/interpolator',new Set(['function','horizontalScale']));
  const interpolation=interpolator.function??'BILINEAR_STARCAST_6';if(typeof interpolation!=='string')throw new Error('The interpolator function must be an Iris enum name.');
  const generator={id:'generator',children:collection(value.composite??[],pointer+'/composite').map((child,index)=>layer(child,`${pointer}/composite/${index}`)),seed:long(value.seed,1,pointer+'/seed'),zoom:get('zoom',1),opacity:get('opacity',1),surfaceDetail:get('surfaceDetail',1),multiplicitive:boolean(value.multiplicitive,false,pointer+'/multiplicitive'),offsetX:get('offsetX',0),offsetZ:get('offsetZ',0),cellZoom:get('cellFractureZoom',1),cellShuffle:get('cellFractureShuffle',12),cellHeight:get('cellFractureHeight',0),cellPercent:get('cellPercentSize',.75),cliffMin:get('cliffHeightMin',0),cliffMax:get('cliffHeightMax',0),cliffLayer:value.cliffHeightGenerator?layer(value.cliffHeightGenerator,pointer+'/cliffHeightGenerator'):null,interpolation,interpolationScale:number(interpolator.horizontalScale,7,pointer+'/interpolator/horizontalScale')};
  return{kind,root:generator.id,generator,styles,layers,pointer};
}
