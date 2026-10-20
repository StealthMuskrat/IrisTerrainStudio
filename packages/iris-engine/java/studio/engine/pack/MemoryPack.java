// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;

import art.arcane.iris.pack.loading.*;
import art.arcane.iris.pack.validation.ContentGate;
import art.arcane.iris.pack.validation.CompatStatus;
import art.arcane.iris.generation.terrain.*;
import art.arcane.iris.generation.biome.IrisBiome;
import art.arcane.iris.generation.noise.*;
import art.arcane.iris.generation.block.IrisBlockData;
import art.arcane.iris.generation.image.IrisImageMap;
import com.google.gson.stream.*;
import studio.engine.config.NativeConfigReader;
import java.io.*;
import java.util.*;
import art.arcane.iris.spi.PlatformRegistries;

/** Worker-owned immutable authoring snapshot. No filesystem or server generation calls. */
public final class MemoryPack {
    private static final Map<IrisData,MemoryPack> OWNERS=new IdentityHashMap<>();
    private static MemoryPack opening;
    private final Map<String,String> resources=new LinkedHashMap<>();
    private final Map<String,MemoryResourceLoader<?>> loaders=new LinkedHashMap<>();
    private int bytes;
    private IrisData data;
    private ContentGate gate;
    private final PlatformRegistries registries;
    public MemoryPack(){this(null);}
    public MemoryPack(PlatformRegistries registries){this.registries=registries;}

    public void register(String path,String text){
        if(data!=null)throw new IllegalStateException("The native pack snapshot is sealed");
        validatePath(path);
        if(text==null||text.length()>4*1024*1024)throw new IllegalArgumentException("Pack resource exceeds the native reader text budget");
        String prior=resources.get(path);int total=bytes+2*(text.length()-(prior==null?0:prior.length()));
        if((resources.size()>=4096&&prior==null)||total>64*1024*1024)throw new IllegalArgumentException("Native pack snapshot exceeds its memory budget");
        resources.put(path,text);bytes=total;
    }
    public static void validatePath(String path){
        if(path==null||path.length()>1024||!path.endsWith(".json")||path.contains("\\")||path.contains(":")||Arrays.stream(path.split("/",-1)).anyMatch(part->part.isEmpty()||part.equals(".")||part.equals("..")||part.chars().anyMatch(c->c<32)))throw new IllegalArgumentException("Invalid pack JSON resource path");
    }
    public IrisData open(){
        if(data!=null)return data;
        if(opening!=null)throw new IllegalStateException("A pack snapshot is already opening");
        NativeConfigReader.bindResourceProvider(resources::get);
        opening=this;
        try{data=IrisData.openDatapackCompiler(new File("/iris-memory-pack"));return data;}catch(RuntimeException|Error failure){release();throw failure;}finally{opening=null;}
    }
    /** Called instead of filesystem hotload initialization by the browser platform plugin. */
    public static void initialize(IrisData data){
        MemoryPack pack=opening;if(pack==null)throw new IllegalStateException("Native pack data requires a worker snapshot");
        if(OWNERS.containsKey(data))throw new IllegalStateException("Native pack data already initialized");
        OWNERS.put(data,pack);pack.data=data;
        data.setDimensionLoader(pack.loader(new IrisDimension(),IrisDimension.class));
        data.setRegionLoader(pack.loader(new IrisRegion(),IrisRegion.class));
        data.setBiomeLoader(pack.loader(new IrisBiome(),IrisBiome.class));
        data.setGeneratorLoader(pack.loader(new IrisGenerator(),IrisGenerator.class));
        data.setBlockLoader(pack.loader(new IrisBlockData(),IrisBlockData.class));
        data.setExpressionLoader(pack.loader(new IrisExpression(),IrisExpression.class));
        data.setImageMapLoader(pack.loader(new IrisImageMap(),IrisImageMap.class));
        pack.gate=new ContentGate(pack.registries,pack::fallbacks,data.getCompatReport(),key->data.getBlockLoader().load(key,false));
        if(pack.registries==null)data.getCompatReport().markIncomplete("Browser native registry is not installed");
    }
    private <T extends IrisRegistrant> MemoryResourceLoader<T> loader(T defaults,Class<T> type){
        MemoryResourceLoader<T> loader=new MemoryResourceLoader<>(this,data,defaults.getFolderName(),defaults.getTypeName(),type);loaders.put(defaults.getFolderName(),loader);data.getLoaders().put(type,loader);return loader;
    }
    public static ContentGate contentGate(IrisData data){return owner(data).gate;}
    public static MemoryPack owner(IrisData data){MemoryPack pack=OWNERS.get(data);if(pack==null)throw new IllegalStateException("No worker snapshot owns this native data instance");return pack;}
    public IrisRegistrant load(String folder,String name){if(data==null)throw new IllegalStateException("Open the pack snapshot first");MemoryResourceLoader<?> loader=loaders.get(folder);if(loader==null)throw new IllegalArgumentException("Native resource folder is not linked: "+folder);return loader.load(name);}
    public int resourceCount(){return resources.size();}
    public boolean compatibilityReady(){return gate!=null&&gate.ready()&&!data.getCompatReport().isIncomplete();}
    public void requireGenerationReady(){if(!compatibilityReady())throw new IllegalStateException("Native pack compatibility is incomplete; terrain generation is unavailable");}
    public void release(){if(data!=null)OWNERS.remove(data);for(var loader:loaders.values())loader.clearCache();loaders.clear();data=null;gate=null;resources.clear();bytes=0;NativeConfigReader.bindResourceProvider(null);}
    String text(String path){return resources.get(path);}
    String resolve(String folder,String name){
        if(name.contains(":"))return null; // Native getFolders(name) rejects foreign prefixes.
        String exact=folder+"/"+name+".json";validatePath(exact);if(resources.containsKey(exact))return exact;
        if(name.contains("/"))return null;
        String prefix=folder+"/",selected=null;
        for(String path:resources.keySet())if(path.startsWith(prefix)){
            String file=path.substring(prefix.length());if(file.contains("/"))continue;
            int dot=file.indexOf('.');if(dot>=0&&file.substring(0,dot).equals(name)&&(selected==null||path.compareTo(selected)<0))selected=path;
        }
        return selected;
    }
    String[] keys(String folder){String prefix=folder+"/";Set<String> keys=new HashSet<>();for(String path:resources.keySet())if(path.startsWith(prefix))keys.add(path.substring(prefix.length(),path.length()-5));return keys.toArray(new String[0]);}
    private Map<String,String> fallbacks(){
        Map<String,String> result=new LinkedHashMap<>();
        for(var resource:resources.entrySet())if(resource.getKey().startsWith("dimensions/")&&resource.getKey().indexOf('/',11)<0){
            try(JsonReader reader=new JsonReader(new StringReader(resource.getValue()))){
                reader.beginObject();while(reader.hasNext()){
                    if(!reader.nextName().equals("blockFallbacks")){reader.skipValue();continue;}
                    reader.beginObject();while(reader.hasNext()){String key=reader.nextName();if(reader.peek()==JsonToken.STRING){String state=reader.nextString();if(!state.isBlank())result.putIfAbsent(key,state);}else reader.skipValue();}reader.endObject();
                }reader.endObject();
            }catch(IOException|RuntimeException failure){throw new IllegalArgumentException("Cannot load native dimension fallbacks: "+resource.getKey(),failure);}
        }
        return Collections.unmodifiableMap(result);
    }
}
