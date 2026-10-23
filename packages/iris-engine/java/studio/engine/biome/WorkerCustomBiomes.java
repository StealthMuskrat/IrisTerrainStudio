// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.biome;

import art.arcane.iris.generation.terrain.IrisDimension;
import art.arcane.iris.pack.loading.IrisData;
import art.arcane.iris.world.history.GenerationRegistryContractFactory;
import art.arcane.iris.pack.datapack.v263.DataFixerV263;
import studio.engine.registry.BrowserRegistries;
import com.google.gson.*;
import com.google.gson.stream.*;
import java.io.*;
import java.math.BigDecimal;
import java.util.*;

/** Content-addressed authoring handles, scoped to one worker terrain context; no live registry epoch. */
public final class WorkerCustomBiomes {
    private record Definition(String dimension,String id,String json){}
    private static BrowserRegistries registry;
    private static IrisData data;
    private static final Map<String,Definition> definitions=new LinkedHashMap<>();
    private static final Map<String,String> names=new LinkedHashMap<>();
    private static int characters;
    /** Bounded Gson streaming tree IO avoids unrelated reflective/SQL type-adapter initialization. */
    public static JsonElement parse(String text){
        if(text.length()>65536)throw new IllegalArgumentException("Custom biome semantic JSON exceeds its budget");
        try(var reader=new JsonReader(new StringReader(text))){var value=read(reader,new int[1],0);if(reader.peek()!=JsonToken.END_DOCUMENT)throw new IOException("Trailing biome JSON");return value;}catch(IOException failure){throw new IllegalArgumentException("Invalid custom biome semantic JSON",failure);}
    }
    private static JsonElement read(JsonReader reader,int[] nodes,int depth)throws IOException{
        if(++nodes[0]>4096||depth>64)throw new IOException("Custom biome JSON exceeds its node/depth budget");
        return switch(reader.peek()){
            case NULL->{reader.nextNull();yield JsonNull.INSTANCE;}
            case BOOLEAN->new JsonPrimitive(reader.nextBoolean());case STRING->new JsonPrimitive(reader.nextString());case NUMBER->new JsonPrimitive(new BigDecimal(reader.nextString()));
            case BEGIN_ARRAY->{var a=new JsonArray();reader.beginArray();while(reader.hasNext())a.add(read(reader,nodes,depth+1));reader.endArray();yield a;}
            case BEGIN_OBJECT->{var o=new JsonObject();reader.beginObject();while(reader.hasNext()){String key=reader.nextName();if(o.has(key))throw new IOException("Duplicate biome JSON member");o.add(key,read(reader,nodes,depth+1));}reader.endObject();yield o;}
            default->throw new IOException("Invalid biome JSON token");
        };
    }
    public static String json(JsonElement element){try{var text=new StringWriter();try(var writer=new JsonWriter(text)){writer.setSerializeNulls(true);writer.setLenient(true);write(writer,element);}return text.toString();}catch(IOException failure){throw new IllegalArgumentException("Cannot write custom biome semantic JSON",failure);}}
    private static void write(JsonWriter writer,JsonElement value)throws IOException{
        if(value==null||value.isJsonNull())writer.nullValue();else if(value.isJsonObject()){writer.beginObject();for(var e:value.getAsJsonObject().entrySet()){writer.name(e.getKey());write(writer,e.getValue());}writer.endObject();}
        else if(value.isJsonArray()){writer.beginArray();for(var child:value.getAsJsonArray())write(writer,child);writer.endArray();}
        else{var p=value.getAsJsonPrimitive();if(p.isBoolean())writer.value(p.getAsBoolean());else if(p.isNumber())writer.value(p.getAsNumber());else writer.value(p.getAsString());}
    }
    public static void begin(BrowserRegistries owner,IrisData source){clear();registry=Objects.requireNonNull(owner);data=Objects.requireNonNull(source);}
    public static void clear(){registry=null;data=null;definitions.clear();names.clear();characters=0;}
    /** Original factory's readable-name side effect is retained in bounded worker-local storage. */
    public static void registerName(String category,String physical,String readable){
        if(registry==null||!"minecraft:worldgen/biome".equals(category))throw new IllegalStateException("Custom biome names require an owned authoring context");
        if(!physical.matches("iris:biomes/[a-f0-9]{64}")||!readable.matches("[a-z0-9_.-]+:[a-z0-9/._-]+"))throw new IllegalArgumentException("Invalid custom biome resource name");
        String previous=names.get(physical);if(previous!=null&&!previous.equals(readable))throw new IllegalArgumentException("Custom biome already has a different readable name");
        if(previous==null&&names.size()>=128)throw new IllegalArgumentException("Custom biome authoring context exceeds 128 definitions");names.put(physical,readable);
    }
    public static void prepare(IrisDimension dimension){
        if(registry==null)throw new IllegalStateException("Custom biomes require an owned registry");
        for(var biome:dimension.getReachableBiomes(()->data)){
            if(biome==null||!biome.isCustom()||biome.getCustomDerivitives()==null)continue;
            for(var custom:biome.getCustomDerivitives()){
                if(custom==null||custom.getId().isBlank()||custom.getId().length()>256||!Double.isFinite(custom.getTemperature())||!Double.isFinite(custom.getHumidity()))throw new IllegalArgumentException("Custom biome requires a bounded ID and finite climate values");
                if(custom.getSpawns()!=null&&custom.getSpawns().size()>64)throw new IllegalArgumentException("Custom biome spawn metadata exceeds its 64-entry authoring budget");
                String key=GenerationRegistryContractFactory.customBiomeResourceKey(dimension.getLoadKey(),custom,data.getContentGate());
                if(definitions.containsKey(key))continue;
                String json=custom.generateJson(new DataFixerV263(),data.getContentGate());
                if(json.length()>65536||json.length()>1048576-characters)throw new IllegalArgumentException("Custom biome definitions exceed their bounded JSON budget");
                if(definitions.size()>=128)throw new IllegalArgumentException("Custom biome authoring context exceeds 128 definitions");
                definitions.put(key,new Definition(dimension.getLoadKey(),custom.getId(),json));characters+=json.length();
            }
        }
    }
    public static boolean contains(BrowserRegistries owner,String key){return registry==owner&&definitions.containsKey(key);}
    public static void describe(JsonWriter writer)throws IOException{
        writer.name("customBiomes").beginArray();for(var entry:definitions.entrySet()){var value=entry.getValue();writer.beginObject();writer.name("key").value(entry.getKey());writer.name("dimension").value(value.dimension);writer.name("id").value(value.id);writer.name("readableKey").value(names.get(entry.getKey()));writer.name("definitionJson").value(value.json);writer.endObject();}writer.endArray();
        writer.name("customBiomeBinding").value("content-addressed-authoring");writer.name("nativeRegistryEpoch").value(false);
    }
}
