// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.structure.object.IrisObject;
import art.arcane.iris.structure.object.IrisObjectIO;
import art.arcane.iris.generation.geometry.IrisBlockVector;
import art.arcane.iris.spi.*;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.*;
import com.google.gson.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/** Tiny original native ruin pools: metadata and up to three selected material probes per entry. */
public final class NativeRuinLinkCheck {
    public static void main(String[] args)throws Exception{
        art.arcane.iris.configuration.IrisSettings.settings=new art.arcane.iris.configuration.IrisSettings();
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return true;}public void reportError(String key,Throwable failure){throw new IllegalStateException(failure);}public void warnUnresolved(String key,String message){throw new IllegalStateException(message);}public void debug(String message){}});resolver.getAir();
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            IrisPlatforms.bind((IrisPlatform)Proxy.newProxyInstance(IrisPlatform.class.getClassLoader(),new Class<?>[]{IrisPlatform.class},(self,method,values)->switch(method.getName()){case"platformName"->"native-object-reference";case"minecraftVersion"->"26.3";case"registries"->registries;case"log","msg"->null;case"reportError"->throw new IllegalStateException(Arrays.toString(values));default->throw new UnsupportedOperationException(method.toString());}));
            var data=art.arcane.iris.pack.loading.IrisData.openDatapackCompiler(Path.of(args[0]).toFile());
            var biome=data.getBiomeLoader().load("ledges");if(biome==null)throw new IllegalStateException("Native biome is missing");
            var groups=biome.getProceduralObjects();JsonArray results=new JsonArray();
            for(int index=0;index<groups.getRuins().size();index++){
                var placement=groups.getRuins().get(index);var pool=placement.getVariantObjects(data);if(pool.size()!=1)throw new IllegalStateException("Expected one native variant");var object=pool.get(0);
                int[] min={Integer.MAX_VALUE,Integer.MAX_VALUE,Integer.MAX_VALUE},max={Integer.MIN_VALUE,Integer.MIN_VALUE,Integer.MIN_VALUE};JsonArray probes=new JsonArray();Set<String> seen=new HashSet<>();
                for(var entry:object.getBlocks()){
                    var point=entry.getKey();int[] xyz={point.getBlockX(),point.getBlockY(),point.getBlockZ()};for(int axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],xyz[axis]);max[axis]=Math.max(max[axis],xyz[axis]);}
                    if(probes.size()<3&&seen.add(entry.getValue().materialKey())){JsonArray probe=new JsonArray();for(int value:xyz)probe.add(value);probe.add(entry.getValue().key());probes.add(probe);}
                }
                JsonObject result=new JsonObject();result.addProperty("index",index);result.addProperty("form",placement.getForm().name());result.addProperty("seed",Long.toString(placement.getSeed()));result.addProperty("key",object.getLoadKey());result.addProperty("blockCount",object.getBlocks().size());result.add("origin",new Gson().toJsonTree(min));result.add("size",new Gson().toJsonTree(new int[]{max[0]-min[0]+1,max[1]-min[1]+1,max[2]-min[2]+1}));result.add("probes",probes);results.add(result);
            }
            Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(results));
        }
    }
}
