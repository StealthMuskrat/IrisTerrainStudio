// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.pack.loading.*;
import art.arcane.iris.pack.validation.ContentGate;
import art.arcane.iris.spi.PlatformRegistries;
import art.arcane.iris.generation.block.IrisBlockData;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.*;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import com.google.gson.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/** Focused oracle: unchanged native state resolver and compatibility walker, no generated terrain. */
public final class NativeRegistryLinkCheck {
    private static final String[] FLAGS={"isAir","isSolid","isOccluding","isFluid","isWater","isWaterLogged","isLit","isUpdatable","isFoliage","isTreeBlock","isFoliagePlantable","isDecorant","isStorage","isStorageChest","isOre","isDeepSlate","isVineBlock","hasTileEntity"};
    private static JsonElement describe(ModdedBlockState state)throws Exception{
        if(state==null)return JsonNull.INSTANCE;JsonObject value=new JsonObject();value.addProperty("key",state.key());int flags=0;for(int i=0;i<FLAGS.length;i++)if((boolean)state.getClass().getMethod(FLAGS[i]).invoke(state))flags|=1<<i;value.addProperty("flags",flags);
        if(state.parsedProperties()==null)value.add("parsed",JsonNull.INSTANCE);else{JsonObject parsed=new JsonObject();for(var entry:state.parsedProperties().entrySet())parsed.addProperty(entry.getKey().getName(),propertyValue(entry.getKey(),entry.getValue()));value.add("parsed",parsed);}return value;
    }
    @SuppressWarnings({"rawtypes","unchecked"})private static String propertyValue(net.minecraft.world.level.block.state.properties.Property property,Comparable value){return property.getName(value);}
    public static void main(String[] args)throws Exception{
        Gson gson=new GsonBuilder().serializeNulls().create();JsonObject request=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject(),result=new JsonObject();
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return new art.arcane.iris.configuration.IrisSettings.IrisSettingsGenerator().isPreventLeafDecay();}public void reportError(String key,Throwable failure){}public void warnUnresolved(String key,String message){}public void debug(String message){}});resolver.getAir();
            JsonArray states=new JsonArray();for(JsonElement entry:request.getAsJsonArray("states")){
                String text=entry.getAsString();JsonObject row=new JsonObject();try{row.add("strict",describe(NativeBlockResolver.strictParse(text.trim())));}catch(IllegalArgumentException failure){JsonObject error=new JsonObject();error.addProperty("error",true);row.add("strict",error);}row.add("compat",describe(resolver.getOrNull(text)));states.add(row);
            }result.add("states",states);
            JsonArray matches=new JsonArray();for(JsonElement entry:request.getAsJsonArray("matches")){JsonArray pair=entry.getAsJsonArray();matches.add(NativeBlockResolver.strictParse(pair.get(0).getAsString()).matches(NativeBlockResolver.strictParse(pair.get(1).getAsString())));}result.add("matches",matches);
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            JsonArray cases=new JsonArray();for(JsonElement entry:request.getAsJsonArray("packs")){
                Path directory=Path.of(entry.getAsString());IrisData data=IrisData.openDatapackCompiler(directory.toFile());Method register=IrisData.class.getDeclaredMethod("registerLoader",Class.class,art.arcane.volmlib.util.collection.KMap.class);register.setAccessible(true);@SuppressWarnings("unchecked") ResourceLoader<IrisBlockData> blocks=(ResourceLoader<IrisBlockData>)register.invoke(data,IrisBlockData.class,data.getLoaders());data.setBlockLoader(blocks);
                ContentGate gate=new ContentGate(registries,()->ContentGate.readBlockFallbacks(directory.toFile()),data.getCompatReport(),key->blocks.load(key,false));Field gateField=IrisData.class.getDeclaredField("contentGate");gateField.setAccessible(true);gateField.set(data,gate);
                IrisRegistrant dimension=data.getDimensionLoader().load("terrain3d");if(dimension==null)throw new IllegalStateException("Native dimension failed to load");JsonObject row=new JsonObject();row.addProperty("excluded",dimension.isCompatExcluded());row.add("findings",gson.toJsonTree(data.getCompatReport().detailLines()));row.addProperty("incomplete",data.getCompatReport().isIncomplete());cases.add(row);
                if(!dimension.isCompatExcluded()){
                    JsonArray selections=new JsonArray();for(JsonElement seed:request.getAsJsonArray("regionSeeds")){
                        long complex=new art.arcane.iris.generation.runtime.SeedManager(Long.parseLong(seed.getAsString())).getComplex();var stream=art.arcane.iris.generation.terrain.RegionSelection.restore(new art.arcane.iris.generation.terrain.RegionSelection.Snapshot((art.arcane.iris.generation.terrain.IrisDimension)dimension,data,complex,directory.getFileName().toString().equals("buffet")));
                        JsonArray selected=new JsonArray();for(JsonElement point:request.getAsJsonArray("points")){JsonArray coordinates=point.getAsJsonArray();selected.add(stream.get(coordinates.get(0).getAsDouble(),coordinates.get(1).getAsDouble()).getLoadKey());}selections.add(selected);
                    }row.add("regions",selections);
                    JsonArray variants=new JsonArray();var biome=data.getBiomeLoader().load("ledges");for(var type:List.of(art.arcane.iris.generation.terrain.InferredType.LAND,art.arcane.iris.generation.terrain.InferredType.SEA,art.arcane.iris.generation.terrain.InferredType.SHORE,art.arcane.iris.generation.terrain.InferredType.LAND)){var variant=biome.withInferredType(type);JsonObject description=new JsonObject();description.addProperty("type",variant.getInferredType().name());description.addProperty("key",variant.getLoadKey());description.add("config",JsonParser.parseString(data.getGson().toJson(variant)));variants.add(description);}row.add("variants",variants);
                }
            }result.add("packs",cases);
            IrisData configData=IrisData.openDatapackCompiler(Path.of(request.getAsJsonArray("packs").get(0).getAsString()).toFile());JsonArray configs=new JsonArray();for(JsonElement item:request.getAsJsonArray("configs")){JsonObject input=item.getAsJsonObject();try{Class<?> type=Class.forName(input.get("type").getAsString());Object value=configData.getGson().fromJson(input.get("text").getAsString(),type);configs.add(JsonParser.parseString(configData.getGson().toJson(value)));}catch(com.google.gson.JsonParseException failure){JsonObject error=new JsonObject();error.addProperty("error",true);configs.add(error);}}result.add("configs",configs);
        }
        Files.writeString(Path.of(args[1]),gson.toJson(result));
    }
}
