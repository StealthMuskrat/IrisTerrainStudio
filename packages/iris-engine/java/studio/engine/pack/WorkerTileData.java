// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;

import art.arcane.iris.generation.block.TileData;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.collection.KMap;
import com.google.gson.stream.*;
import java.io.*;
import java.util.*;

/** Modern Iris tile envelope only. Payloads remain data; no Bukkit/NBT/world execution. */
public final class WorkerTileData extends TileData {
    private final String material,json;
    private final byte[] binary;
    private final KMap<String,Object> properties;
    private static int reading,readTiles,readChars,readNodes;
    public static void beginObject(){if(reading!=0)throw new IllegalStateException("Nested tile decode");reading=1;readTiles=readChars=readNodes=0;}
    public static void endObject(){reading=readTiles=readChars=readNodes=0;}
    public static int objectDecodedBytes(){if(reading!=1)throw new IllegalStateException("No object tile decode owns this charge");return readChars*2+readNodes*64+readTiles*128;}
    private WorkerTileData(String material,String json,byte[] binary,KMap<String,Object> properties){this.material=material;this.json=json;this.binary=binary;this.properties=properties;}
    public static TileData read(DataInputStream input)throws IOException{
        String material=input.readUTF();
        if(!material.matches("[a-z0-9_.-]+:[a-z0-9/._-]+"))throw studio.engine.UnsupportedPlatform.unavailable("Legacy or non-namespaced object tile records; modern namespaced tile envelopes only");
        String json=input.readUTF();
        if(reading!=0&&(++readTiles>1024||(readChars+=json.length())>1048576))throw new IOException("Object tile payloads exceed the decode budget");
        var properties=parse(json);return new WorkerTileData(material,json,encode(material,json),properties);
    }
    public static TileData of(NativeBlockState state,KMap<String,Object> properties){
        if(state==null)throw new IllegalArgumentException("Tile data requires a native state");
        NativeBlockState base=state.placementBaseState();if(base==null||!base.hasTileEntity())throw new IllegalArgumentException("Tile data requires a tile-bearing placement base state");
        String material=base.materialKey();
        try{String json=write(properties==null?new KMap<>():properties);return new WorkerTileData(material,json,encode(material,json),parse(json));}
        catch(IOException failure){throw new IllegalArgumentException("Cannot encode modern tile properties",failure);}
    }
    private static byte[] encode(String material,String json)throws IOException{var bytes=new ByteArrayOutputStream();try(var out=new DataOutputStream(bytes)){out.writeUTF(material);out.writeUTF(json);}return bytes.toByteArray();}
    private static final class Budget {int nodes;void enter(int depth)throws IOException{if(depth>64||++nodes>4096||reading!=0&&++readNodes>65536)throw new IOException("Tile properties exceed the value/depth budget");}}
    private static Object value(JsonReader reader,Budget budget,int depth)throws IOException{
        budget.enter(depth);return switch(reader.peek()){
            case NULL->{reader.nextNull();yield null;}
            case STRING->reader.nextString();case BOOLEAN->reader.nextBoolean();
            case NUMBER->{String text=reader.nextString();Number number;try{number=Long.valueOf(text);}catch(NumberFormatException failure){double d=Double.parseDouble(text);if(!Double.isFinite(d))throw new IOException("Non-finite tile number");number=d;}yield number;}
            case BEGIN_ARRAY->{var list=new ArrayList<Object>();reader.beginArray();while(reader.hasNext())list.add(value(reader,budget,depth+1));reader.endArray();yield list;}
            case BEGIN_OBJECT->{var map=new LinkedHashMap<String,Object>();reader.beginObject();while(reader.hasNext()){String key=reader.nextName();if(map.containsKey(key))throw new IOException("Duplicate tile property: "+key);map.put(key,value(reader,budget,depth+1));}reader.endObject();yield map;}
            default->throw new IOException("Invalid tile properties");
        };
    }
    @SuppressWarnings("unchecked") private static KMap<String,Object> parse(String json)throws IOException{
        try(var reader=new JsonReader(new StringReader(json))){Object value=value(reader,new Budget(),0);if(!(value instanceof Map<?,?> map)||reader.peek()!=JsonToken.END_DOCUMENT)throw new IOException("Tile properties require one JSON object");if(map.containsValue(null))throw new IOException("Root tile properties cannot contain null values");return new KMap<>((Map<String,Object>)map);}
    }
    private static void value(JsonWriter writer,Object value,Budget budget,int depth)throws IOException{
        budget.enter(depth);
        if(value==null)writer.nullValue();else if(value instanceof String text)writer.value(text);else if(value instanceof Boolean flag)writer.value(flag);else if(value instanceof Number number){if(!Double.isFinite(number.doubleValue()))throw new IOException("Non-finite tile number");writer.value(number);}
        else if(value instanceof Map<?,?> map){writer.beginObject();for(var entry:map.entrySet()){if(!(entry.getKey() instanceof String key))throw new IOException("Tile object keys must be strings");writer.name(key);value(writer,entry.getValue(),budget,depth+1);}writer.endObject();}
        else if(value instanceof Collection<?> list){writer.beginArray();for(Object child:list)value(writer,child,budget,depth+1);writer.endArray();}
        else throw studio.engine.UnsupportedPlatform.unavailable("Non-JSON tile property value");
    }
    private static String write(Object properties)throws IOException{var text=new StringWriter();try(var writer=new JsonWriter(text)){writer.setSerializeNulls(false);writer.setHtmlSafe(false);value(writer,properties,new Budget(),0);}if(text.getBuffer().length()>65535)throw new IOException("Tile properties exceed the UTF envelope budget");return text.toString();}
    public String propertiesJson(){return json;}
    @Override public String getMaterialKey(){return material;}
    @Override public KMap<String,Object> getProperties(){return properties;}
    @Override public void toBinary(DataOutputStream out)throws IOException{out.write(binary);}
    @Override public TileData clone(){try{return new WorkerTileData(material,json,binary.clone(),parse(json));}catch(IOException failure){throw new IllegalStateException(failure);}}
    @Override public boolean equals(Object other){return other instanceof WorkerTileData tile&&Arrays.equals(binary,tile.binary);}
    @Override public int hashCode(){return Arrays.hashCode(binary);}
    @Override public String toString(){return material+json;}
    public static void describe(TileData tile,JsonWriter writer)throws IOException{
        if(!(tile instanceof WorkerTileData owned))throw studio.engine.UnsupportedPlatform.unavailable("Tile payload belongs to an unconnected platform");
        writer.name("material").value(owned.material);writer.name("propertiesJson").value(owned.json);writer.name("binaryBytes").value(owned.binary.length);
    }
    public static void describeObject(art.arcane.iris.structure.object.IrisObject object,JsonWriter writer)throws IOException{
        writer.name("tilePayloads").beginArray();int count=0;for(var entry:object.getStates()){if(++count>1024)throw new IOException("Object tile inspection exceeds its record budget");var p=entry.getKey();writer.beginObject();writer.name("position").beginArray().value(p.getBlockX()).value(p.getBlockY()).value(p.getBlockZ()).endArray();describe(entry.getValue(),writer);writer.endObject();}writer.endArray();
        writer.name("tilePayloadStorage").value("modern-envelope");writer.name("tileWorldExecution").value(false);
    }
}
