import {identifier} from '../resource-packs/pack.mjs';
const key=properties=>Object.keys(properties).sort().map(name=>name+'='+properties[name]).join(',');
export class BlockRegistry {
  static async load(){
    const base='/app/engine/registry-generated/',response=await fetch(base+'manifest.json');if(!response.ok)throw new Error('The native Minecraft registry is not installed. Run npm run engine:registry locally.');
    const manifest=await response.json();if(manifest.scope!=='minecraft-development-registry-export'||manifest.minecraft?.id!=='26.3'||!manifest.minecraft.stable)throw new Error('The registry does not identify stable Minecraft 26.3.');
    const file=await fetch(base+'blocks.json');if(!file.ok)throw new Error('The native block-state report is missing.');const bytes=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
    if(hash!==manifest.files?.['blocks.json']?.sha256)throw new Error('The block registry differs from its export manifest.');
    return new BlockRegistry(JSON.parse(new TextDecoder().decode(bytes)),manifest);
  }
  constructor(report,manifest){
    this.manifest=manifest;this.blocks=new Map();this.states=new Map();
    for(const[id,definition]of Object.entries(report)){
      const defaults=definition.states.filter(state=>state.default);if(defaults.length!==1)throw new Error(`The native registry has no unique default state for ${id}.`);
      const states=new Map();for(const state of definition.states){if(!Number.isSafeInteger(state.id)||this.states.has(state.id))throw new Error('Native state identifiers are invalid.');const block=Object.freeze({id,properties:Object.freeze({...state.properties}),nativeStateId:state.id});this.states.set(state.id,block);states.set(key(block.properties),block);}
      this.blocks.set(id,{id,properties:definition.properties||{},states,default:states.get(key(defaults[0].properties||{}))});
    }
    if(this.blocks.size!==manifest.blocks||this.states.size!==manifest.states)throw new Error('The native registry coverage differs from its manifest.');
  }
  resolve(id,properties={}){
    const name=identifier(id).id,block=this.blocks.get(name);if(!block)throw new Error(`Block ${name} is absent from Minecraft 26.3.`);
    if(!properties||typeof properties!=='object'||Array.isArray(properties))throw new Error('Block properties must be a key/value object.');
    const merged={...block.default.properties};for(const[property,value]of Object.entries(properties)){const text=String(value);if(!Object.hasOwn(block.properties,property)||!block.properties[property].includes(text))throw new Error(`Invalid ${name} property: ${property}=${text}.`);merged[property]=text;}
    const state=block.states.get(key(merged));if(!state)throw new Error('The requested native block state does not exist.');return state;
  }
  parse(text){
    if(typeof text!=='string')throw new Error('Enter a native block-state string.');const match=/^([^\[\]\s]+)(?:\[([^\[\]]*)\])?$/.exec(text);if(!match)throw new Error('Invalid block-state syntax.');const properties=Object.create(null);
    if(match[2])for(const part of match[2].split(',')){const pair=/^([a-z0-9_]+)=([a-z0-9_-]+)$/.exec(part);if(!pair||Object.hasOwn(properties,pair[1]))throw new Error('Invalid or repeated block-state property.');properties[pair[1]]=pair[2];}
    return this.resolve(match[1],properties);
  }
  text(state){const properties=key(state.properties);return state.id+(properties?'['+properties+']':'');}
}
