import {BlockRegistry} from './blocks.mjs';
import {NativePlatformMetadata} from './platform.mjs';

const expectedFlags=['isAir','isSolid','isOccluding','isFluid','isWater','isWaterLogged','isLit','isUpdatable','isFoliage','isTreeBlock','isFoliagePlantable','isDecorant','isStorage','isStorageChest','isOre','isDeepSlate','isVineBlock','hasTileEntity'];
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');

/** Development bridge to exported native predicates. Rendering shapes are separate. */
export class NativeStateCatalog {
  static async load(){
    const base='/app/engine/registry-generated/',response=await fetch(base+'manifest.json');if(!response.ok)throw new Error('The native Minecraft registry is not installed. Run npm run engine:registry locally.');
    const manifest=await response.json();if(manifest.scope!=='minecraft-development-registry-export'||manifest.minecraft?.id!=='26.3'||!manifest.minecraft.stable)throw new Error('The native registry must identify stable Minecraft 26.3.');
    const [report,predicates,platform]=await Promise.all(['blocks.json','native-predicates.json','native-registries.json'].map(async name=>{
      const file=await fetch(base+name);if(!file.ok)throw new Error(`Missing native registry export: ${name}`);const bytes=await file.arrayBuffer();if(await hash(bytes)!==manifest.files?.[name]?.sha256)throw new Error(`Native registry bytes differ from their manifest: ${name}`);return JSON.parse(new TextDecoder().decode(bytes));
    }));return new NativeStateCatalog(new BlockRegistry(report,manifest),predicates,platform);
  }
  constructor(registry,predicates,platform=null){
    this.registry=registry;this.manifest=registry.manifest;this.cache=new Map();
    this.platform=platform?new NativePlatformMetadata(platform,registry):null;
    if(predicates.scope!=='pinned-native-block-predicates'||predicates.minecraft!=='26.3'||JSON.stringify(predicates.flagNames)!==JSON.stringify(expectedFlags))throw new Error('The native predicate format is unsupported.');
    const count=registry.states.size,types=predicates.blockTypes;
    if(predicates.stateFlags?.length!==count||predicates.stateTypes?.length!==count||types?.length!==registry.blocks.size||new Set(types).size!==types.length)throw new Error('Native predicate coverage is incomplete.');
    this.types=types;this.flags=new Uint32Array(count);this.stateTypes=new Uint32Array(count);this.order=new Map();this.deep=predicates.toDeepSlate;this.normal=predicates.toNormalOre;
    for(let index=0;index<types.length;index++){
      const name=types[index],block=registry.blocks.get(name),order=predicates.propertyOrder?.[name];
      if(!block||!Array.isArray(order)||order.length!==Object.keys(block.properties).length||new Set(order).size!==order.length||order.some(property=>!Object.hasOwn(block.properties,property)))throw new Error('Native property serialization order is incomplete.');
      this.order.set(name,order);
    }
    for(let id=0;id<count;id++){
      const state=registry.states.get(id),type=predicates.stateTypes[id],flags=predicates.stateFlags[id];
      if(!state||!Number.isInteger(type)||types[type]!==state.id||!Number.isInteger(flags)||flags<0||flags>=2**expectedFlags.length)throw new Error('Native predicate identities differ from the block-state report.');
      this.stateTypes[id]=type;this.flags[id]=flags;
    }
    if(typeof predicates.placementBits!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(predicates.placementBits))throw new Error('Native material placement matrix is invalid.');
    const decoded=atob(predicates.placementBits);this.placement=Uint8Array.from(decoded,character=>character.charCodeAt(0));
    const bits=types.length*types.length;if(this.placement.length!==Math.ceil(bits/8))throw new Error('Native material placement matrix is incomplete.');
    let allowed=0;for(let bit=0;bit<bits;bit++)allowed+=(this.placement[bit>>>3]>>>(bit&7))&1;
    if(allowed!==predicates.allowedPlacementPairs||(bits%8&&this.placement.at(-1)>>>(bits%8)))throw new Error('Native material placement coverage differs from its export.');
    for(const mappings of [this.deep,this.normal]){
      if(!mappings||typeof mappings!=='object'||Array.isArray(mappings))throw new Error('Native ore conversions are missing.');
      for(const[name,text]of Object.entries(mappings)){if(!registry.blocks.has(name)||typeof text!=='string')throw new Error('Invalid native ore conversion.');registry.parse(text);}
    }
  }
  serialize(state){const properties=this.order.get(state.id).map(name=>name+'='+state.properties[name]).join(',');return state.id+(properties?'['+properties+']':'');}
  intern(state,parsed){
    // Native ModdedBlockState caches by canonical state and retains the first
    // parsed-property mask. Never pre-intern the report's full state objects.
    const key=this.serialize(state);if(!this.cache.has(key))this.cache.set(key,new NativeState(this,state,key,parsed));return this.cache.get(key);
  }
  parse(text){
    if(typeof text!=='string')throw new Error('Enter a block-state string.');text=text.trim();const state=this.registry.parse(text),parsed=Object.create(null),open=text.indexOf('[');
    if(open>=0){const body=text.slice(open+1,-1);if(body)for(const entry of body.split(',')){const[name,value]=entry.split('=');parsed[name]=value;}}
    return this.intern(state,Object.freeze(parsed));
  }
  air(){return this.intern(this.registry.resolve('minecraft:air'),null);}
  defaultState(name){return this.intern(this.registry.resolve(name),null);}
  canPlace(material,onto){if(material.catalog!==this||onto.catalog!==this)throw new Error('Native states belong to different registry exports.');const bit=this.stateTypes[material.nativeStateId]*this.types.length+this.stateTypes[onto.nativeStateId];return Boolean((this.placement[bit>>>3]>>>(bit&7))&1);}
  deepSlateOre(onto,ore){if(onto.catalog!==this||ore.catalog!==this)throw new Error('Native states belong to different registry exports.');const text=(onto.isDeepSlate()?this.deep:this.normal)[ore.id];return text?this.defaultMapped(text):ore;}
  defaultMapped(text){return this.intern(this.registry.parse(text),null);}
}

class NativeState {
  constructor(catalog,state,key,parsed){this.catalog=catalog;this.state=state;this.id=state.id;this.properties=state.properties;this.nativeStateId=state.nativeStateId;this.key=key;this.parsedProperties=parsed;Object.freeze(this);}
  matches(other){if(!(other instanceof NativeState)||other.catalog!==this.catalog||other.id!==this.id)return false;if(other.nativeStateId===this.nativeStateId)return true;if(other.parsedProperties===null)return false;return Object.entries(other.parsedProperties).every(([name,value])=>this.properties[name]===value);}
  withProperty(name,value){if(!Object.hasOwn(this.properties,name))throw new Error(`Unknown native property: ${name}`);const state=this.catalog.registry.resolve(this.id,{...this.properties,[name]:String(value)});return this.catalog.intern(state,Object.freeze({...state.properties}));}
  canPlaceOnto(other){return this.catalog.canPlace(this,other);}
  isCustom(){return false;}
}
for(const[name,index]of expectedFlags.map((name,index)=>[name,index]))Object.defineProperty(NativeState.prototype,name,{value(){return Boolean(this.catalog.flags[this.nativeStateId]&(1<<index));}});
