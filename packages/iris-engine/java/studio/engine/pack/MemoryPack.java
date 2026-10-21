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
    private static long snapshotSequence;
    private final String objectRoot="/iris-memory-objects/"+(++snapshotSequence);
    private final studio.engine.noise.MemoryNoiseStore noiseCache=new studio.engine.noise.MemoryNoiseStore(this,objectRoot+"/noise");
    public studio.engine.noise.MemoryNoiseStore noiseCache(){return noiseCache;}
    private final Map<String,String> resources=new LinkedHashMap<>();
    private final Map<String,byte[]> objects=new LinkedHashMap<>();
    private MemoryObjectLoader objectLoader;
    private MemoryImageLoader imageLoader;
    private final Map<String,studio.engine.image.WorkerImagePixels> images=new LinkedHashMap<>();
    private final Map<String,Integer> imageSizes=new LinkedHashMap<>();
    private final Map<String,MemoryResourceLoader<?>> loaders=new LinkedHashMap<>();
    private int bytes;private long imageCompileWorkBytes;private long expressionCompileWork;private int expressionCount;
    public String expressionStatistics(){return "{\"execution\":\"native-emitted-instructions\",\"compiledExpressions\":"+expressionCount+",\"compileWorkCharged\":"+expressionCompileWork+",\"compileWorkLimit\":4194304,\"maxExpressions\":64,\"instructionLimit\":2048,\"evaluationDepthLimit\":32,\"evaluationStepLimit\":65536}";}
    public void reserveExpression(long work){if(++expressionCount>64||work>4L*1024*1024-expressionCompileWork)throw studio.engine.expression.WorkerExpressions.failure("Expression compilation exceeds its snapshot budget");expressionCompileWork+=work;}
    private final Map<String,art.arcane.iris.generation.image.CompiledIrisImageMap> compiledImages=new LinkedHashMap<>();
    private final Map<String,studio.engine.image.DimensionImageMaps> dimensionImageMaps=new LinkedHashMap<>();
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
        if((resourceCount()>=4096&&prior==null)||total>64*1024*1024)throw new IllegalArgumentException("Native pack snapshot exceeds its memory budget");
        resources.put(path,text);bytes=total;
    }
    public void registerObject(String path,String binary){
        if(data!=null)throw new IllegalStateException("The native pack snapshot is sealed");
        validateObjectPath(path);
        if(binary==null||binary.length()>8*1024*1024)throw new IllegalArgumentException("Native object exceeds 8 MiB");
        byte[] prior=objects.get(path);int total=bytes+binary.length()-(prior==null?0:prior.length);
        if((resourceCount()>=4096&&prior==null)||total>64*1024*1024)throw new IllegalArgumentException("Native pack snapshot exceeds its memory budget");
        byte[] value=new byte[binary.length()];for(int i=0;i<value.length;i++){char c=binary.charAt(i);if(c>255)throw new IllegalArgumentException("Object transport must contain bytes");value[i]=(byte)c;}
        objects.put(path,value);bytes=total;
    }
    public void registerImage(String path,int width,int height,int channels,int depth,String binary){registerImage(path,width,height,channels,depth,binary,null);}
    public void registerIndexedImage(String path,int width,int height,int depth,String binary,String palette){if(palette==null||palette.length()<8||palette.length()>1024)throw new IllegalArgumentException("Invalid indexed image palette");registerImage(path,width,height,1,depth,binary,palette);}
    private void registerImage(String path,int width,int height,int channels,int depth,String binary,String palette){
        if(data!=null)throw new IllegalStateException("The native pack snapshot is sealed");validateImagePath(path);
        int size=binary==null?0:binary.length()+(palette==null?0:palette.length());
        if(binary==null||size>16*1024*1024)throw new IllegalArgumentException("Decoded image exceeds 16 MiB");
        int total=bytes+size-imageSizes.getOrDefault(path,0);if((resourceCount()>=4096&&!images.containsKey(path))||total>64*1024*1024)throw new IllegalArgumentException("Native pack snapshot exceeds its memory budget");
        var pixels=new studio.engine.image.WorkerImagePixels(width,height,channels,depth,imageBytes(binary),palette==null?null:imageBytes(palette));images.put(path,pixels);imageSizes.put(path,size);bytes=total;
    }
    private static byte[] imageBytes(String binary){byte[] samples=new byte[binary.length()];for(int i=0;i<samples.length;i++){char c=binary.charAt(i);if(c>255)throw new IllegalArgumentException("Image transport must contain bytes");samples[i]=(byte)c;}return samples;}
    static void validateImagePath(String path){if(path==null||!path.startsWith("images/")||!path.endsWith(".png"))throw new IllegalArgumentException("Invalid native image path");validatePath(path.substring(0,path.length()-4)+".json");}
    String imagePath(String name){
        if(name.contains(":"))return null;String exact="images/"+name+".png";validateImagePath(exact);if(images.containsKey(exact))return exact;if(name.contains("/"))return null;String selected=null;
        for(String path:images.keySet()){String file=path.substring(7);if(file.contains("/"))continue;int dot=file.indexOf('.');if(dot>=0&&file.substring(0,dot).equals(name)&&(selected==null||path.compareTo(selected)<0))selected=path;}return selected;
    }
    studio.engine.image.WorkerImagePixels image(String name){String path=imagePath(name);return path==null?null:images.get(path);}
    String[] imageKeys(){return images.keySet().stream().map(path->path.substring(7,path.length()-4)).toArray(String[]::new);}
    public static void reserveImageCompile(art.arcane.iris.generation.image.IrisImageMap definition,art.arcane.iris.generation.image.IrisImage image){
        if(definition==null||image==null)return;MemoryPack pack=owner(image.getLoader());long charge=4096L+4L*image.getWidth()*image.getHeight()*(definition.getSmoothingRadius()>0?2:1);
        if(charge>64L*1024*1024-pack.imageCompileWorkBytes)throw studio.engine.UnsupportedPlatform.unavailable("Native image-map compilation exceeds the snapshot work budget");pack.imageCompileWorkBytes+=charge;
    }
    public art.arcane.iris.generation.image.CompiledIrisImageMap compiledImage(String name){
        open();var prior=compiledImages.get(name);if(prior!=null)return prior;if(compiledImages.size()>=32)throw studio.engine.UnsupportedPlatform.unavailable("Native image-map diagnostic cache exceeds 32 entries");
        var resource=load("image-maps",name);if(!(resource instanceof art.arcane.iris.generation.image.IrisImageMap definition))throw new IllegalArgumentException("Missing native image-map resource: "+name);
        var image=imageLoader.load(definition.getSource());if(image==null)throw new IllegalArgumentException("Missing PNG for native image map: "+name);
        try{var result=art.arcane.iris.generation.image.CompiledIrisImageMap.compile(definition,image);compiledImages.put(name,result);return result;}finally{imageLoader.unload(definition.getSource());}
    }
    public studio.engine.image.DimensionImageMaps dimensionImageMaps(String key){
        open();requireGenerationReady();var prior=dimensionImageMaps.get(key);if(prior!=null)return prior;
        if(dimensionImageMaps.size()>=16)throw studio.engine.UnsupportedPlatform.unavailable("Dimension image-map inspection exceeds 16 cached dimensions");
        var resource=load("dimensions",key);if(!(resource instanceof IrisDimension dimension)||dimension.isCompatExcluded())throw new IllegalArgumentException("Native dimension is missing or excluded");
        var result=new studio.engine.image.DimensionImageMaps(data,dimension);dimensionImageMaps.put(key,result);return result;
    }
    static void validateObjectPath(String path){
        if(path==null||!path.startsWith("objects/")||!path.endsWith(".iob"))throw new IllegalArgumentException("Invalid native object path");
        validatePath(path.substring(0,path.length()-4)+".json");
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
        pack.imageLoader=new MemoryImageLoader(pack,data);data.setImageLoader(pack.imageLoader);data.getLoaders().put(art.arcane.iris.generation.image.IrisImage.class,pack.imageLoader);
        pack.objectLoader=new MemoryObjectLoader(pack,data);data.setObjectLoader(pack.objectLoader);data.getLoaders().put(art.arcane.iris.structure.object.IrisObject.class,pack.objectLoader);
        pack.gate=new ContentGate(pack.registries,pack::fallbacks,data.getCompatReport(),key->data.getBlockLoader().load(key,false));
        if(pack.registries==null)data.getCompatReport().markIncomplete("Browser native registry is not installed");
    }
    private <T extends IrisRegistrant> MemoryResourceLoader<T> loader(T defaults,Class<T> type){
        MemoryResourceLoader<T> loader=new MemoryResourceLoader<>(this,data,defaults.getFolderName(),defaults.getTypeName(),type);loaders.put(defaults.getFolderName(),loader);data.getLoaders().put(type,loader);return loader;
    }
    public static ContentGate contentGate(IrisData data){return owner(data).gate;}
    public static MemoryPack owner(IrisData data){MemoryPack pack=OWNERS.get(data);if(pack==null)throw new IllegalStateException("No worker snapshot owns this native data instance");return pack;}
    public IrisRegistrant load(String folder,String name){if(data==null)throw new IllegalStateException("Open the pack snapshot first");if(folder.equals("objects"))return objectLoader.load(name);if(folder.equals("images"))return imageLoader.load(name);MemoryResourceLoader<?> loader=loaders.get(folder);if(loader==null)throw new IllegalArgumentException("Native resource folder is not linked: "+folder);return loader.load(name);}
    public int resourceCount(){return resources.size()+objects.size()+images.size();}
    public boolean compatibilityReady(){return gate!=null&&gate.ready()&&!data.getCompatReport().isIncomplete();}
    public void requireGenerationReady(){if(!compatibilityReady())throw new IllegalStateException("Native pack compatibility is incomplete; terrain generation is unavailable");}
    public void release(){noiseCache.release();if(data!=null)OWNERS.remove(data);for(var loader:loaders.values())loader.clearCache();loaders.clear();if(objectLoader!=null)objectLoader.clearCache();objectLoader=null;if(imageLoader!=null)imageLoader.clearCache();imageLoader=null;images.clear();imageSizes.clear();compiledImages.clear();dimensionImageMaps.clear();imageCompileWorkBytes=0;expressionCompileWork=0;expressionCount=0;data=null;gate=null;resources.clear();objects.clear();bytes=0;NativeConfigReader.bindResourceProvider(null);}
    public boolean isOpen(){return data!=null&&OWNERS.get(data)==this;}
    String objectFilePath(String name){return objectRoot+"/"+objectPath(name);}
    byte[] objectBytes(String name){return objects.get(objectPath(name));}
    String objectPath(String name){String path="objects/"+name+".iob";validateObjectPath(path);return path;}
    String[] objectKeys(){return objects.keySet().stream().map(path->path.substring(8,path.length()-4)).toArray(String[]::new);}
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
