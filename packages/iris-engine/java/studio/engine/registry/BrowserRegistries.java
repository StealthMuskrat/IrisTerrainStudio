// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;

import art.arcane.iris.spi.PlatformRegistries;
import art.arcane.volmlib.nativelib.terrain.*;
import art.arcane.volmlib.nativelib.item.NativeItem;
import art.arcane.volmlib.nativelib.entity.NativeEntityType;
import com.google.gson.stream.*;
import com.mojang.brigadier.StringReader;
import java.io.*;
import java.util.*;

/** Worker platform handles backed exclusively by the pinned native registry export. */
public final class BrowserRegistries implements PlatformRegistries {
    static final String[] FLAGS={"isAir","isSolid","isOccluding","isFluid","isWater","isWaterLogged","isLit","isUpdatable","isFoliage","isTreeBlock","isFoliagePlantable","isDecorant","isStorage","isStorageChest","isOre","isDeepSlate","isVineBlock","hasTileEntity"};
    static final class BlockType {
        final String name;final int defaultState;final String[] order;final boolean leaf;
        BlockType(String name,int state,String[] order,boolean leaf){this.name=name;this.defaultState=state;this.order=order;this.leaf=leaf;}
    }
    static final class State {
        final int id,type,flags,faces;final String key;final String[] values;
        State(int id,int type,String key,int flags,int faces,String[] values){this.id=id;this.type=type;this.key=key;this.flags=flags;this.faces=faces;this.values=values;}
    }
    private final List<BlockType> types=new ArrayList<>();
    private final List<State> states=new ArrayList<>();
    private final Map<String,Integer> typeIds=new LinkedHashMap<>();
    private final Map<String,State> byKey=new HashMap<>();
    private final Map<Integer,BrowserBlockState> interned=new HashMap<>();
    private final Map<String,List<String>> keys=new LinkedHashMap<>();
    private final Map<String,Set<String>> keySets=new HashMap<>();
    private final Map<String,String> deep=new LinkedHashMap<>(),normal=new LinkedHashMap<>(),entityCategories=new LinkedHashMap<>();
    private final Map<String,List<NativeBlockProperty>> properties=new LinkedHashMap<>();
    private final Map<Integer,RotationState> rotationHandles=new HashMap<>();
    private final Map<Integer,List<RotationProperty>> rotationLayouts=new HashMap<>();
    BlockType rotationType(int type){return types.get(type);}
    State rotationDefault(int type){return states.get(types.get(type).defaultState);}
    RotationState rotationHandle(State state){return rotationHandles.computeIfAbsent(state.id,ignored->new RotationState(this,state));}
    RotationState rotationState(int type,String[] values){State state=byKey.get(canonical(type,values));if(state==null)throw studio.engine.UnsupportedPlatform.unavailable("Rotated state absent from native registry");return rotationHandle(state);}
    List<RotationProperty> rotationProperties(int type){return rotationLayouts.computeIfAbsent(type,index->{
        var block=types.get(index);var layout=RotationBindings.properties(block.name);var descriptors=properties.get(block.name);
        if(layout.size()!=descriptors.size())throw studio.engine.UnsupportedPlatform.unavailable("Rotation metadata coverage differs from native registry");
        for(var property:layout){var descriptor=descriptors.stream().filter(value->value.name().equals(property.name)).findFirst().orElseThrow(()->studio.engine.UnsupportedPlatform.unavailable("Missing native rotation property descriptor"));Set<String> allowed=new HashSet<>();for(Object value:descriptor.allowedValues())allowed.add(String.valueOf(value));
            if(!allowed.equals(new HashSet<>(property.serialized)))throw studio.engine.UnsupportedPlatform.unavailable("Rotation metadata domain differs from native registry");
        }return layout;
    });}
    private byte[] placement;
    private boolean preventLeafDecay=new art.arcane.iris.configuration.IrisSettings.IrisSettingsGenerator().isPreventLeafDecay();

    public static BrowserRegistries read(String text)throws IOException{
        if(text==null||text.length()>16*1024*1024)throw new IllegalArgumentException("Native registry input exceeds its text budget");
        BrowserRegistries result=new BrowserRegistries();List<List<NativeBlockProperty>> groups=new ArrayList<>();Map<String,Integer> assignments=new LinkedHashMap<>();boolean faceLayout=false;
        try(JsonReader reader=new JsonReader(new java.io.StringReader(text))){
            reader.beginObject();while(reader.hasNext())switch(reader.nextName()){
                case"formatVersion"->{if(reader.nextInt()!=2)throw new IllegalArgumentException("Unsupported native registry version");}
                case"scope"->{if(!reader.nextString().equals("native-browser-registry-input"))throw new IllegalArgumentException("Invalid native registry scope");}
                case"minecraft"->{if(!reader.nextString().equals("26.3"))throw new IllegalArgumentException("Native registry version mismatch");}
                case"flagNames"->{if(!Arrays.equals(strings(reader),FLAGS))throw new IllegalArgumentException("Native predicate layout mismatch");}
                case"faceNames"->{faceLayout=true;if(!Arrays.equals(strings(reader),new String[]{"north","east","south","west","up","down"}))throw new IllegalArgumentException("Native full-face support layout mismatch");}
                case"types"->{reader.beginArray();while(reader.hasNext()){
                    if(result.types.size()>=4096)throw new IllegalArgumentException("Too many native block types");
                    String name=null;int state=-1;String[] order=null;boolean leaf=false;reader.beginObject();while(reader.hasNext())switch(reader.nextName()){case"name"->name=reader.nextString();case"defaultState"->state=reader.nextInt();case"order"->order=strings(reader);case"leaf"->leaf=reader.nextBoolean();default->reader.skipValue();}reader.endObject();
                    if(name==null||order==null||order.length>32||!validKey(name)||result.typeIds.put(name,result.types.size())!=null||new HashSet<>(Arrays.asList(order)).size()!=order.length)throw new IllegalArgumentException("Invalid native block type");result.types.add(new BlockType(name,state,order,leaf));
                }reader.endArray();}
                case"states"->{reader.beginArray();while(reader.hasNext()){
                    if(result.states.size()>=131072)throw new IllegalArgumentException("Too many native block states");
                    int id=-1,type=-1,flags=-1,faces=-1;String key=null;String[] values=null;reader.beginObject();while(reader.hasNext())switch(reader.nextName()){case"id"->id=reader.nextInt();case"type"->type=reader.nextInt();case"flags"->flags=reader.nextInt();case"faces"->faces=reader.nextInt();case"key"->key=reader.nextString();case"values"->values=strings(reader);default->reader.skipValue();}reader.endObject();
                    if(id!=result.states.size()||type<0||type>=result.types.size()||key==null||values==null||faces<0||faces>63||flags<0||flags>=(1<<FLAGS.length)||values.length!=result.types.get(type).order.length)throw new IllegalArgumentException("Invalid native state identity");
                    State value=new State(id,type,key,flags,faces,values);if(!result.canonical(type,values).equals(key)||result.byKey.put(key,value)!=null)throw new IllegalArgumentException("Invalid native canonical state key");result.states.add(value);
                }reader.endArray();}
                case"placementBits"->result.placement=Base64.getDecoder().decode(reader.nextString());
                case"toDeepSlate"->stringMap(reader,result.deep);
                case"toNormalOre"->stringMap(reader,result.normal);
                case"entityCategories"->stringMap(reader,result.entityCategories);
                case"keys"->{reader.beginObject();while(reader.hasNext()){String name=reader.nextName();List<String> values=List.of(strings(reader));if(values.isEmpty()||new HashSet<>(values).size()!=values.size()||values.stream().anyMatch(key->!validKey(key))||result.keys.put(name,values)!=null)throw new IllegalArgumentException("Invalid native registry keys");result.keySets.put(name,new HashSet<>(values));}reader.endObject();}
                case"propertyGroups"->{reader.beginArray();while(reader.hasNext()){if(groups.size()>4096)throw new IllegalArgumentException("Too many native property groups");List<NativeBlockProperty> group=new ArrayList<>();reader.beginArray();while(reader.hasNext())group.add(property(reader));reader.endArray();groups.add(List.copyOf(group));}reader.endArray();}
                case"blockPropertyGroups"->{reader.beginObject();while(reader.hasNext()){String name=reader.nextName();assignments.put(name,reader.nextInt());}reader.endObject();}
                default->reader.skipValue();
            }reader.endObject();if(reader.peek()!=JsonToken.END_DOCUMENT)throw new IllegalArgumentException("Trailing native registry data");
        }
        if(!faceLayout)throw new IllegalArgumentException("Native face-support metadata is missing; rebuild the registry");
        if(result.types.isEmpty()||result.states.isEmpty()||result.placement==null||result.placement.length!=(result.types.size()*result.types.size()+7)/8||assignments.size()!=result.types.size())throw new IllegalArgumentException("Incomplete native registry coverage");
        for(BlockType type:result.types){
            if(type.defaultState<0||type.defaultState>=result.states.size()||result.states.get(type.defaultState).type!=result.typeIds.get(type.name))throw new IllegalArgumentException("Invalid native default state");
            Integer group=assignments.get(type.name);if(group==null||group<0||group>=groups.size())throw new IllegalArgumentException("Missing native property group");List<NativeBlockProperty> descriptors=groups.get(group);if(descriptors.size()!=type.order.length)throw new IllegalArgumentException("Native property coverage differs");
            for(int i=0;i<type.order.length;i++){String name=type.order[i];NativeBlockProperty property=descriptors.stream().filter(p->p.name().equals(name)).findFirst().orElseThrow(()->new IllegalArgumentException("Missing native property descriptor"));if(!String.valueOf(property.defaultValue()).equals(result.states.get(type.defaultState).values[i]))throw new IllegalArgumentException("Native property defaults differ");}
            result.properties.put(type.name,descriptors);
        }
        for(String category:List.of("blocks","biomes","structures","items","entities","enchantments","potionEffects","lootTables"))result.list(category);
        if(!result.keySets.get("blocks").equals(result.typeIds.keySet())||!result.entityCategories.keySet().equals(result.keySets.get("entities")))throw new IllegalArgumentException("Native registry type metadata differs");
        for(var mapping:List.of(result.deep,result.normal))for(var entry:mapping.entrySet())if(!result.typeIds.containsKey(entry.getKey())||!result.byKey.containsKey(entry.getValue()))throw new IllegalArgumentException("Invalid native ore conversion");
        result.air();
        return result;
    }
    private static String[] strings(JsonReader reader)throws IOException{List<String> values=new ArrayList<>();reader.beginArray();while(reader.hasNext()){if(values.size()>=65536)throw new IllegalArgumentException("Native registry list is too large");values.add(reader.nextString());}reader.endArray();return values.toArray(String[]::new);}
    private static void stringMap(JsonReader reader,Map<String,String> result)throws IOException{reader.beginObject();while(reader.hasNext()){if(result.size()>=65536)throw new IllegalArgumentException("Native registry map is too large");String name=reader.nextName();if(result.put(name,reader.nextString())!=null)throw new IllegalArgumentException("Duplicate native registry entry");}reader.endObject();}
    private static Object scalar(JsonReader reader)throws IOException{return switch(reader.peek()){case STRING->reader.nextString();case BOOLEAN->reader.nextBoolean();case NUMBER->reader.nextInt();case NULL->{reader.nextNull();yield null;}default->throw new IllegalArgumentException("Invalid native property scalar");};}
    private static NativeBlockProperty property(JsonReader reader)throws IOException{
        String name=null,type=null;Object value=null;List<Object> allowed=new ArrayList<>();NativeNumericRange range=null;reader.beginObject();while(reader.hasNext())switch(reader.nextName()){
            case"name"->name=reader.nextString();case"jsonType"->type=reader.nextString();case"defaultValue"->value=scalar(reader);
            case"allowedValues"->{reader.beginArray();while(reader.hasNext()){if(allowed.size()>=4096)throw new IllegalArgumentException("Native property domain is too large");allowed.add(scalar(reader));}reader.endArray();}
            case"numericRange"->{if(reader.peek()==JsonToken.NULL)reader.nextNull();else{double minimum=Double.NaN,maximum=Double.NaN;boolean exclusiveMinimum=false,exclusiveMaximum=false;reader.beginObject();while(reader.hasNext())switch(reader.nextName()){case"minimum"->minimum=reader.nextDouble();case"maximum"->maximum=reader.nextDouble();case"exclusiveMinimum"->exclusiveMinimum=reader.nextBoolean();case"exclusiveMaximum"->exclusiveMaximum=reader.nextBoolean();default->reader.skipValue();}reader.endObject();if(!Double.isFinite(minimum)||!Double.isFinite(maximum)||minimum>maximum)throw new IllegalArgumentException("Invalid native numeric range");range=new NativeNumericRange(minimum,maximum,exclusiveMinimum,exclusiveMaximum);}}
            default->reader.skipValue();
        }reader.endObject();if(name==null||type==null||value==null||!List.of("boolean","integer","string").contains(type)||!allowed.contains(value))throw new IllegalArgumentException("Invalid native property metadata");return new NativeBlockProperty(name,type,value,List.copyOf(allowed),range);
    }
    private static boolean validKey(String key){return key!=null&&key.matches("[a-z0-9_.-]+:[a-z0-9_./-]+");}
    String canonical(int type,String[] values){BlockType block=types.get(type);StringBuilder key=new StringBuilder(block.name);if(values.length>0){key.append('[');for(int i=0;i<values.length;i++){if(i>0)key.append(',');key.append(block.order[i]).append('=').append(values[i]);}key.append(']');}return key.toString();}
    public int faceSupport(String key){return ((BrowserBlockState)decodeBlockState(key)).state.faces;}
    public boolean isFaceSturdy(NativeBlockState state,int face){if(!(state instanceof BrowserBlockState value)||value.owner!=this||face<0||face>=6)throw new IllegalArgumentException("Face support requires an owned native state");return (value.state.faces&(1<<face))!=0;}
    BrowserBlockState intern(State state,Map<String,String> parsed){return interned.computeIfAbsent(state.id,id->new BrowserBlockState(this,state,parsed));}
    BrowserBlockState direct(State state){return intern(state,null);}
    private BrowserBlockState strict(String text){
        if(text==null||text.length()>4096)throw new IllegalArgumentException("Invalid block-state text");
        StringReader reader=new StringReader(text);int start=reader.getCursor();while(reader.canRead()&&identifierCharacter(reader.peek()))reader.skip();String name=text.substring(start,reader.getCursor());int colon=name.indexOf(':');if(colon<0)name="minecraft:"+name;else if(colon==0)name="minecraft"+name;
        Integer type=typeIds.get(name);if(type==null)throw new IllegalArgumentException("Unknown native block: "+name);BlockType block=types.get(type);String[] values=states.get(block.defaultState).values.clone();Map<String,String> parsed=new LinkedHashMap<>();
        if(reader.canRead()&&reader.peek()=='['){reader.skip();reader.skipWhitespace();while(reader.canRead()&&reader.peek()!=']'){
            try{
                reader.skipWhitespace();String property=reader.readString();int index=Arrays.asList(block.order).indexOf(property);if(index<0||parsed.containsKey(property))throw new IllegalArgumentException("Unknown or repeated native property");reader.skipWhitespace();if(!reader.canRead()||reader.read()!='=')throw new IllegalArgumentException("Expected a native property value");reader.skipWhitespace();String raw=reader.readString(),value=normalize(block,property,raw);values[index]=value;parsed.put(property,value);reader.skipWhitespace();if(reader.canRead()){if(reader.peek()==',')reader.skip();else if(reader.peek()==']')break;else throw new IllegalArgumentException("Expected end of native properties");}
            }catch(com.mojang.brigadier.exceptions.CommandSyntaxException failure){throw new IllegalArgumentException("Invalid native property syntax",failure);}
        }if(!reader.canRead()||reader.read()!=']')throw new IllegalArgumentException("Unclosed native properties");}
        if(reader.canRead())throw new IllegalArgumentException("Trailing native block-state content");State state=byKey.get(canonical(type,values));if(state==null)throw new IllegalArgumentException("Unknown native state combination");return intern(state,Map.copyOf(parsed));
    }
    private static boolean identifierCharacter(char c){return c>='a'&&c<='z'||c>='0'&&c<='9'||c=='_'||c==':'||c=='/'||c=='.'||c=='-';}
    private String normalize(BlockType type,String name,String raw){NativeBlockProperty property=properties.get(type.name).stream().filter(p->p.name().equals(name)).findFirst().orElseThrow();String value=raw;if(property.jsonType().equals("integer")){try{value=Integer.toString(Integer.parseInt(raw));}catch(NumberFormatException failure){throw new IllegalArgumentException("Invalid native integer property",failure);}}for(Object candidate:property.allowedValues())if(String.valueOf(candidate).equals(value))return value;throw new IllegalArgumentException("Unknown native property value");}
    @Override public NativeBlockState decodeBlockState(String key){return strict(key.trim());}
    @Override public NativeBlockState blockOrNull(String key){return blockOrNull(key,false);}
    @Override public NativeBlockState blockOrNull(String key,boolean warn){
        if(key==null)return null;String text=key.trim();if(text.startsWith("minecraft:cauldron[level="))text=text.replace(":cauldron[",":water_cauldron[");if(text.equals("minecraft:grass_path"))return direct(states.get(types.get(typeIds.get("minecraft:dirt_path")).defaultState));
        String lower=text.toLowerCase(Locale.ROOT);BrowserBlockState state=create(lower);if(state==null)state=create("minecraft:"+lower);if(state==null)return null;BlockType type=types.get(state.state.type);if(type.leaf){State updated=byKey.get(BlockStateKey.withProperty(state.key(),"persistent",Boolean.toString(preventLeafDecay)));if(updated==null)throw new IllegalStateException("Native leaf decay metadata is incomplete");return intern(updated,state.parsed);}return state;
    }
    private BrowserBlockState create(String text){try{return strict(text);}catch(IllegalArgumentException failure){int bracket=text.indexOf('[');return bracket<0?null:create(text.substring(0,bracket));}}
    @Override public NativeBlockState block(String key){NativeBlockState state=blockOrNull(key,true);return state==null?air():state;}
    @Override public NativeBlockState air(){return direct(states.get(types.get(typeIds.get("minecraft:air")).defaultState));}
    @Override public NativeBlockState deepSlateOre(NativeBlockState block,NativeBlockState ore){BrowserBlockState onto=owned(block),source=owned(ore);String mapped=(onto.isDeepSlate()?deep:normal).get(source.materialKey());return mapped==null?direct(source.state):direct(byKey.get(mapped));}
    BrowserBlockState owned(NativeBlockState state){if(!(state instanceof BrowserBlockState value)||value.owner!=this)throw new IllegalArgumentException("Native states belong to different registry instances");return value;}
    boolean canPlace(BrowserBlockState block,NativeBlockState other){BrowserBlockState onto=owned(other);int bit=block.state.type*types.size()+onto.state.type;return(placement[bit>>>3]&(1<<(bit&7)))!=0;}
    @Override public NativeBiome biome(String key){String name=normalizedKey(key);return keySets.get("biomes").contains(name)?new BiomeValue(name):null;}
    @Override public NativeItem item(String key){String name=normalizedKey(key.trim().toLowerCase(Locale.ROOT).replace(' ','_'));return keySets.get("items").contains(name)?new ItemValue(name):null;}
    @Override public NativeEntityType entity(String key){String name=normalizedKey(key);return keySets.get("entities").contains(name)?new EntityValue(name,entityCategories.get(name)):null;}
    private static String normalizedKey(String key){return key.indexOf(':')<0?"minecraft:"+key:key;}
    private record BiomeValue(String key)implements NativeBiome{public String namespace(){return BlockStateKey.namespace(key);}public Object nativeHandle(){return this;}}
    private record ItemValue(String key)implements NativeItem{public String namespace(){return BlockStateKey.namespace(key);}public Object nativeHandle(){return this;}}
    private record EntityValue(String key,String spawnCategory)implements NativeEntityType{public String namespace(){return BlockStateKey.namespace(key);}public Object nativeHandle(){return this;}}
    private List<String> list(String category){List<String> values=keys.get(category);if(values==null)throw new IllegalStateException("Missing native registry: "+category);return values;}
    @Override public List<String> blockKeys(){return list("blocks");}
    @Override public List<String> blockTypeKeys(){return list("blocks");}
    @Override public List<String> biomeKeys(){return list("biomes");}
    @Override public List<String> structureKeys(){return list("structures");}
    @Override public List<String> itemKeys(){return list("items");}
    @Override public List<String> entityKeys(){return list("entities");}
    @Override public List<String> enchantmentKeys(){return list("enchantments");}
    @Override public List<String> potionEffectKeys(){return list("potionEffects");}
    @Override public List<String> lootTableKeys(){return list("lootTables");}
    @Override public Map<String,List<NativeBlockProperty>> blockStateProperties(){return Collections.unmodifiableMap(properties);}
    public int stateCount(){return states.size();}
    public int typeCount(){return types.size();}
    /** Full canonical state metadata; independent of native first-parse matching masks. */
    public String describeRendering(String key)throws IOException{
        State state=byKey.get(key);if(state==null)throw new IllegalArgumentException("Painted state is absent from the native registry");BlockType type=types.get(state.type);java.io.StringWriter output=new java.io.StringWriter();
        try(JsonWriter writer=new JsonWriter(output)){writer.beginObject();writer.name("id").value(type.name);writer.name("stateKey").value(state.key);writer.name("nativeStateId").value(state.id);writer.name("nativeFlags").value(state.flags);writer.name("air").value((state.flags&1)!=0);writer.name("properties").beginObject();for(int i=0;i<type.order.length;i++)writer.name(type.order[i]).value(state.values[i]);writer.endObject();writer.endObject();}return output.toString();
    }
    public String describe(String text,boolean strict)throws IOException{
        BrowserBlockState value=(BrowserBlockState)(strict?decodeBlockState(text):blockOrNull(text));java.io.StringWriter output=new java.io.StringWriter();try(JsonWriter writer=new JsonWriter(output)){if(value==null)writer.nullValue();else{writer.beginObject();writer.name("key").value(value.key());writer.name("flags").value(value.state.flags);writer.name("parsed");if(value.parsed==null)writer.nullValue();else{writer.beginObject();for(var entry:value.parsed.entrySet())writer.name(entry.getKey()).value(entry.getValue());writer.endObject();}writer.endObject();}}return output.toString();
    }
}
