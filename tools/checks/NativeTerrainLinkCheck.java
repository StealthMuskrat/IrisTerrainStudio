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
    public static void main(String[] args)throws Exception{
        Gson gson=new GsonBuilder().serializeNulls().create();JsonObject request=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();JsonArray result=new JsonArray();
        art.arcane.iris.configuration.IrisSettings.settings=new art.arcane.iris.configuration.IrisSettings();
        IrisServices.register(PreservationRegistry.class,Proxy.newProxyInstance(PreservationRegistry.class.getClassLoader(),new Class<?>[]{PreservationRegistry.class},(self,method,values)->null));
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return true;}public void reportError(String key,Throwable failure){throw new IllegalStateException(failure);}public void warnUnresolved(String key,String message){throw new IllegalStateException(message);}public void debug(String message){}});resolver.getAir();
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            IrisPlatforms.bind((IrisPlatform)Proxy.newProxyInstance(IrisPlatform.class.getClassLoader(),new Class<?>[]{IrisPlatform.class},(self,method,values)->switch(method.getName()){case"platformName"->"native-terrain-reference";case"minecraftVersion"->"26.3";case"registries"->registries;case"log","msg"->{System.err.println(Arrays.toString(values));yield null;}case"reportError"->throw new IllegalStateException(Arrays.toString(values));default->throw new UnsupportedOperationException(method.toString());}));
            for(JsonElement entry:request.getAsJsonArray("packs")){
                Path directory=Path.of(entry.getAsString());IrisData data=IrisData.openDatapackCompiler(directory.toFile());Method register=IrisData.class.getDeclaredMethod("registerLoader",Class.class,art.arcane.volmlib.util.collection.KMap.class);register.setAccessible(true);@SuppressWarnings("unchecked") ResourceLoader<IrisBlockData> blocks=(ResourceLoader<IrisBlockData>)register.invoke(data,IrisBlockData.class,data.getLoaders());data.setBlockLoader(blocks);
                Field gateField=IrisData.class.getDeclaredField("contentGate");gateField.setAccessible(true);gateField.set(data,new ContentGate(registries,()->ContentGate.readBlockFallbacks(directory.toFile()),data.getCompatReport(),key->blocks.load(key,false)));
                IrisDimension dimension=data.getDimensionLoader().load("terrain3d");if(dimension==null||dimension.isCompatExcluded())throw new IllegalStateException("Native dimension unavailable");
                JsonArray pack=new JsonArray();for(JsonElement seed:request.getAsJsonArray("seeds")){
                    SeedManager seeds=new SeedManager(Long.parseLong(seed.getAsString()));IrisComplex[] runtime={null};
                    Engine engine=(Engine)Proxy.newProxyInstance(Engine.class.getClassLoader(),new Class<?>[]{Engine.class},(self,method,values)->switch(method.getName()){
                        case"getDimension"->dimension;case"getData"->data;case"getSeedManager"->seeds;case"getMinHeight"->dimension.getMinHeight();case"getMaxHeight"->dimension.getMaxHeight();case"getHeight"->{if(values!=null&&values.length!=0)throw new UnsupportedOperationException(method.toString());yield dimension.getMaxHeight()-dimension.getMinHeight();}case"getCacheID"->System.identityHashCode(self);case"getUpperContext"->null;case"getPlatformHooks"->new EnginePlatformHooks(){};case"getComplex"->runtime[0];case"isStudio","isClosed"->false;
                        case"getFocus"->{String key=dimension.getFocus();var biome=key==null||key.isBlank()?null:data.getBiomeLoader().load(key);yield biome==null||biome.isCompatExcluded()?null:biome;}
                        case"getFocusRegion"->{String key=dimension.getFocusRegion();var region=key==null||key.isBlank()?null:data.getRegionLoader().load(key);yield region==null||region.isCompatExcluded()?null:region;}
                        default->throw new UnsupportedOperationException(method.toString());
                    });runtime[0]=new IrisComplex(engine);
                    JsonArray samples=new JsonArray();for(JsonElement point:request.getAsJsonArray("points")){JsonArray coordinates=point.getAsJsonArray();double x=coordinates.get(0).getAsDouble(),z=coordinates.get(1).getAsDouble();JsonObject sample=new JsonObject();sample.addProperty("height",Long.toUnsignedString(Double.doubleToRawLongBits(runtime[0].getHeightStream().getDouble(x,z)),16));sample.addProperty("biome",runtime[0].getTrueBiomeStream().get(x,z).getLoadKey());if(request.has("columns")&&request.get("columns").getAsBoolean()){
                        var column=runtime[0].naturalTerrainColumn((int)Math.floor(x),(int)Math.floor(z));if(column==null)sample.add("column",JsonNull.INSTANCE);else{JsonObject value=new JsonObject();value.addProperty("baseHeight",String.format("%016x",Double.doubleToRawLongBits(column.baseHeight())));value.addProperty("minY",column.minY());value.addProperty("topY",column.topY());value.addProperty("shaped",column.shaped());JsonArray spans=new JsonArray();for(int i=0;i<column.spanCount();i++){JsonArray span=new JsonArray();span.add(column.ceiling(i));span.add(column.floor(i));spans.add(span);}value.add("spans",spans);StringBuilder occupancy=new StringBuilder();for(int y=0;y<dimension.getMaxHeight()-dimension.getMinHeight();y++)occupancy.append(column.isSolid(y)?'1':'0');value.addProperty("occupancy",occupancy.toString());sample.add("column",value);}}
                        if(request.has("paint")&&request.get("paint").getAsBoolean()){
                            int bx=(int)x,bz=(int)z,localHeight=dimension.getMaxHeight()-dimension.getMinHeight();var blocksOut=new art.arcane.volmlib.util.hunk.storage.ArrayHunk<art.arcane.volmlib.nativelib.terrain.NativeBlockState>(16,localHeight,16);blocksOut.fill(registries.air());new art.arcane.iris.generation.stage.IrisTerrainNormalActuator(engine).paint(bx,bz,blocksOut,new art.arcane.iris.generation.context.ChunkContext(bx,bz,runtime[0],false));
                            JsonObject painted=new JsonObject();painted.addProperty("scope","native-terrain-paint-stage-development");painted.addProperty("x",bx);painted.addProperty("z",bz);painted.addProperty("minY",dimension.getMinHeight());painted.addProperty("height",localHeight);LinkedHashMap<String,Integer> palette=new LinkedHashMap<>();JsonArray cells=new JsonArray();for(int y=0;y<localHeight;y++)for(int localZ=0;localZ<16;localZ++)for(int localX=0;localX<16;localX++){String key=blocksOut.getRaw(localX,y,localZ).key();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells.add(index);}painted.add("palette",gson.toJsonTree(palette.keySet()));painted.add("cells",cells);sample.add("painted",painted);
                        }
                        samples.add(sample);}pack.add(samples);
                }result.add(pack);
            }
        }finally{IrisPlatforms.unbind();IrisServices.clear();}
        Files.writeString(Path.of(args[1]),gson.toJson(result));
    }
}
