const categories=['blocks','biomes','structures','items','entities','enchantments','potionEffects','lootTables'];

/** Actual neutral registry metadata exported by NativeRegistryAccess. */
export class NativePlatformMetadata {
  constructor(report,blockRegistry){
    if(report.scope!=='pinned-native-platform-registries'||report.minecraft!=='26.3')throw new Error('Unsupported native platform registry metadata.');
    this.keySets=new Map();this.keyLists=new Map();
    for(const category of categories){const keys=report.keys?.[category];if(!Array.isArray(keys)||!keys.length||keys.some(key=>typeof key!=='string'||!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(key))||new Set(keys).size!==keys.length)throw new Error(`Native ${category} registry is missing or invalid.`);this.keyLists.set(category,Object.freeze([...keys]));this.keySets.set(category,new Set(keys));}
    if(this.keySets.get('blocks').size!==blockRegistry.blocks.size||[...blockRegistry.blocks.keys()].some(name=>!this.keySets.get('blocks').has(name)))throw new Error('Native block registry metadata differs from the state report.');
    if(!Array.isArray(report.propertyGroups)||!report.blockPropertyGroups||Object.keys(report.blockPropertyGroups).length!==blockRegistry.blocks.size)throw new Error('Native property descriptor groups are incomplete.');
    const groups=report.propertyGroups.map(group=>{
      if(!Array.isArray(group)||new Set(group.map(property=>property.name)).size!==group.length)throw new Error('Native property descriptors are invalid.');
      return Object.freeze(group.map(property=>{
        if(typeof property.name!=='string'||!['boolean','integer','string'].includes(property.jsonType)||!Array.isArray(property.allowedValues)||!property.allowedValues.length)throw new Error('Native property descriptor format is unsupported.');
        const valid=value=>property.jsonType==='integer'?Number.isSafeInteger(value):typeof value===property.jsonType;
        if(!valid(property.defaultValue)||property.allowedValues.some(value=>!valid(value))||!property.allowedValues.includes(property.defaultValue))throw new Error('Native property descriptor values are invalid.');
        if(property.numericRange!=null){const range=property.numericRange;if(!Number.isFinite(range.minimum)||!Number.isFinite(range.maximum)||range.minimum>range.maximum||typeof range.exclusiveMinimum!=='boolean'||typeof range.exclusiveMaximum!=='boolean')throw new Error('Native property numeric range is invalid.');}
        return Object.freeze({...property,allowedValues:Object.freeze([...property.allowedValues]),numericRange:property.numericRange?Object.freeze({...property.numericRange}):null});
      }));
    });
    this.properties=new Map();
    for(const[name,block]of blockRegistry.blocks){const index=report.blockPropertyGroups[name],group=groups[index];if(!Number.isInteger(index)||!group||group.length!==Object.keys(block.properties).length)throw new Error('Native block property descriptor coverage differs from the state report.');for(const property of group){const values=block.properties[property.name];if(!values||values.length!==property.allowedValues.length||property.allowedValues.some(value=>!values.includes(String(value)))||String(property.defaultValue)!==block.default.properties[property.name])throw new Error('Native block property descriptor differs from the native state report.');}this.properties.set(name,group);}
    this.lootTablesExported=report.lootTablesExported===true;
  }
  keys(category){const keys=this.keyLists.get(category);if(!keys)throw new Error(`Native ${category} keys are not exported.`);return keys;}
  has(category,key){if(!this.keySets.has(category))throw new Error(`Native ${category} keys are not exported.`);return this.keySets.get(category).has(key);}
  blockProperties(name){if(!this.properties.has(name))throw new Error(`Unknown native block: ${name}`);return this.properties.get(name);}
}
