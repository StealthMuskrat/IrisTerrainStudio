// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.pack.loading.*;
import art.arcane.iris.pack.validation.ContentGate;
import art.arcane.iris.spi.*;
import art.arcane.iris.generation.runtime.*;
import art.arcane.iris.generation.terrain.*;
import art.arcane.iris.generation.block.IrisBlockData;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.*;
import com.google.gson.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
/** Independent JVM host for unchanged IrisComplex biome and scalar height composition. */
public final class NativeTerrainLinkCheck {
    private static art.arcane.iris.generation.mantle.EngineMantle caveHost;
    private static JsonObject materialSampling;
    private static final Set<String> NATIVE_DEFAULTS=Set.of("getDimensionStackContext","isAdditionalTerrainOwned","getSubterrainCell","getSubterrainBiome","getCaveBiome","getSurfaceBiome","getHostSurfaceBiome","answersFromNaturalTerrain","getGenerationSessionId","getGenerationSessions");
    public static void main(String[] args)throws Exception{
        Gson gson=new GsonBuilder().serializeNulls().create();JsonObject request=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();JsonArray result=new JsonArray();materialSampling=request.has("materialSampling")?request.getAsJsonObject("materialSampling"):null;
        art.arcane.iris.configuration.IrisSettings.settings=new art.arcane.iris.configuration.IrisSettings();
        IrisServices.register(PreservationRegistry.class,Proxy.newProxyInstance(PreservationRegistry.class.getClassLoader(),new Class<?>[]{PreservationRegistry.class},(self,method,values)->null));
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return true;}public void reportError(String key,Throwable failure){throw new IllegalStateException(failure);}public void warnUnresolved(String key,String message){throw new IllegalStateException(message);}public void debug(String message){}});resolver.getAir();
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            IrisPlatforms.bind((IrisPlatform)Proxy.newProxyInstance(IrisPlatform.class.getClassLoader(),new Class<?>[]{IrisPlatform.class},(self,method,values)->switch(method.getName()){case"platformName"->"native-terrain-reference";case"minecraftVersion"->"26.3";case"registries"->registries;case"log","msg"->{System.err.println(Arrays.toString(values));yield null;}case"reportError"->throw new IllegalStateException(Arrays.toString(values));default->throw new UnsupportedOperationException(method.toString());}));
            var decorators=new art.arcane.iris.modded.ModdedDecoratorHooks();art.arcane.iris.generation.decoration.DecoratorPlatformHooks.bind(decorators,decorators);
            for(JsonElement entry:request.getAsJsonArray("packs")){
                Path directory=Path.of(entry.getAsString());IrisData data=IrisData.openDatapackCompiler(directory.toFile());Method register=IrisData.class.getDeclaredMethod("registerLoader",Class.class,art.arcane.volmlib.util.collection.KMap.class);register.setAccessible(true);@SuppressWarnings("unchecked") ResourceLoader<IrisBlockData> blocks=(ResourceLoader<IrisBlockData>)register.invoke(data,IrisBlockData.class,data.getLoaders());data.setBlockLoader(blocks);
                Field gateField=IrisData.class.getDeclaredField("contentGate");gateField.setAccessible(true);gateField.set(data,new ContentGate(registries,()->ContentGate.readBlockFallbacks(directory.toFile()),data.getCompatReport(),key->blocks.load(key,false)));
                IrisDimension dimension=data.getDimensionLoader().load("terrain3d");if(dimension==null||dimension.isCompatExcluded())throw new IllegalStateException("Native dimension unavailable");
                JsonArray pack=new JsonArray();for(JsonElement seed:request.getAsJsonArray("seeds")){
                    SeedManager seeds=new SeedManager(Long.parseLong(seed.getAsString()));IrisComplex[] runtime={null};EngineMetrics metrics=new EngineMetrics(16);var world=art.arcane.iris.world.IrisWorld.builder().minHeight(dimension.getMinHeight()).maxHeight(dimension.getMaxHeight()).seed(Long.parseLong(seed.getAsString())).build();
                    Engine engine=(Engine)Proxy.newProxyInstance(Engine.class.getClassLoader(),new Class<?>[]{Engine.class},(self,method,values)->switch(method.getName()){
                        case"burst"->art.arcane.iris.generation.concurrent.MultiBurst.burst;case"getMantle"->{if(caveHost==null)throw new IllegalStateException("No native cave host");yield caveHost;}case"getWorld"->world;case"getMetrics"->metrics;case"getDimension"->dimension;case"getData"->data;case"getSeedManager"->seeds;case"getMinHeight"->dimension.getMinHeight();case"getMaxHeight"->dimension.getMaxHeight();case"getHeight"->{if(values!=null&&values.length!=0)throw new UnsupportedOperationException(method.toString());yield dimension.getMaxHeight()-dimension.getMinHeight();}case"getCacheID"->System.identityHashCode(self);case"getUpperContext"->null;case"getPlatformHooks"->new EnginePlatformHooks(){};case"getComplex"->runtime[0];case"isStudio","isClosed"->false;
                        case"getFocus"->{String key=dimension.getFocus();var biome=key==null||key.isBlank()?null:data.getBiomeLoader().load(key);yield biome==null||biome.isCompatExcluded()?null:biome;}
                        case"getFocusRegion"->{String key=dimension.getFocusRegion();var region=key==null||key.isBlank()?null:data.getRegionLoader().load(key);yield region==null||region.isCompatExcluded()?null:region;}
                        default->{if(method.isDefault()&&NATIVE_DEFAULTS.contains(method.getName()))yield InvocationHandler.invokeDefault(self,method,values==null?new Object[0]:values);throw new UnsupportedOperationException(method.toString());}
                    });runtime[0]=new IrisComplex(engine);
                    JsonArray samples=new JsonArray();for(JsonElement point:request.getAsJsonArray("points")){JsonArray coordinates=point.getAsJsonArray();double x=coordinates.get(0).getAsDouble(),z=coordinates.get(1).getAsDouble();JsonObject sample=new JsonObject();sample.addProperty("height",Long.toUnsignedString(Double.doubleToRawLongBits(runtime[0].getHeightStream().getDouble(x,z)),16));sample.addProperty("biome",runtime[0].getTrueBiomeStream().get(x,z).getLoadKey());if(request.has("columns")&&request.get("columns").getAsBoolean()){
                        var column=runtime[0].naturalTerrainColumn((int)Math.floor(x),(int)Math.floor(z));if(column==null)sample.add("column",JsonNull.INSTANCE);else{JsonObject value=new JsonObject();value.addProperty("baseHeight",String.format("%016x",Double.doubleToRawLongBits(column.baseHeight())));value.addProperty("minY",column.minY());value.addProperty("topY",column.topY());value.addProperty("shaped",column.shaped());JsonArray spans=new JsonArray();for(int i=0;i<column.spanCount();i++){JsonArray span=new JsonArray();span.add(column.ceiling(i));span.add(column.floor(i));spans.add(span);}value.add("spans",spans);StringBuilder occupancy=new StringBuilder();for(int y=0;y<dimension.getMaxHeight()-dimension.getMinHeight();y++)occupancy.append(column.isSolid(y)?'1':'0');value.addProperty("occupancy",occupancy.toString());sample.add("column",value);}}
                        if(request.has("paint")&&request.get("paint").getAsBoolean()){
                            int bx=(int)x,bz=(int)z,localHeight=dimension.getMaxHeight()-dimension.getMinHeight();var blocksOut=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,localHeight,16);blocksOut.fill(registries.air());new art.arcane.iris.generation.stage.IrisTerrainNormalActuator(engine).paint(bx,bz,blocksOut,new art.arcane.iris.generation.context.ChunkContext(bx,bz,runtime[0],false));
                            JsonObject painted=new JsonObject();painted.addProperty("scope","native-terrain-paint-stage-development");painted.addProperty("x",bx);painted.addProperty("z",bz);painted.addProperty("minY",dimension.getMinHeight());painted.addProperty("height",localHeight);LinkedHashMap<String,Integer> palette=new LinkedHashMap<>();JsonArray cells=new JsonArray();for(int y=0;y<localHeight;y++)for(int localZ=0;localZ<16;localZ++)for(int localX=0;localX<16;localX++){String key=blocksOut.getRaw(localX,y,localZ).key();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells.add(index);}painted.add("palette",gson.toJsonTree(palette.keySet()));painted.add("cells",cells);sample.add("painted",painted);
                        }
                        if(request.has("caves")&&request.get("caves").getAsBoolean())sample.add("caves",caves(engine,(int)x,(int)z,gson,directory));
                        if(request.has("caveMaterials")&&request.get("caveMaterials").getAsBoolean())sample.add("caveMaterials",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,false,false,false,false,false,false));
                        if(request.has("carvingComponent")&&request.get("carvingComponent").getAsBoolean())sample.add("carvingComponent",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,false,false,false,false,false));
                        if(request.has("postMaterials")&&request.get("postMaterials").getAsBoolean())sample.add("postMaterials",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,true,false,false,false,false));
                        if(request.has("floatingMaterials")&&request.get("floatingMaterials").getAsBoolean())sample.add("floatingMaterials",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,true,true,false,false,false));
                        if(request.has("caveDecoration")&&request.get("caveDecoration").getAsBoolean())sample.add("caveDecoration",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,true,true,true,false,false));
                        if(request.has("depositMaterials")&&request.get("depositMaterials").getAsBoolean())sample.add("depositMaterials",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,true,true,true,true,false));
                        if(request.has("materialFinish")&&request.get("materialFinish").getAsBoolean())sample.add("materialFinish",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,true,true,true,true,true));
                        samples.add(sample);}pack.add(samples);
                }result.add(pack);
            }
        }finally{IrisPlatforms.unbind();IrisServices.clear();}
        Files.writeString(Path.of(args[1]),gson.toJson(result));
    }
    private static JsonObject caves(Engine engine,int x,int z,Gson gson,Path directory)throws Exception {
        int height=engine.getHeight(),cx=x>>4,cz=z>>4;
        var adapter=(art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter>)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter.class},(self,method,args)->switch(method.getName()){
            case "createSection"->new art.arcane.volmlib.util.matter.IrisMatter(16,16,16);
            case "get"->{var section=(art.arcane.volmlib.util.matter.Matter)args[0];var slice=section.getSlice((Class<?>)args[4]);yield slice==null?null:slice.get((int)args[1],(int)args[2],(int)args[3]);}
            case "iterate"->{var section=(art.arcane.volmlib.util.matter.Matter)args[0];var slice=section.getSlice((Class<?>)args[1]);if(slice!=null)slice.iterate((art.arcane.volmlib.util.function.Consumer4)args[2]);yield null;}
            default->throw new UnsupportedOperationException(method.toString());
        });
        var chunk=new art.arcane.volmlib.util.mantle.runtime.MantleChunk<art.arcane.volmlib.util.matter.Matter>((height+15)/16,cx,cz,adapter,art.arcane.volmlib.util.mantle.runtime.MantleHooks.NONE);
        var mantle=new art.arcane.volmlib.util.mantle.runtime.Mantle<art.arcane.volmlib.util.matter.Matter>(directory.resolve("unused-cave-storage").toFile(),height,1,null,null,null,adapter,art.arcane.volmlib.util.mantle.runtime.MantleHooks.NONE);
        var host=(art.arcane.iris.generation.mantle.EngineMantle)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.iris.generation.mantle.EngineMantle.class},(self,method,args)->switch(method.getName()){case "getEngine"->engine;case "getComplex"->engine.getComplex();default->throw new UnsupportedOperationException(method.toString());});
        Method create=art.arcane.iris.generation.mantle.MantleWriter.class.getDeclaredMethod("forChunk",art.arcane.iris.generation.mantle.EngineMantle.class,art.arcane.volmlib.util.mantle.runtime.Mantle.class,art.arcane.volmlib.util.mantle.runtime.MantleChunk.class,int.class,int.class);create.setAccessible(true);
        int[] surface=new int[256];for(int lx=0;lx<16;lx++)for(int lz=0;lz<16;lz++)surface[(lx<<4)|lz]=engine.getComplex().naturalTrueHeight(x+lx,z+lz);
        int carved;try(var writer=(art.arcane.iris.generation.mantle.MantleWriter)create.invoke(null,host,mantle,chunk,cx,cz)){carved=new art.arcane.iris.generation.mantle.IrisCaveCarver3D(engine,engine.getDimension().getCaveProfile()).carve(writer,cx,cz,null,0D,0D,null,surface);}
        JsonObject result=new JsonObject();result.addProperty("scope","native-dimension-cave-markers-development");result.addProperty("x",x);result.addProperty("z",z);result.addProperty("minY",engine.getMinHeight());result.addProperty("height",height);result.addProperty("carved",carved);
        LinkedHashMap<art.arcane.volmlib.util.matter.MatterCavern,Integer> palette=new LinkedHashMap<>();palette.put(null,0);JsonArray cells=new JsonArray();
        for(int y=0;y<height;y++)for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){var value=chunk.get(lx,y,lz,art.arcane.volmlib.util.matter.MatterCavern.class);Integer index=palette.get(value);if(index==null){index=palette.size();palette.put(value,index);}cells.add(index);}
        result.add("palette",gson.toJsonTree(palette.keySet()));result.add("cells",cells);return result;
    }

    private static JsonObject caveMaterials(Engine engine,int x,int z,Gson gson,Path directory,PlatformRegistries registries,boolean component,boolean post,boolean floating,boolean decorate,boolean deposits,boolean finish)throws Exception {
        int height=engine.getHeight(),cx=x>>4,cz=z>>4;
        var adapter=(art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter>)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter.class},(self,method,args)->switch(method.getName()){
            case "createSection"->new art.arcane.volmlib.util.matter.IrisMatter(16,16,16);
            case "get"->{var section=(art.arcane.volmlib.util.matter.Matter)args[0];var slice=section.getSlice((Class<?>)args[4]);yield slice==null?null:slice.get((int)args[1],(int)args[2],(int)args[3]);}
            case "iterate"->{var section=(art.arcane.volmlib.util.matter.Matter)args[0];var slice=section.getSlice((Class<?>)args[1]);if(slice!=null)slice.iterate((art.arcane.volmlib.util.function.Consumer4)args[2]);yield null;}
            default->throw new UnsupportedOperationException(method.toString());
        });
        var mantle=new MemoryCaveMantle(directory,height,adapter);
        var host=(art.arcane.iris.generation.mantle.EngineMantle)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.iris.generation.mantle.EngineMantle.class},(self,method,args)->switch(method.getName()){case "getEngine"->engine;case "getComplex"->engine.getComplex();case "getData"->engine.getData();case "getMantle"->mantle;case "trueHeight","getFluidHeight","insertMatter"->InvocationHandler.invokeDefault(self,method,args);default->throw new UnsupportedOperationException(method.toString());});
        Method create=art.arcane.iris.generation.mantle.MantleWriter.class.getDeclaredMethod("forChunk",art.arcane.iris.generation.mantle.EngineMantle.class,art.arcane.volmlib.util.mantle.runtime.Mantle.class,art.arcane.volmlib.util.mantle.runtime.MantleChunk.class,int.class,int.class);create.setAccessible(true);
        var carver=component?null:new art.arcane.iris.generation.mantle.IrisCaveCarver3D(engine,engine.getDimension().getCaveProfile());
        var carving=component?new art.arcane.iris.generation.mantle.MantleCarvingComponent(host):null;
        for(int[] offset:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}){
            int chunkX=cx+offset[0],chunkZ=cz+offset[1],bx=chunkX<<4,bz=chunkZ<<4;var chunk=mantle.prepare(chunkX,chunkZ);
            try(var writer=(art.arcane.iris.generation.mantle.MantleWriter)create.invoke(null,host,mantle,chunk,chunkX,chunkZ)){
                if(component)carving.generateLayer(writer,chunkX,chunkZ,new art.arcane.iris.generation.context.ChunkContext(bx,bz,engine.getComplex(),false));
                else {int[] surface=new int[256];for(int lx=0;lx<16;lx++)for(int lz=0;lz<16;lz++)surface[(lx<<4)|lz]=engine.getComplex().naturalTrueHeight(bx+lx,bz+lz);carver.carve(writer,chunkX,chunkZ,null,0D,0D,null,surface);}
            }
        }
        var blocks=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,height,16);blocks.fill(registries.air());var context=new art.arcane.iris.generation.context.ChunkContext(x,z,engine.getComplex(),false);
        new art.arcane.iris.generation.stage.IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
        caveHost=host;try{var cave=new art.arcane.iris.generation.stage.IrisCarveModifier(engine);cave.onModify(cx,cz,blocks,false,context);if(post)new art.arcane.iris.generation.stage.IrisPostModifier(engine).onModify(x,z,blocks,false,context);var floatingModifier=floating?new art.arcane.iris.generation.stage.IrisFloatingChildBiomeModifier(engine):null;if(floating)floatingModifier.onModify(x,z,blocks,false,context);if(decorate)cave.decorateNaturalCaves(x,z,blocks,context);if(deposits){new art.arcane.iris.generation.stage.IrisDepositModifier(engine).onModify(x,z,blocks,false,context);host.insertMatter(cx,cz,blocks,false,context);}if(finish){new art.arcane.iris.generation.stage.IrisDecorantActuator(engine).onActuate(x,z,blocks,false,context);floatingModifier.decorateColumns(x,z,blocks,false,context);new art.arcane.iris.generation.stage.IrisPerfectionModifier(engine).onModify(x,z,blocks,false,context);}}finally{caveHost=null;}
        JsonObject result=new JsonObject();result.addProperty("scope",finish?"native-overworld-material-finish-development":deposits?"native-overworld-deposit-material-stage-development":decorate?"native-overworld-cave-decoration-stage-development":floating?"native-overworld-floating-material-stage-development":post?"native-overworld-post-material-stage-development":component?"native-carving-component-material-stage-development":"native-dimension-cave-material-stage-development");result.addProperty("x",x);result.addProperty("z",z);result.addProperty("minY",engine.getMinHeight());result.addProperty("height",height);if(deposits&&materialSampling!=null){
            JsonArray probes=new JsonArray();for(JsonElement point:materialSampling.getAsJsonArray("controls")){JsonArray xyz=point.getAsJsonArray();addProbe(probes,blocks,xyz.get(0).getAsInt(),xyz.get(1).getAsInt(),xyz.get(2).getAsInt());}
            Set<String> materials=new HashSet<>();for(JsonElement key:materialSampling.getAsJsonArray("materials"))materials.add(key.getAsString());int limit=materialSampling.get("limit").getAsInt();if(limit<1||limit>64)throw new IllegalArgumentException("Targeted probe limit");int selected=0;
            for(JsonElement band:materialSampling.getAsJsonArray("ys")){int y=band.getAsInt();for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++)if(materials.contains(blocks.getRaw(lx,y,lz).materialKey())){if(++selected>limit)throw new IllegalStateException("Targeted probe budget exceeded");addProbe(probes,blocks,lx,y,lz);}}
            result.addProperty("selected",selected);result.add("probes",probes);return result;
        }LinkedHashMap<String,Integer> palette=new LinkedHashMap<>();JsonArray cells=new JsonArray();for(int y=0;y<height;y++)for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){String key=blocks.getRaw(lx,y,lz).key();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells.add(index);}result.add("palette",gson.toJsonTree(palette.keySet()));result.add("cells",cells);if(decorate){JsonArray markers=new JsonArray();var chunk=mantle.prepare(cx,cz);for(int y=0;y<height;y++)for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){var marker=chunk.get(lx,y,lz,art.arcane.volmlib.util.matter.MatterMarker.class);if(marker!=null){JsonArray entry=new JsonArray();entry.add(lx);entry.add(y);entry.add(lz);entry.add(marker.getTag());markers.add(entry);}}result.add("markers",markers);}return result;
    }
    private static void addProbe(JsonArray probes,art.arcane.volmlib.util.hunk.Hunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState> blocks,int x,int y,int z){JsonArray probe=new JsonArray();probe.add(x);probe.add(y);probe.add(z);probe.add(blocks.getRaw(x,y,z).key());probes.add(probe);}
    private static final class MemoryCaveMantle extends art.arcane.volmlib.util.mantle.runtime.Mantle<art.arcane.volmlib.util.matter.Matter>{
        private final Map<Long,art.arcane.volmlib.util.mantle.runtime.TectonicPlate<art.arcane.volmlib.util.matter.Matter>> plates=new HashMap<>();
        private final int height;private final art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter> adapter;
        MemoryCaveMantle(Path directory,int height,art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter> adapter){super(directory.resolve("unused-cave-material-storage").toFile(),height,1,null,null,null,adapter,art.arcane.volmlib.util.mantle.runtime.MantleHooks.NONE);this.height=height;this.adapter=adapter;}
        private static long regionKey(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
        art.arcane.volmlib.util.mantle.runtime.MantleChunk<art.arcane.volmlib.util.matter.Matter> prepare(int x,int z){return plates.computeIfAbsent(regionKey(x>>5,z>>5),ignored->new art.arcane.volmlib.util.mantle.runtime.TectonicPlate<>(height,x>>5,z>>5,adapter,art.arcane.volmlib.util.mantle.runtime.MantleHooks.NONE)).getOrCreate(x&31,z&31);}
        @Override public <T>void set(int x,int y,int z,T value){if(!(value instanceof art.arcane.volmlib.util.matter.MatterMarker))throw new UnsupportedOperationException("Only native cave markers are owned by this reference host");if(y>=0&&y<height)prepare(x>>4,z>>4).getOrCreate(y>>4).<T>slice(art.arcane.volmlib.util.matter.MatterMarker.class).set(x&15,y&15,z&15,value);}
        @Override public art.arcane.volmlib.util.mantle.runtime.TectonicPlate<art.arcane.volmlib.util.matter.Matter> getLoadedRegion(int x,int z){return plates.get(regionKey(x,z));}
        @Override public art.arcane.volmlib.util.mantle.runtime.MantleChunk<art.arcane.volmlib.util.matter.Matter> useChunk(int x,int z){var plate=getLoadedRegion(x>>5,z>>5);var chunk=plate==null?null:plate.get(x&31,z&31);if(chunk==null)throw new IllegalStateException("Native cave chunk missing");return chunk.use();}
    }

}
