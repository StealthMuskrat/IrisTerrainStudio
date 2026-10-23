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
    private static boolean preserveSubterrain;
    private static JsonObject singlePlacement;
    private static int[] lastSourcePlan;
    private static JsonObject lastNeighborhood;
    private static art.arcane.iris.generation.mantle.MantleObjectComponent neighborhoodComponent;
    private static final Set<String> NATIVE_DEFAULTS=Set.of("getRegion","getAllBiomes","getDimensionStackContext","isAdditionalTerrainOwned","getSubterrainCell","getSubterrainBiome","getCaveBiome","getSurfaceBiome","getHostSurfaceBiome","answersFromNaturalTerrain","getGenerationSessionId","getGenerationSessions","isTerrainSurfaceSolid","getNativeStructureVolumes","acquireGenerationLease","isClosing");
    public static void main(String[] args)throws Exception{try{execute(args);}catch(Throwable failure){failure.printStackTrace(System.out);throw new IllegalStateException("Native reference failed",failure);}}
    private static void execute(String[] args)throws Exception{
        Gson gson=new GsonBuilder().serializeNulls().create();JsonObject request=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();JsonArray result=new JsonArray();preserveSubterrain=request.has("subterrainFinish")&&request.get("subterrainFinish").getAsBoolean();materialSampling=request.has("materialSampling")?request.getAsJsonObject("materialSampling"):null;singlePlacement=request.has("singlePlacement")?request.getAsJsonObject("singlePlacement"):null;
        art.arcane.iris.configuration.IrisSettings.settings=new art.arcane.iris.configuration.IrisSettings();
        IrisServices.register(PreservationRegistry.class,Proxy.newProxyInstance(PreservationRegistry.class.getClassLoader(),new Class<?>[]{PreservationRegistry.class},(self,method,values)->null));
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return true;}public void reportError(String key,Throwable failure){throw new IllegalStateException(failure);}public void warnUnresolved(String key,String message){throw new IllegalStateException(message);}public void debug(String message){}});resolver.getAir();
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"biome"->{String key=(String)values[0];if(request.has("customBiomeReference")&&request.get("customBiomeReference").getAsBoolean()&&key.matches("iris:biomes/[a-f0-9]{64}"))yield new art.arcane.volmlib.nativelib.terrain.NativeBiome(){public String key(){return key;}public String namespace(){return "iris";}public Object nativeHandle(){return this;}};yield access.biome(key);}
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            IrisPlatforms.bind((IrisPlatform)Proxy.newProxyInstance(IrisPlatform.class.getClassLoader(),new Class<?>[]{IrisPlatform.class},(self,method,values)->switch(method.getName()){case"supportsMatterWorldIo"->InvocationHandler.invokeDefault(self,method,values);case"platformName"->request.has("studio")&&request.get("studio").getAsBoolean()?"bukkit":"native-terrain-reference";case"minecraftVersion"->"26.3";case"registries"->registries;case"log","msg"->{System.err.println(Arrays.toString(values));yield null;}case"reportError"->throw new IllegalStateException(Arrays.toString(values));default->throw new UnsupportedOperationException(method.toString());}));
            if(request.has("canopyDiagnostic")||singlePlacement!=null||request.has("registeredOverworldCheck")||request.has("registeredOverworldChecks"))art.arcane.iris.structure.object.IrisObjectRotation.bindPlatformRotator((art.arcane.iris.structure.object.IrisObjectRotation.StateRotator)Class.forName("art.arcane.iris.modded.ModdedStateRotator").getConstructor().newInstance());
            if(singlePlacement!=null&&singlePlacement.has("edit"))art.arcane.iris.generation.block.BlockDataMergeSupport.bindPlatformMerger(new NativeStateMerger(resolver)::merge);
            var decorators=new art.arcane.iris.modded.ModdedDecoratorHooks();art.arcane.iris.generation.decoration.DecoratorPlatformHooks.bind(decorators,decorators);
            if(request.has("canopyDiagnostic"))result.add(JsonParser.parseString((String)Class.forName("art.arcane.iris.generation.mantle.WorkerCanopyDiagnostic").getMethod("run").invoke(null)));
            for(JsonElement entry:request.getAsJsonArray("packs")){
                Path directory=Path.of(entry.getAsString());IrisData data=IrisData.openDatapackCompiler(directory.toFile());Method register=IrisData.class.getDeclaredMethod("registerLoader",Class.class,art.arcane.volmlib.util.collection.KMap.class);register.setAccessible(true);@SuppressWarnings("unchecked") ResourceLoader<IrisBlockData> blocks=(ResourceLoader<IrisBlockData>)register.invoke(data,IrisBlockData.class,data.getLoaders());data.setBlockLoader(blocks);
                Field gateField=IrisData.class.getDeclaredField("contentGate");gateField.setAccessible(true);gateField.set(data,new ContentGate(registries,()->ContentGate.readBlockFallbacks(directory.toFile()),data.getCompatReport(),key->blocks.load(key,false)));
                if(request.has("expressionChecks"))result.add(expressionChecks(data,request.getAsJsonArray("expressionChecks")));
                if(request.has("cacheStyles"))result.add(cacheStyleChecks(data,request.getAsJsonArray("cacheStyles"),gson));
                if(request.has("imageSamples"))result.add(imageMapChecks(data,request,gson));
                if(request.has("dimensionImageChecks")){
                    var checks=request.getAsJsonObject("dimensionImageChecks");var selected=data.getDimensionLoader().load("terrain3d");var inspection=Class.forName("studio.engine.image.DimensionImageMaps");var imageMaps=inspection.getConstructor(IrisData.class,IrisDimension.class).newInstance(data,selected);var row=new JsonObject();row.add("description",JsonParser.parseString((String)inspection.getMethod("describe").invoke(imageMaps)));var values=new JsonArray();for(var point:checks.getAsJsonArray("points")){var xy=point.getAsJsonArray();values.add(JsonParser.parseString((String)inspection.getMethod("sample",double.class,double.class).invoke(imageMaps,xy.get(0).getAsDouble(),xy.get(1).getAsDouble())));}row.add("samples",values);result.add(row);
                }
                IrisDimension dimension=data.getDimensionLoader().load(request.has("dimensionKey")?request.get("dimensionKey").getAsString():"terrain3d");if(dimension==null||dimension.isCompatExcluded())throw new IllegalStateException("Native dimension unavailable");
                JsonArray pack=new JsonArray();for(JsonElement seed:request.getAsJsonArray("seeds")){
                    SeedManager seeds=new SeedManager(Long.parseLong(seed.getAsString()));IrisComplex[] runtime={null};UpperDimensionContext[] upper={null};DimensionStackContext[] stack={null};var sessions=new GenerationSessionManager();EngineMetrics metrics=new EngineMetrics(16);var world=art.arcane.iris.world.IrisWorld.builder().minHeight(dimension.getMinHeight()).maxHeight(dimension.getMaxHeight()).seed(Long.parseLong(seed.getAsString())).build();
                    Engine engine=(Engine)Proxy.newProxyInstance(Engine.class.getClassLoader(),new Class<?>[]{Engine.class},(self,method,values)->switch(method.getName()){
                        case"getTarget"->new EngineTarget(world,dimension,data);case"getGenerationSessions"->sessions;case"burst"->art.arcane.iris.generation.concurrent.MultiBurst.burst;case"getMantle"->{if(caveHost==null)throw new IllegalStateException("No native cave host");yield caveHost;}case"getWorld"->world;case"getMetrics"->metrics;case"getDimension"->dimension;case"getData"->data;case"getSeedManager"->seeds;case"getMinHeight"->dimension.getMinHeight();case"getMaxHeight"->dimension.getMaxHeight();case"getHeight"->{if(values!=null&&values.length!=0)throw new UnsupportedOperationException(method.toString());yield dimension.getMaxHeight()-dimension.getMinHeight();}case"getCacheID"->System.identityHashCode(self);case"getUpperContext"->upper[0];case"getDimensionStackContext"->stack[0];case"getPlatformHooks"->new EnginePlatformHooks(){};case"getComplex"->runtime[0];case"isStudio"->request.has("studio")&&request.get("studio").getAsBoolean();case"isClosed"->false;
                        case"getFocus"->{String key=dimension.getFocus();var biome=key==null||key.isBlank()?null:data.getBiomeLoader().load(key);yield biome==null||biome.isCompatExcluded()?null:biome;}
                        case"getFocusRegion"->{String key=dimension.getFocusRegion();var region=key==null||key.isBlank()?null:data.getRegionLoader().load(key);yield region==null||region.isCompatExcluded()?null:region;}
                        default->{if(method.isDefault()&&NATIVE_DEFAULTS.contains(method.getName()))yield InvocationHandler.invokeDefault(self,method,values==null?new Object[0]:values);throw new UnsupportedOperationException(method.toString());}
                    });runtime[0]=new IrisComplex(engine);
                    if(request.has("layerColumns")){
                        var kernel=Class.forName("studio.engine.terrain.NativeLayerKernel").getConstructor().newInstance();
                        stack[0]=(DimensionStackContext)kernel.getClass().getMethod("createDimensionStackContext",Engine.class).invoke(kernel,engine);
                        upper[0]=(UpperDimensionContext)kernel.getClass().getMethod("createUpperContext",Engine.class).invoke(kernel,engine);
                    }
                    data.registerEngine(engine);
                    if(request.has("layerColumns")){
                        var columns=new JsonArray();var diagnostic=Class.forName("studio.engine.terrain.TerrainLayerDiagnostic").getMethod("column",Engine.class,int.class,int.class);
                        for(var point:request.getAsJsonArray("layerColumns")){var xy=point.getAsJsonArray();columns.add(JsonParser.parseString((String)diagnostic.invoke(null,engine,xy.get(0).getAsInt(),xy.get(1).getAsInt())));}pack.add(columns);
                    }
                    if(request.has("surfaceHydrologyMapChecks")){
                        openHydrologyReferenceHost(engine,directory);var type=Class.forName("studio.engine.hydrology.SurfaceHydrologyMap");var sample=type.getMethod("sample",Engine.class,double.class,double.class,double.class,int.class,int.class);
                        for(var value:request.getAsJsonArray("surfaceHydrologyMapChecks")){var row=value.getAsJsonObject();pack.add(JsonParser.parseString((String)sample.invoke(null,engine,row.get("x").getAsDouble(),row.get("z").getAsDouble(),row.get("span").getAsDouble(),row.get("width").getAsInt(),row.get("height").getAsInt())));}
                    }
                    if(request.has("hydrologyCheck")){
                        openHydrologyReferenceHost(engine,directory);
                        var hydrology=engine.getComplex().getHydrologyRuntime();if(hydrology==null)throw new IllegalStateException("No native hydrology runtime");
                        var columns=new JsonArray();var diagnostic=Class.forName("studio.engine.hydrology.HydrologyDiagnostic").getMethod("sample",Engine.class,int.class,int.class);
                        if(request.getAsJsonObject("hydrologyCheck").has("pickPool")||request.getAsJsonObject("hydrologyCheck").has("pickFeature")){
                            var feature=request.getAsJsonObject("hydrologyCheck").has("pickFeature")?art.arcane.iris.generation.hydrology.HydrologyFeatureType.valueOf(request.getAsJsonObject("hydrologyCheck").get("pickFeature").getAsString()):art.arcane.iris.generation.hydrology.HydrologyFeatureType.STANDING_POOL;
                            var tile=hydrology.tile(new art.arcane.iris.generation.hydrology.HydrologyTileKey(0,0));
                            var selected=tile.footprint().columns().values().stream().filter(c->c.layers().stream().anyMatch(l->l.feature().type()==feature&&l.channel()&&l.fluidOwned())).findFirst().orElseThrow(()->new IllegalStateException("Native fixture produced no occupied "+feature));
                            columns.add(JsonParser.parseString((String)diagnostic.invoke(null,engine,selected.x(),selected.z())));
                        }
                        for(var point:request.getAsJsonObject("hydrologyCheck").getAsJsonArray("points")){var xy=point.getAsJsonArray();columns.add(JsonParser.parseString((String)diagnostic.invoke(null,engine,xy.get(0).getAsInt(),xy.get(1).getAsInt())));}pack.add(columns);
                    }
                    if(request.has("registeredOverworldCheck"))pack.add(registeredOverworldCheck(engine,request.getAsJsonObject("registeredOverworldCheck"),directory,registries));
                    if(request.has("registeredOverworldChecks"))for(var check:request.getAsJsonArray("registeredOverworldChecks"))pack.add(registeredOverworldCheck(engine,check.getAsJsonObject(),directory,registries));
                    if(request.has("terrainModeCheck"))pack.add(terrainModeCheck(engine,request.getAsJsonObject("terrainModeCheck"),registries));
                    if(request.has("customBiomeReference")&&request.get("customBiomeReference").getAsBoolean())pack.add((JsonElement)Class.forName("art.arcane.iris.probe.NativeCustomBiomeCheck").getMethod("inspect",Engine.class).invoke(null,engine));
                    if(request.has("physicalBiomeChecks"))pack.add(physicalBiomeChecks(engine,request.getAsJsonArray("physicalBiomeChecks")));
                    if(request.has("subterrainCheck")){try{pack.add(subterrainCheck(engine,directory,registries,gson,request.get("subterrainCheck").getAsBoolean()));}finally{data.unregisterEngine(engine);}continue;}
                    if(request.has("engineExpressionChecks"))pack.add(expressionChecks(data,request.getAsJsonArray("engineExpressionChecks")));
                    if(request.has("terrainPaintProbes")){
                        var requestProbes=request.getAsJsonObject("terrainPaintProbes");int bx=requestProbes.get("x").getAsInt(),bz=requestProbes.get("z").getAsInt();var cells=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,engine.getHeight(),16);cells.fill(registries.air());new art.arcane.iris.generation.stage.IrisTerrainNormalActuator(engine).paint(bx,bz,cells,new art.arcane.iris.generation.context.ChunkContext(bx,bz,runtime[0],false));var probes=new JsonArray();for(var point:requestProbes.getAsJsonArray("points")){var xyz=point.getAsJsonArray();int px=xyz.get(0).getAsInt(),py=xyz.get(1).getAsInt(),pz=xyz.get(2).getAsInt();var row=xyz.deepCopy();row.add(cells.getRaw(px,py,pz).key());probes.add(row);}pack.add(probes);
                    }
                    if(request.has("regionSpanChecks")){var keys=new JsonArray();for(var point:request.getAsJsonArray("regionSpanChecks")){var xyz=point.getAsJsonArray();keys.add(engine.getRegion(xyz.get(0).getAsInt(),xyz.get(1).getAsInt(),xyz.get(2).getAsInt()).getLoadKey());}pack.add(keys);}
                    if(request.has("regionChecks")){var regions=RegionSelection.restore(new RegionSelection.Snapshot(dimension,data,seeds.getComplex(),false));var keys=new JsonArray();for(var point:request.getAsJsonArray("regionChecks")){var xy=point.getAsJsonArray();keys.add(regions.get(xy.get(0).getAsDouble(),xy.get(1).getAsDouble()).getLoadKey());}pack.add(keys);}
                    if(request.has("studioLayoutChecks"))pack.add((JsonElement)Class.forName("art.arcane.iris.probe.NativeStudioLayoutCheck").getMethod("inspect",Engine.class,JsonObject.class).invoke(null,engine,request.getAsJsonObject("studioLayoutChecks")));
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
                        if(singlePlacement!=null)sample.add("singlePlacement",caveMaterials(engine,(int)x,(int)z,gson,directory,registries,true,true,true,true,true,true));
                        samples.add(sample);}pack.add(samples);data.unregisterEngine(engine);
                }result.add(pack);
            }
        }finally{IrisPlatforms.unbind();IrisServices.clear();}
        Files.writeString(Path.of(args[1]),gson.toJson(result));
    }
    private static void openHydrologyReferenceHost(Engine engine,Path directory)throws Exception{
        art.arcane.iris.world.storage.matter.IrisMatterSupport.ensureRegistered();
        var adapter=(art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter>)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter.class},(self,method,args)->switch(method.getName()){
            case "createSection"->new art.arcane.volmlib.util.matter.IrisMatter(16,16,16);
            case "get"->{var slice=((art.arcane.volmlib.util.matter.Matter)args[0]).getSlice((Class<?>)args[4]);yield slice==null?null:slice.get((int)args[1],(int)args[2],(int)args[3]);}
            case "iterate"->{var slice=((art.arcane.volmlib.util.matter.Matter)args[0]).getSlice((Class<?>)args[1]);if(slice!=null)slice.iterate((art.arcane.volmlib.util.function.Consumer4)args[2]);yield null;}
            default->throw new UnsupportedOperationException(method.toString());
        });
        var memory=new MemoryCaveMantle(directory,engine.getHeight(),adapter);
        var host=new IrisEngineMantle(engine,directory.resolve("native-terrain-mantle")){
            @Override public art.arcane.volmlib.util.mantle.runtime.Mantle<art.arcane.volmlib.util.matter.Matter> getMantle(){return memory;}
            void releaseUnusedBacking()throws Exception{super.getMantle().close();}
        };host.releaseUnusedBacking();caveHost=host;
    }
    private static JsonObject registeredOverworldCheck(Engine engine,JsonObject request,Path directory,PlatformRegistries registries)throws Exception{
        art.arcane.iris.world.storage.matter.IrisMatterSupport.ensureRegistered();
        var adapter=(art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter>)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter.class},(self,method,args)->switch(method.getName()){
            case "createSection"->new art.arcane.volmlib.util.matter.IrisMatter(16,16,16);
            case "get"->{var slice=((art.arcane.volmlib.util.matter.Matter)args[0]).getSlice((Class<?>)args[4]);yield slice==null?null:slice.get((int)args[1],(int)args[2],(int)args[3]);}
            case "iterate"->{var slice=((art.arcane.volmlib.util.matter.Matter)args[0]).getSlice((Class<?>)args[1]);if(slice!=null)slice.iterate((art.arcane.volmlib.util.function.Consumer4)args[2]);yield null;}
            default->throw new UnsupportedOperationException(method.toString());
        });
        var memory=new MemoryCaveMantle(directory,engine.getHeight(),adapter);
        var host=new IrisEngineMantle(engine,directory.resolve("native-terrain-mantle")){
            @Override public art.arcane.volmlib.util.mantle.runtime.Mantle<art.arcane.volmlib.util.matter.Matter> getMantle(){return memory;}
            void releaseUnusedBacking()throws Exception{super.getMantle().close();}
        };host.releaseUnusedBacking();caveHost=host;
        int x=request.get("x").getAsInt(),z=request.get("z").getAsInt();EngineMode mode=request.has("configuredMode")&&request.get("configuredMode").getAsBoolean()?engine.getDimension().getMode().create(engine):new art.arcane.iris.generation.mode.ModeOverworld(engine);
        if(engine.getDimensionStackContext()!=null){var kernel=Class.forName("studio.engine.terrain.NativeLayerKernel").getConstructor().newInstance();kernel.getClass().getMethod("registerDimensionStack",Engine.class,EngineMode.class,DimensionStackContext.class).invoke(kernel,engine,mode,engine.getDimensionStackContext());}
        if(engine.getDimensionStackContext()!=null)memory.prepare(x>>4,z>>4);
        boolean generate=request.has("generate")&&request.get("generate").getAsBoolean();var original=mode.getTerrainStages().get(0);art.arcane.iris.generation.context.ChunkContext[] observed={null};
        if(generate)mode.getTerrainStages().set(0,(bx,bz,b,p,m,c)->{observed[0]=c;original.generate(bx,bz,b,p,m,c);});
        try{
            var blocks=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,engine.getHeight(),16);blocks.fill(registries.air());var biomes=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBiome>(16,engine.getHeight(),16);
            try(var lease=engine.acquireGenerationLease("registered_overworld_reference")){
                if(generate){mode.generate(x,z,blocks,biomes,false,lease.sessionId());if(observed[0]==null||observed[0].isNaturalTerrain())throw new IllegalStateException("Native Overworld did not enter content phase");}
                else{var context=new art.arcane.iris.generation.context.ChunkContext(x,z,engine.getComplex(),lease.sessionId(),true,art.arcane.iris.generation.context.ChunkContext.PrefillPlan.NO_CAVE,engine.getMetrics(),engine.getDimensionStackContext());try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine,lease.sessionId(),context)){mode.generateTerrain(x,z,blocks,biomes,false,context);}}
            }
            var controls=request.getAsJsonArray("controls").deepCopy();
            if(request.has("autoLayerControls")&&request.get("autoLayerControls").getAsBoolean()){
                int[] heights;
                if(engine.getUpperContext()!=null){int surface=engine.getUpperContext().getEffectiveSurfaceY(x+1,z+1);heights=new int[]{0,surface-1,surface,engine.getHeight()-1};}
                else{var layers=engine.getDimensionStackContext().getLayout(x+1,z+1).layersBottomToTop();heights=new int[]{0,layers.get(0).contentTopY()+1,layers.get(1).localBaseY()+1,layers.getLast().clippedSurfaceY()};}
                for(int index=0;index<heights.length;index++){var row=new JsonArray();row.add(index==0?0:1);row.add(Math.clamp(heights[index],0,engine.getHeight()-1));row.add(index==0?0:1);controls.add(row);}
            }
            var output=new JsonObject();
            if(request.has("hydrologyPublication")&&request.get("hydrologyPublication").getAsBoolean())output.add("hydrology",JsonParser.parseString((String)Class.forName("studio.engine.hydrology.HydrologyMatterSnapshot").getMethod("describe",art.arcane.volmlib.util.mantle.runtime.MantleChunk.class,int.class).invoke(null,memory.prepare(x>>4,z>>4),engine.getHeight())));
            JsonArray probes=new JsonArray();for(JsonElement value:controls){var xyz=value.getAsJsonArray();int lx=xyz.get(0).getAsInt(),y=xyz.get(1).getAsInt(),lz=xyz.get(2).getAsInt();var row=xyz.deepCopy();row.add(blocks.getRaw(lx,y,lz).key());row.add(biomes.getRaw(lx,y,lz).key());probes.add(row);}output.add("probes",probes);
            if(generate){
                var centre=memory.prepare(x>>4,z>>4);int[] counts={0,0,0,0};Set<String> tags=new HashSet<>();
                for(int section=0;section<engine.getHeight()/16;section++)if(centre.exists(section)){
                    final int sy=section<<4;var matter=centre.get(section);var journal=matter.getSlice(art.arcane.iris.world.storage.matter.PreObjectMatterCell.class);
                    if(journal!=null)journal.iterate((lx,ly,lz,value)->{counts[0]++;int y=sy+ly;var block=blocks.getRaw(lx,y,lz);if(counts[1]<2&&block.materialKey().equals("minecraft:oak_log")){var row=new JsonArray();row.add(lx);row.add(y);row.add(lz);row.add(block.key());row.add(biomes.getRaw(lx,y,lz).key());probes.add(row);counts[1]++;}});
                    var strings=matter.getSlice(String.class);if(strings!=null)strings.iterate((lx,ly,lz,value)->{counts[2]++;tags.add(value);});
                    var trees=matter.getSlice(art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class);if(trees!=null)trees.iterate((lx,ly,lz,value)->counts[3]++);
                }
                output.addProperty("journaledCells",counts[0]);output.addProperty("selectedJournalProbes",counts[1]);var tagResult=new JsonObject();tagResult.addProperty("cells",counts[2]);tagResult.addProperty("placements",tags.size());tagResult.addProperty("treeMaterials",counts[3]);output.add("objectTags",tagResult);
                var names=new art.arcane.volmlib.util.mantle.flag.MantleFlag[]{art.arcane.volmlib.util.mantle.flag.ReservedFlag.CARVED,art.arcane.volmlib.util.mantle.flag.ReservedFlag.OBJECT,art.arcane.volmlib.util.mantle.flag.ReservedFlag.FLOATING_OBJECT,art.arcane.volmlib.util.mantle.flag.ReservedFlag.JIGSAW,art.arcane.volmlib.util.mantle.flag.MantleFlag.PLANNED};
                JsonArray componentFlags=new JsonArray();for(int dx=-3;dx<=3;dx++)for(int dz=-3;dz<=3;dz++){int cx=(x>>4)+dx,cz=(z>>4)+dz;var plate=memory.getLoadedRegion(cx>>5,cz>>5);var chunk=plate==null?null:plate.get(cx&31,cz&31);if(chunk==null)continue;boolean any=false;for(var flag:names)any|=chunk.isFlagged(flag);if(any){var row=new JsonArray();row.add(cx);row.add(cz);for(var flag:names)row.add(chunk.isFlagged(flag));componentFlags.add(row);}}output.add("componentFlags",componentFlags);
                output.addProperty("contentPhase",observed[0]!=null&&!observed[0].isNaturalTerrain());output.addProperty("activeLeasesAfter",engine.getGenerationSessions().activeLeases());
            }
            JsonArray flags=new JsonArray();for(int dx=-3;dx<=3;dx++)for(int dz=-3;dz<=3;dz++){int cx=(x>>4)+dx,cz=(z>>4)+dz;var plate=memory.getLoadedRegion(cx>>5,cz>>5);var chunk=plate==null?null:plate.get(cx&31,cz&31);if(chunk==null)continue;boolean carved=chunk.isFlagged(art.arcane.volmlib.util.mantle.flag.ReservedFlag.CARVED),planned=chunk.isFlagged(art.arcane.volmlib.util.mantle.flag.MantleFlag.PLANNED);if(carved||planned){var row=new JsonArray();row.add(cx);row.add(cz);row.add(carved);row.add(planned);flags.add(row);}}output.add("matterWindow",flags);output.addProperty("terrainStages",mode.getTerrainStages().size());output.addProperty("contentStages",mode.getStages().size());return output;
        }finally{mode.getTerrainStages().set(0,original);mode.close();caveHost=null;}
    }
    private static JsonObject terrainModeCheck(Engine engine,JsonObject request,PlatformRegistries registries)throws Exception{
        int x=request.get("x").getAsInt(),z=request.get("z").getAsInt();
        var blocks=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,engine.getHeight(),16);blocks.fill(registries.air());
        var biomes=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBiome>(16,engine.getHeight(),16);
        var context=new art.arcane.iris.generation.context.ChunkContext(x,z,engine.getComplex(),false);var mode=engine.getDimension().getMode().create(engine);JsonObject output=new JsonObject();
        boolean generate=request.has("generate")&&request.get("generate").getAsBoolean();
        var previous=art.arcane.iris.generation.context.IrisContext.get();art.arcane.iris.generation.context.ChunkContext[] observed={null};
        try{
            if(generate){
                var original=mode.getTerrainStages().get(0);mode.getTerrainStages().set(0,(bx,bz,b,p,m,c)->{observed[0]=c;original.generate(bx,bz,b,p,m,c);});
                try(var lease=engine.acquireGenerationLease("mode_reference")){mode.generate(x,z,blocks,biomes,false,lease.sessionId());}
                if(observed[0]==null||observed[0].isNaturalTerrain()||art.arcane.iris.generation.context.IrisContext.get()!=previous)throw new IllegalStateException("Native mode context lifecycle failed");
                output.addProperty("contentPhase",true);output.addProperty("sessionId",Long.toString(observed[0].getGenerationSessionId()));output.addProperty("activeLeasesAfter",engine.getGenerationSessions().activeLeases());
            }else try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine,engine.getGenerationSessionId(),context)){mode.generateTerrain(x,z,blocks,biomes,false,context);}
            JsonArray probes=new JsonArray();for(JsonElement value:request.getAsJsonArray("controls")){var xyz=value.getAsJsonArray();int lx=xyz.get(0).getAsInt(),y=xyz.get(1).getAsInt(),lz=xyz.get(2).getAsInt();var row=xyz.deepCopy();row.add(blocks.getRaw(lx,y,lz).key());var biome=biomes.getRaw(lx,y,lz);if(biome==null)throw new IllegalStateException("Native mode biome unresolved");row.add(biome.key());probes.add(row);}output.add("probes",probes);
            output.addProperty("mode",engine.getDimension().getMode().getType().name());output.addProperty("terrainStages",mode.getTerrainStages().size());output.addProperty("contentStages",mode.getStages().size());return output;
        }finally{mode.close();}
    }
    private static JsonArray physicalBiomeChecks(Engine engine,JsonArray checks){
        var chunks=new HashMap<Long,art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBiome>>();JsonArray output=new JsonArray();
        for(JsonElement point:checks){var xyz=point.getAsJsonArray();int x=xyz.get(0).getAsInt(),y=xyz.get(1).getAsInt(),z=xyz.get(2).getAsInt();long key=((long)(x>>4)<<32)|((z>>4)&0xffffffffL);
            var chunk=chunks.computeIfAbsent(key,ignored->{var h=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBiome>(16,engine.getHeight(),16);new art.arcane.iris.generation.stage.IrisBiomeActuator(engine).onActuate(x&~15,z&~15,h,false,new art.arcane.iris.generation.context.ChunkContext(x&~15,z&~15,engine.getComplex(),false));return h;});
            var biome=chunk.getRaw(x&15,y-engine.getMinHeight(),z&15);if(biome==null)throw new IllegalStateException("Native biome fixture unresolved");JsonArray row=xyz.deepCopy();row.add(biome.key());output.add(row);
        }return output;
    }
    private static JsonObject subterrainCell(Engine engine,int x,int worldY,int z){
        var cell=engine.getSubterrainCell(x,worldY-engine.getMinHeight(),z);var output=new JsonObject();output.addProperty("kind",cell.kind().name());output.addProperty("material",cell.material());
        if(cell.owned()){var room=cell.room();output.addProperty("featureId",room.featureId());output.addProperty("family",room.family().name());output.addProperty("biome",room.biome());output.addProperty("floorY",room.floorY());output.addProperty("ceilingY",room.ceilingY());output.addProperty("fluidHeadY",room.fluidHeadY());output.addProperty("reservedPassage",room.reservedPassage());output.addProperty("reservedSolid",room.reservedSolid());}return output;
    }
    private static JsonObject subterrainCheck(Engine engine,Path directory,PlatformRegistries registries,Gson gson,boolean finish)throws Exception {
        art.arcane.iris.world.storage.matter.IrisMatterSupport.ensureRegistered();
        var plans=engine.getComplex().getSubterrainPlanner().plansForBounds(-32,-32,32,32);if(plans.isEmpty())throw new IllegalStateException("Subterrain fixture has no plan");
        var anchor=plans.getFirst().anchor();var room=engine.getSubterrainCell(anchor.x(),anchor.y()-engine.getMinHeight(),anchor.z()).room();int bx=anchor.x()&~15,bz=anchor.z()&~15;
        JsonArray controls=new JsonArray(),diagnostics=new JsonArray();
        int[] ys={room.floorY()-1,room.floorY(),room.floorY()+1,room.fluidHeadY(),room.fluidHeadY()+1,room.ceilingY()-1,room.ceilingY(),room.ceilingY()+1};
        for(int worldY:ys){if(worldY<engine.getMinHeight()||worldY>=engine.getMaxHeight())throw new IllegalStateException("Fixture probes outside world");JsonArray xyz=new JsonArray();xyz.add(anchor.x()-bx);xyz.add(worldY-engine.getMinHeight());xyz.add(anchor.z()-bz);controls.add(xyz);diagnostics.add(subterrainCell(engine,anchor.x(),worldY,anchor.z()));}
        JsonArray outside=new JsonArray();outside.add(0);outside.add(0);outside.add(0);controls.add(outside);diagnostics.add(subterrainCell(engine,bx,engine.getMinHeight(),bz));
        materialSampling=new JsonObject();materialSampling.add("controls",controls);materialSampling.add("materials",new JsonArray());materialSampling.add("ys",new JsonArray());materialSampling.addProperty("limit",1);
        var output=caveMaterials(engine,bx,bz,gson,directory,registries,true,finish,finish,finish,finish,finish);output.add("diagnostics",diagnostics);output.addProperty("finish",finish);return output;
    }
    private static JsonArray expressionChecks(IrisData data,JsonArray checks){
        JsonArray output=new JsonArray();for(JsonElement entry:checks){var row=entry.getAsJsonObject();var expression=data.getExpressionLoader().load(row.get("key").getAsString());JsonArray samples=new JsonArray();
            for(JsonElement point:row.getAsJsonArray("points")){var p=point.getAsJsonArray();var rng=new art.arcane.volmlib.util.math.RNG(p.get(4).getAsLong());double x=p.get(0).getAsDouble(),y=p.get(1).getAsDouble(),z=p.get(2).getAsDouble();samples.add(imageBits(p.get(3).getAsInt()==2?expression.evaluate(rng,x,z):expression.evaluate(rng,x,y,z)));}output.add(samples);
        }return output;
    }
    private static JsonObject cacheStyleChecks(IrisData data,JsonArray styles,Gson gson)throws Exception{
        JsonObject output=new JsonObject();JsonArray values=new JsonArray();
        for(JsonElement entry:styles){var row=entry.getAsJsonObject();var style=gson.fromJson(row.get("style"),art.arcane.iris.generation.noise.IrisGeneratorStyle.class);var cng=style.createForLayer(new art.arcane.volmlib.util.math.RNG(1),data,1);JsonArray samples=new JsonArray();
            for(JsonElement point:row.getAsJsonArray("points")){var c=point.getAsJsonArray();double x=c.get(0).getAsDouble(),y=c.get(1).getAsDouble(),z=c.get(2).getAsDouble();int dimensions=c.get(3).getAsInt();samples.add(imageBits(dimensions==1?cng.noise(x):dimensions==2?cng.noise(x,z):cng.noise(x,y,z)));}values.add(samples);
        }output.add("samples",values);JsonArray files=new JsonArray();try(var paths=Files.list(data.getDataFolder().toPath().resolve(".cache"))){for(Path file:paths.filter(path->path.toString().endsWith(".cnm")).sorted().toList()){byte[] bytes=Files.readAllBytes(file);if(bytes.length>1024)throw new IllegalArgumentException("Cache check tile exceeds tiny fixture budget");JsonObject row=new JsonObject();row.addProperty("name",file.getFileName().toString());row.addProperty("bytes",bytes.length);row.addProperty("sha256",HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)));files.add(row);}}output.add("files",files);return output;
    }
    private static String imageBits(double value){return String.format("%016x",Double.doubleToRawLongBits(value));}
    private static JsonObject imageMapChecks(IrisData data,JsonObject request,Gson gson){
        JsonObject output=new JsonObject();JsonArray maps=new JsonArray();
        for(JsonElement entry:request.getAsJsonArray("imageSamples")){
            JsonObject row=entry.getAsJsonObject();String key=row.get("key").getAsString();var definition=data.getImageMapLoader().load(key);var image=data.getImageLoader().load(definition.getSource());var compiled=art.arcane.iris.generation.image.CompiledIrisImageMap.compile(definition,image);JsonObject value=new JsonObject();value.addProperty("key",key);JsonArray bands=new JsonArray();
            if(image.getWidth()*image.getHeight()>1024)throw new IllegalArgumentException("Image check fixture exceeds 1024 pixels");for(int z=0;z<image.getHeight();z++)for(int x=0;x<image.getWidth();x++)for(int band=0;band<image.getChannelCount();band++)bands.add(image.getBandSample(x,z,band));value.add("bands",bands);
            JsonArray samples=new JsonArray();for(JsonElement point:row.getAsJsonArray("points")){var coordinates=point.getAsJsonArray();double x=coordinates.get(0).getAsDouble(),z=coordinates.get(1).getAsDouble();JsonObject sample=new JsonObject();sample.addProperty("type",compiled.getType().name());sample.addProperty("contentHash",compiled.getContentHash());sample.addProperty("sourceHash",compiled.getSourceMetadata().decodedContentHash());sample.addProperty("width",compiled.getSourceWidth());sample.addProperty("height",compiled.getSourceHeight());
                if(compiled.getType()==art.arcane.iris.generation.image.IrisImageMapType.COLOR_MAP)sample.addProperty("target",compiled.sampleTarget(x,z));else{sample.addProperty("normalized",imageBits(compiled.sampleNormalized(x,z)));if(compiled.getType()==art.arcane.iris.generation.image.IrisImageMapType.GRAYSCALE_HEIGHT||compiled.getType()==art.arcane.iris.generation.image.IrisImageMapType.RGB_HEIGHT)sample.addProperty("worldHeight",imageBits(compiled.sampleHeight(x,z)));}samples.add(sample);
            }value.add("samples",samples);maps.add(value);data.getImageLoader().unload(definition.getSource());
        }output.add("maps",maps);JsonArray styles=new JsonArray();
        for(JsonElement entry:request.getAsJsonArray("imageStyles")){var row=entry.getAsJsonObject();var style=gson.fromJson(row.get("style"),art.arcane.iris.generation.noise.IrisGeneratorStyle.class);var cng=style.createForLayer(new art.arcane.volmlib.util.math.RNG(1),data,1);JsonArray values=new JsonArray();for(JsonElement point:row.getAsJsonArray("points")){var c=point.getAsJsonArray();values.add(imageBits(cng.noise(c.get(0).getAsDouble(),c.get(1).getAsDouble(),c.get(2).getAsDouble())));}styles.add(values);
        }output.add("styles",styles);return output;
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
        var host=(art.arcane.iris.generation.mantle.EngineMantle)Proxy.newProxyInstance(NativeTerrainLinkCheck.class.getClassLoader(),new Class<?>[]{art.arcane.iris.generation.mantle.EngineMantle.class},(self,method,args)->switch(method.getName()){case "getEngine"->engine;case "getComplex"->engine.getComplex();case "getData"->engine.getData();case "getMantle"->mantle;case "trueHeight","getFluidHeight","insertMatter","getHighest","isPreventingDecay","isUnderwater","isDebugSmartBore"->InvocationHandler.invokeDefault(self,method,args);default->throw new UnsupportedOperationException(method.toString());});
        Method create=art.arcane.iris.generation.mantle.MantleWriter.class.getDeclaredMethod("forChunk",art.arcane.iris.generation.mantle.EngineMantle.class,art.arcane.volmlib.util.mantle.runtime.Mantle.class,art.arcane.volmlib.util.mantle.runtime.MantleChunk.class,int.class,int.class);create.setAccessible(true);
        var carver=component?null:new art.arcane.iris.generation.mantle.IrisCaveCarver3D(engine,engine.getDimension().getCaveProfile());
        var carving=component?new art.arcane.iris.generation.mantle.MantleCarvingComponent(host):null;
        neighborhoodComponent=singlePlacement!=null&&singlePlacement.has("neighborhood")?new art.arcane.iris.generation.mantle.MantleObjectComponent(host):null;
        int[][] offsets;if(neighborhoodComponent!=null){int radius=Math.max(1,Math.ceilDiv(neighborhoodComponent.getInputRadius(),16)),side=2*radius+1;offsets=new int[side*side][2];int index=0;for(int dx=-radius;dx<=radius;dx++)for(int dz=-radius;dz<=radius;dz++)offsets[index++]=new int[]{dx,dz};}else offsets=singlePlacement==null?new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1},{-1,-1},{-1,1},{1,-1},{1,1}};
        for(int[] offset:offsets){
            int chunkX=cx+offset[0],chunkZ=cz+offset[1],bx=chunkX<<4,bz=chunkZ<<4;var chunk=mantle.prepare(chunkX,chunkZ);
            try(var writer=(art.arcane.iris.generation.mantle.MantleWriter)create.invoke(null,host,mantle,chunk,chunkX,chunkZ)){
                if(component)carving.generateLayer(writer,chunkX,chunkZ,new art.arcane.iris.generation.context.ChunkContext(bx,bz,engine.getComplex(),false));
                else {int[] surface=new int[256];for(int lx=0;lx<16;lx++)for(int lz=0;lz<16;lz++)surface[(lx<<4)|lz]=engine.getComplex().naturalTrueHeight(bx+lx,bz+lz);carver.carve(writer,chunkX,chunkZ,null,0D,0D,null,surface);}
            }
        }
        var blocks=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,height,16);blocks.fill(registries.air());var context=new art.arcane.iris.generation.context.ChunkContext(x,z,engine.getComplex(),false);
        var physicalBiomes=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBiome>(16,height,16);context.setTerrainBiomeOutput(physicalBiomes);
        new art.arcane.iris.generation.stage.IrisBiomeActuator(engine).onActuate(x,z,physicalBiomes,false,context);
        new art.arcane.iris.generation.stage.IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
        int[] placedY={-1};
        caveHost=host;try{var cave=new art.arcane.iris.generation.stage.IrisCarveModifier(engine);cave.onModify(cx,cz,blocks,false,context);if(post)new art.arcane.iris.generation.stage.IrisPostModifier(engine).onModify(x,z,blocks,false,context);var floatingModifier=floating?new art.arcane.iris.generation.stage.IrisFloatingChildBiomeModifier(engine):null;if(floating)floatingModifier.onModify(x,z,blocks,false,context);if(decorate)cave.decorateNaturalCaves(x,z,blocks,context);if(singlePlacement!=null)placedY[0]=placeSelected(engine,host,mantle,x,z,context);if(deposits){new art.arcane.iris.generation.stage.IrisDepositModifier(engine).onModify(x,z,blocks,false,context);host.insertMatter(cx,cz,blocks,false,context);}if(finish){new art.arcane.iris.generation.stage.IrisDecorantActuator(engine).onActuate(x,z,blocks,false,context);floatingModifier.decorateColumns(x,z,blocks,false,context);new art.arcane.iris.generation.stage.IrisPerfectionModifier(engine).onModify(x,z,blocks,false,context);if(preserveSubterrain)cave.preserveSubterrain(x,z,blocks);}}finally{caveHost=null;}
        JsonObject result=new JsonObject();if(singlePlacement!=null&&singlePlacement.has("nativeGenerateLayer"))result.addProperty("nativeGenerateLayer",singlePlacement.get("nativeGenerateLayer").getAsBoolean());if(lastNeighborhood!=null)result.add("neighborhood",lastNeighborhood);result.addProperty("placedY",placedY[0]);if(singlePlacement!=null){int[] journals={0};var centre=mantle.prepare(cx,cz);for(int section=0;section<(height+15)/16;section++)if(centre.exists(section)){var slice=centre.get(section).getSlice(art.arcane.iris.world.storage.matter.PreObjectMatterCell.class);if(slice!=null)slice.iterate((lx,ly,lz,value)->journals[0]++);}result.addProperty("journaledCells",journals[0]);if(lastNeighborhood!=null){JsonArray window=new JsonArray();if(journals[0]>0){JsonArray row=new JsonArray();row.add(cx);row.add(cz);row.add(journals[0]);window.add(row);}result.add("journalWindow",window);}if(singlePlacement.has("sourceScatter")){Set<String> tags=new HashSet<>();int[] values={0,0};for(int section=0;section<(height+15)/16;section++)if(centre.exists(section)){var matter=centre.get(section);var strings=matter.getSlice(String.class);var trees=matter.getSlice(art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class);if(strings!=null)strings.iterate((lx,ly,lz,value)->{values[0]++;tags.add(value);});if(trees!=null)trees.iterate((lx,ly,lz,value)->values[1]++);}JsonObject objectTags=new JsonObject();objectTags.addProperty("cells",values[0]);objectTags.addProperty("placements",tags.size());objectTags.addProperty("treeMaterials",values[1]);result.add("objectTags",objectTags);}if(lastSourcePlan!=null){JsonObject plan=new JsonObject();plan.addProperty("destinations",lastSourcePlan[0]);plan.addProperty("replayedDestinations",lastSourcePlan[1]);plan.addProperty("retainedBytes",lastSourcePlan[2]);result.add("sourcePlan",plan);JsonArray window=new JsonArray();for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++){var chunk=mantle.prepare(cx+dx,cz+dz);int[] count={0};for(int section=0;section<(height+15)/16;section++)if(chunk.exists(section)){var slice=chunk.get(section).getSlice(art.arcane.iris.world.storage.matter.PreObjectMatterCell.class);if(slice!=null)slice.iterate((lx,ly,lz,value)->count[0]++);}if(count[0]>0){JsonArray row=new JsonArray();row.add(cx+dx);row.add(cz+dz);row.add(count[0]);window.add(row);}}result.add("journalWindow",window);}}result.addProperty("scope",singlePlacement!=null?"native-procedural-placement-development":finish?"native-overworld-material-finish-development":deposits?"native-overworld-deposit-material-stage-development":decorate?"native-overworld-cave-decoration-stage-development":floating?"native-overworld-floating-material-stage-development":post?"native-overworld-post-material-stage-development":component?"native-carving-component-material-stage-development":"native-dimension-cave-material-stage-development");result.addProperty("x",x);result.addProperty("z",z);result.addProperty("minY",engine.getMinHeight());result.addProperty("height",height);if(materialSampling!=null){
            JsonArray probes=new JsonArray();for(JsonElement point:materialSampling.getAsJsonArray("controls")){JsonArray xyz=point.getAsJsonArray();addProbe(probes,blocks,xyz.get(0).getAsInt(),xyz.get(1).getAsInt(),xyz.get(2).getAsInt());}
            Set<String> materials=new HashSet<>();for(JsonElement key:materialSampling.getAsJsonArray("materials"))materials.add(key.getAsString());int limit=materialSampling.get("limit").getAsInt();if(limit<1||limit>64)throw new IllegalArgumentException("Targeted probe limit");int selected=0;
            if(materialSampling.has("journalMaterials")&&materialSampling.get("journalMaterials").getAsBoolean()){
                // Select only populated native journal cells; do not sweep the voxel volume for content.
                Set<String> found=new HashSet<>();List<int[]> candidates=new ArrayList<>();var centre=mantle.prepare(cx,cz);
                for(int section=0;section<(height+15)/16;section++)if(centre.exists(section)){
                    var slice=centre.get(section).getSlice(art.arcane.iris.world.storage.matter.PreObjectMatterCell.class);int baseY=section<<4;
                    if(slice!=null)slice.iterate((lx,ly,lz,value)->candidates.add(new int[]{lx,baseY+ly,lz}));
                }
                candidates.sort(Comparator.<int[]>comparingInt(v->v[1]).thenComparingInt(v->v[2]).thenComparingInt(v->v[0]));
                for(int[] point:candidates){String material=blocks.getRaw(point[0],point[1],point[2]).materialKey();if(materials.contains(material)&&found.add(material)){if(++selected>limit)throw new IllegalStateException("Targeted probe budget exceeded");addProbe(probes,blocks,point[0],point[1],point[2]);if(found.size()==materials.size())break;}}
            }
            Set<String> sampledMaterials=new HashSet<>();probeSearch:for(JsonElement band:(singlePlacement!=null&&placedY[0]<0&&!singlePlacement.has("sourceScatter"))?new JsonArray():materialSampling.getAsJsonArray("ys")){int y=band.getAsInt();for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){String material=blocks.getRaw(lx,y,lz).materialKey();if(materials.contains(material)&&(singlePlacement==null||sampledMaterials.add(material))){if(++selected>limit)throw new IllegalStateException("Targeted probe budget exceeded");addProbe(probes,blocks,lx,y,lz);if(singlePlacement!=null&&sampledMaterials.size()==materials.size())break probeSearch;}}}
            if(singlePlacement!=null&&singlePlacement.has("tilePayloads")){
                JsonArray tiles=new JsonArray();var centre=mantle.prepare(cx,cz);
                for(int section=0;section<(height+15)/16;section++)if(centre.exists(section)){var slice=centre.get(section).getSlice(art.arcane.iris.world.storage.matter.TileWrapper.class);int baseY=section<<4;if(slice!=null)slice.iterate((lx,ly,lz,value)->{
                    try{var bytes=new java.io.ByteArrayOutputStream();value.getData().toBinary(new java.io.DataOutputStream(bytes));JsonObject row=new JsonObject();row.add("position",gson.toJsonTree(List.of(x+lx,engine.getMinHeight()+baseY+ly,z+lz)));try(var in=new java.io.DataInputStream(new java.io.ByteArrayInputStream(bytes.toByteArray()))){row.addProperty("material",in.readUTF());row.addProperty("propertiesJson",in.readUTF());}row.addProperty("binaryBytes",bytes.size());tiles.add(row);}catch(java.io.IOException failure){throw new IllegalStateException(failure);}
                });}result.add("tilePayloads",tiles);
            }
            result.addProperty("selected",selected);result.add("probes",probes);JsonArray biomeProbes=new JsonArray();for(JsonElement point:materialSampling.getAsJsonArray("controls")){var xyz=point.getAsJsonArray();var row=xyz.deepCopy();var biome=physicalBiomes.getRaw(xyz.get(0).getAsInt(),xyz.get(1).getAsInt(),xyz.get(2).getAsInt());if(biome==null)throw new IllegalStateException("Native material biome unresolved");row.add(biome.key());biomeProbes.add(row);}result.add("biomeProbes",biomeProbes);return result;
        }LinkedHashMap<String,Integer> palette=new LinkedHashMap<>();JsonArray cells=new JsonArray();for(int y=0;y<height;y++)for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){String key=blocks.getRaw(lx,y,lz).key();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells.add(index);}result.add("palette",gson.toJsonTree(palette.keySet()));result.add("cells",cells);if(decorate){JsonArray markers=new JsonArray();var chunk=mantle.prepare(cx,cz);for(int y=0;y<height;y++)for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){var marker=chunk.get(lx,y,lz,art.arcane.volmlib.util.matter.MatterMarker.class);if(marker!=null){JsonArray entry=new JsonArray();entry.add(lx);entry.add(y);entry.add(lz);entry.add(marker.getTag());markers.add(entry);}}result.add("markers",markers);}return result;
    }
    private static int placeSelected(Engine engine,art.arcane.iris.generation.mantle.EngineMantle host,MemoryCaveMantle mantle,int x,int z,art.arcane.iris.generation.context.ChunkContext context)throws Exception{
        lastNeighborhood=null;
        lastSourcePlan=singlePlacement.has("sourcePlanReplay")&&singlePlacement.get("sourcePlanReplay").getAsBoolean()?new int[]{0,0,0}:null;
        if(singlePlacement.has("persistContinuations"))art.arcane.iris.world.storage.matter.IrisMatterSupport.ensureRegistered();
        else{art.arcane.volmlib.util.matter.IrisMatter.registerSliceType(new art.arcane.iris.world.storage.matter.PreObjectMatter());
        art.arcane.volmlib.util.matter.IrisMatter.registerSliceType(new art.arcane.iris.world.storage.matter.PlatformBlockMatter());}
        if(singlePlacement.has("neighborhood"))return scatterNeighborhood(engine,host,mantle,x,z,context);
        if(singlePlacement.has("sourceScatter")&&singlePlacement.get("sourceScatter").getAsBoolean())return scatterOrigin(engine,host,mantle,x,z,context);
        var biome=engine.getData().getBiomeLoader().load(singlePlacement.get("key").getAsString());art.arcane.iris.generation.decoration.IrisProceduralPlacement entry=singlePlacement.has("family")&&singlePlacement.get("family").getAsString().equals("ruins")?biome.getProceduralObjects().getRuins().get(0):biome.getProceduralObjects().getTrees().get(0);var pool=entry.getVariantObjects(engine.getData());var rng=new art.arcane.volmlib.util.math.RNG(Long.parseLong(singlePlacement.get("seed").getAsString()));var config=entry.asPlacement();if(singlePlacement.has("edit"))config.getEdit().add(new Gson().fromJson(singlePlacement.get("edit"),art.arcane.iris.structure.object.IrisObjectReplace.class));var object=config.scaleObject(rng,pool.get(0),engine.getDimension());
        Constructor<?> constructor=art.arcane.iris.generation.mantle.MantleWriter.class.getDeclaredConstructor(art.arcane.iris.generation.mantle.EngineMantle.class,art.arcane.volmlib.util.mantle.runtime.Mantle.class,int.class,int.class,int.class);constructor.setAccessible(true);
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine,engine.getGenerationSessionId(),context);var writer=(art.arcane.iris.generation.mantle.MantleWriter)constructor.newInstance(host,mantle,x>>4,z>>4,1)){
            Class<?> type=Class.forName("art.arcane.iris.generation.mantle.ObjectDestinationTransaction");Constructor<?> transactionConstructor=type.getDeclaredConstructor(art.arcane.iris.generation.mantle.MantleWriter.class,int.class,int.class);transactionConstructor.setAccessible(true);var transaction=(art.arcane.iris.generation.mantle.ObjectPassPlacer)transactionConstructor.newInstance(writer,x>>4,z>>4);Method commit=type.getDeclaredMethod("commit");commit.setAccessible(true);art.arcane.iris.structure.object.IObjectPlacer placer=entry.isPlausible()?new art.arcane.iris.structure.object.DecayControlPlacer(transaction):transaction;int[] y={-1};writer.withComponentPriority(2,()->{int checkpoint=transaction.beginObjectPlacement();y[0]=object.place(x+8,-1,z+8,placer,config,rng,engine.getData());if(y[0]>=0){transaction.endObjectPlacement(checkpoint);try{if(lastSourcePlan==null)commit.invoke(transaction);else replaySelectedPlan(type,transactionConstructor,transaction,writer,x>>4,z>>4,checkpoint);}catch(ReflectiveOperationException failure){throw new IllegalStateException(failure);}}});return y[0];
        }
    }
    private static int scatterNeighborhood(Engine engine,art.arcane.iris.generation.mantle.EngineMantle host,MemoryCaveMantle mantle,int x,int z,art.arcane.iris.generation.context.ChunkContext context)throws Exception{
        lastSourcePlan=null;
        if(!singlePlacement.has("persistContinuations"))art.arcane.volmlib.util.matter.IrisMatter.registerSliceType(new art.arcane.iris.world.storage.matter.TreeBlockMaterialMatter());
        var component=neighborhoodComponent;int radius=component.getRadius(),input=Math.max(1,Math.ceilDiv(component.getInputRadius(),16));
        Constructor<?> writerConstructor=art.arcane.iris.generation.mantle.MantleWriter.class.getDeclaredConstructor(art.arcane.iris.generation.mantle.EngineMantle.class,art.arcane.volmlib.util.mantle.runtime.Mantle.class,int.class,int.class,int.class);writerConstructor.setAccessible(true);
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine,engine.getGenerationSessionId(),context);var writer=(art.arcane.iris.generation.mantle.MantleWriter)writerConstructor.newInstance(host,mantle,x>>4,z>>4,input)){
            if(singlePlacement.has("nativeGenerateLayer")&&singlePlacement.get("nativeGenerateLayer").getAsBoolean()){
                writer.withComponentPriority(2,()->component.generateLayer(writer,x>>4,z>>4,context));return 0;
            }
            Class<?> type=Class.forName("art.arcane.iris.generation.mantle.ObjectDestinationTransaction"),planType=Class.forName("art.arcane.iris.generation.mantle.ObjectSourcePlan"),consumerType=Class.forName("art.arcane.iris.generation.mantle.MantleObjectComponent$SourceChunkConsumer");
            Constructor<?> transactionConstructor=type.getDeclaredConstructor(art.arcane.iris.generation.mantle.MantleWriter.class,int.class,int.class);transactionConstructor.setAccessible(true);Object destination=transactionConstructor.newInstance(writer,x>>4,z>>4);
            Method build=component.getClass().getDeclaredMethod("buildSourcePlan",art.arcane.iris.generation.mantle.MantleWriter.class,int.class,int.class,art.arcane.iris.generation.context.ChunkContext.class),enumerate=component.getClass().getDeclaredMethod("replaySourceChunks",int.class,int.class,int.class,consumerType),slot=planType.getDeclaredMethod("destinationSlot",int.class,int.class),bytes=planType.getDeclaredMethod("estimatedRetainedBytes"),apply=type.getDeclaredMethod("apply",planType),commit=type.getDeclaredMethod("commit"),persist=planType.getDeclaredMethod("persistContinuations",art.arcane.iris.generation.mantle.MantleWriter.class,int.class,int.class,int.class,int.class);for(Method method:new Method[]{build,enumerate,slot,bytes,apply,commit,persist})method.setAccessible(true);
            int[] counts={0,0};long[] totalBytes={0};Object callback=Proxy.newProxyInstance(consumerType.getClassLoader(),new Class<?>[]{consumerType},(self,method,args)->{Object plan=build.invoke(component,writer,args[0],args[1],context);counts[0]++;totalBytes[0]+=(int)bytes.invoke(plan);if((int)slot.invoke(plan,x>>4,z>>4)>=0){counts[1]++;apply.invoke(destination,plan);if(singlePlacement.has("persistContinuations"))persist.invoke(plan,writer,args[0],args[1],x>>4,z>>4);}return null;});
            writer.withComponentPriority(2,()->{try{enumerate.invoke(null,x>>4,z>>4,radius,callback);commit.invoke(destination);}catch(ReflectiveOperationException failure){throw new IllegalStateException(failure);}});
            JsonObject stats=new JsonObject();stats.addProperty("sourceChunks",counts[0]);stats.addProperty("contributingSources",counts[1]);stats.addProperty("placementRadius",radius);stats.addProperty("inputChunkRadius",input);stats.addProperty("sourceChunkRadius",radius>0?Math.ceilDiv(radius,16):0);stats.addProperty("builtPlanBytes",totalBytes[0]);lastNeighborhood=stats;
        }return 0;
    }
    private static int scatterOrigin(Engine engine,art.arcane.iris.generation.mantle.EngineMantle host,MemoryCaveMantle mantle,int x,int z,art.arcane.iris.generation.context.ChunkContext context)throws Exception{
        art.arcane.volmlib.util.matter.IrisMatter.registerSliceType(new art.arcane.iris.world.storage.matter.TreeBlockMaterialMatter());
        Constructor<?> writerConstructor=art.arcane.iris.generation.mantle.MantleWriter.class.getDeclaredConstructor(art.arcane.iris.generation.mantle.EngineMantle.class,art.arcane.volmlib.util.mantle.runtime.Mantle.class,int.class,int.class,int.class);writerConstructor.setAccessible(true);
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine,engine.getGenerationSessionId(),context);var writer=(art.arcane.iris.generation.mantle.MantleWriter)writerConstructor.newInstance(host,mantle,x>>4,z>>4,1)){
            Class<?> type=Class.forName("art.arcane.iris.generation.mantle.ObjectDestinationTransaction");Constructor<?> transactionConstructor=type.getDeclaredConstructor(art.arcane.iris.generation.mantle.MantleWriter.class,int.class,int.class);transactionConstructor.setAccessible(true);Object transaction=transactionConstructor.newInstance(writer,x>>4,z>>4);
            Method origin=art.arcane.iris.generation.mantle.MantleObjectComponent.class.getDeclaredMethod("generateOrigin",art.arcane.iris.generation.mantle.ObjectPassPlacer.class,int.class,int.class,art.arcane.iris.generation.context.ChunkContext.class);origin.setAccessible(true);
            var component=new art.arcane.iris.generation.mantle.MantleObjectComponent(host);
            writer.withComponentPriority(2,()->{try{origin.invoke(component,transaction,x>>4,z>>4,context);replaySelectedPlan(type,transactionConstructor,transaction,writer,x>>4,z>>4,0);}catch(ReflectiveOperationException failure){throw new IllegalStateException(failure);}});
            return 0;
        }
    }
    private static void replaySelectedPlan(Class<?> type,Constructor<?> constructor,Object source,art.arcane.iris.generation.mantle.MantleWriter writer,int cx,int cz,int checkpoint)throws ReflectiveOperationException{
        Method build=type.getDeclaredMethod("sourcePlanSince",int.class);build.setAccessible(true);Object plan=build.invoke(source,checkpoint);Class<?> planType=plan.getClass();
        Method slot=planType.getDeclaredMethod("destinationSlot",int.class,int.class),count=planType.getDeclaredMethod("destinationCount"),bytes=planType.getDeclaredMethod("estimatedRetainedBytes"),apply=type.getDeclaredMethod("apply",planType),commit=type.getDeclaredMethod("commit");for(Method method:new Method[]{slot,count,bytes,apply,commit})method.setAccessible(true);
        int replayed=0;for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)if((int)slot.invoke(plan,cx+dx,cz+dz)>=0){Object destination=constructor.newInstance(writer,cx+dx,cz+dz);apply.invoke(destination,plan);commit.invoke(destination);replayed++;}
        int destinations=(int)count.invoke(plan);if(replayed!=destinations)throw new IllegalStateException("Reference plan exceeds the bounded replay window");lastSourcePlan=new int[]{destinations,replayed,(int)bytes.invoke(plan)};
    }
    private static void addProbe(JsonArray probes,art.arcane.volmlib.util.hunk.Hunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState> blocks,int x,int y,int z){JsonArray probe=new JsonArray();probe.add(x);probe.add(y);probe.add(z);probe.add(blocks.getRaw(x,y,z).key());probes.add(probe);}
    private static final class MemoryCaveMantle extends art.arcane.volmlib.util.mantle.runtime.Mantle<art.arcane.volmlib.util.matter.Matter>{
        private final Map<Long,art.arcane.volmlib.util.mantle.runtime.TectonicPlate<art.arcane.volmlib.util.matter.Matter>> plates=new HashMap<>();
        private final int height;private final art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter> adapter;
        MemoryCaveMantle(Path directory,int height,art.arcane.volmlib.util.mantle.runtime.MantleDataAdapter<art.arcane.volmlib.util.matter.Matter> adapter){super(directory.resolve("unused-cave-material-storage").toFile(),height,1,null,null,null,adapter,art.arcane.volmlib.util.mantle.runtime.MantleHooks.NONE);this.height=height;this.adapter=adapter;}
        private static long regionKey(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
        art.arcane.volmlib.util.mantle.runtime.MantleChunk<art.arcane.volmlib.util.matter.Matter> prepare(int x,int z){return plates.computeIfAbsent(regionKey(x>>5,z>>5),ignored->new art.arcane.volmlib.util.mantle.runtime.TectonicPlate<>(height,x>>5,z>>5,adapter,art.arcane.volmlib.util.mantle.runtime.MantleHooks.NONE)).getOrCreate(x&31,z&31);}
        @Override public void getChunks(int minX,int maxX,int minZ,int maxZ,int parallelism,art.arcane.volmlib.util.function.Consumer3<Integer,Integer,art.arcane.volmlib.util.mantle.runtime.MantleChunk<art.arcane.volmlib.util.matter.Matter>> consumer){if((long)(maxX-minX+1)*(maxZ-minZ+1)>49)throw new IllegalStateException("Reference native prefetch exceeds its bounded window");for(int x=minX;x<=maxX;x++)for(int z=minZ;z<=maxZ;z++)consumer.accept(x,z,prepare(x,z));}
        @Override public <T>void set(int x,int y,int z,T value){if(!(value instanceof art.arcane.volmlib.util.matter.MatterMarker))throw new UnsupportedOperationException("Only native cave markers are owned by this reference host");if(y>=0&&y<height)prepare(x>>4,z>>4).getOrCreate(y>>4).<T>slice(art.arcane.volmlib.util.matter.MatterMarker.class).set(x&15,y&15,z&15,value);}
        @Override public art.arcane.volmlib.util.mantle.runtime.TectonicPlate<art.arcane.volmlib.util.matter.Matter> getLoadedRegion(int x,int z){return plates.get(regionKey(x,z));}
        @Override public art.arcane.volmlib.util.mantle.runtime.MantleChunk<art.arcane.volmlib.util.matter.Matter> useChunk(int x,int z){var plate=getLoadedRegion(x>>5,z>>5);var chunk=plate==null?null:plate.get(x&31,z&31);if(chunk==null)throw new IllegalStateException("Native cave chunk missing");return chunk.use();}
    }

}
