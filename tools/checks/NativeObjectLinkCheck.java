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

/** Tiny native-written fixture and native file-reader oracle, no terrain generation. */
public final class NativeObjectLinkCheck {
    public static void main(String[] args)throws Exception{
        art.arcane.iris.configuration.IrisSettings.settings=new art.arcane.iris.configuration.IrisSettings();
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return true;}public void reportError(String key,Throwable failure){throw new IllegalStateException(failure);}public void warnUnresolved(String key,String message){throw new IllegalStateException(message);}public void debug(String message){}});resolver.getAir();
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            IrisPlatforms.bind((IrisPlatform)Proxy.newProxyInstance(IrisPlatform.class.getClassLoader(),new Class<?>[]{IrisPlatform.class},(self,method,values)->switch(method.getName()){case"platformName"->"native-object-reference";case"minecraftVersion"->"26.3";case"registries"->registries;case"log","msg"->null;case"reportError"->throw new IllegalStateException(Arrays.toString(values));default->throw new UnsupportedOperationException(method.toString());}));
            IrisObject object=new IrisObject(3,3,3);
            object.getBlocks().put(new IrisBlockVector(-1,0,0),resolver.get("minecraft:stone"));
            object.getBlocks().put(new IrisBlockVector(1,1,0),resolver.get("minecraft:oak_stairs[facing=east,half=top,shape=straight,waterlogged=false]"));
            object.getBlocks().put(new IrisBlockVector(0,0,0),resolver.get("minecraft:structure_void"));
            Path binary=Path.of(args[0]);try(var out=Files.newOutputStream(binary)){object.write(out);}
            IrisObject read=new IrisObject(0,0,0);read.read(binary.toFile());
            JsonObject result=new JsonObject();result.add("dimensions",new Gson().toJsonTree(List.of(read.getW(),read.getH(),read.getD())));result.addProperty("blockCount",read.getBlocks().size());JsonArray blocks=new JsonArray();for(var entry:read.getBlocks()){var point=entry.getKey();JsonArray block=new JsonArray();block.add(point.getBlockX());block.add(point.getBlockY());block.add(point.getBlockZ());block.add(entry.getValue().key());blocks.add(block);}result.add("blocks",blocks);
            result.add("paletteKeys",new Gson().toJsonTree(IrisObjectIO.readPaletteKeysCached(binary.toFile())));
            object.getBlocks().put(new IrisBlockVector(-1,0,0),resolver.get("minecraft:glass"));try(var out=Files.newOutputStream(binary.resolveSibling("changed.iob"))){object.write(out);}
            Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(result));
        }
    }
}
