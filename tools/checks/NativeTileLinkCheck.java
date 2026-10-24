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

/** One native-written modern tile envelope and the original object reader; no world execution. */
public final class NativeTileLinkCheck {
    public static void main(String[] args)throws Exception{
        art.arcane.iris.configuration.IrisSettings.settings=new art.arcane.iris.configuration.IrisSettings();
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->{throw new UnsupportedOperationException();},message->{throw new IllegalStateException(message);}));
            NativeBlockResolver resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){public ModdedBlockState resolveCustomBlock(String key){return null;}public boolean preventLeafDecay(){return true;}public void reportError(String key,Throwable failure){throw new IllegalStateException(failure);}public void warnUnresolved(String key,String message){throw new IllegalStateException(message);}public void debug(String message){}});resolver.getAir();
            PlatformRegistries registries=(PlatformRegistries)Proxy.newProxyInstance(PlatformRegistries.class.getClassLoader(),new Class<?>[]{PlatformRegistries.class},(self,method,values)->switch(method.getName()){
                case"blockOrNull"->resolver.getOrNull((String)values[0]);case"block"->resolver.get((String)values[0]);case"air"->resolver.getAir();case"decodeBlockState"->NativeBlockResolver.strictParse(((String)values[0]).trim());case"blockTypeKeys"->access.blockKeys();default->{try{yield NativeRegistryAccess.class.getMethod(method.getName(),method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException(method.toString(),failure);}}
            });
            IrisPlatforms.bind((IrisPlatform)Proxy.newProxyInstance(IrisPlatform.class.getClassLoader(),new Class<?>[]{IrisPlatform.class},(self,method,values)->switch(method.getName()){case"platformName"->"native-tile-reference";case"supportsMatterWorldIo"->false;case"minecraftVersion"->"26.3";case"registries"->registries;case"log","msg"->null;case"reportError"->throw new IllegalStateException(Arrays.toString(values));default->throw new UnsupportedOperationException(method.toString());}));
            var previousReader=art.arcane.iris.generation.block.TileData.bindPlatformReader(StubTileData::read);
            try {
                IrisObject object=new IrisObject(3,3,3);var point=new IrisBlockVector(-1,0,0);var state=resolver.get("minecraft:chest[facing=west]");
                object.getBlocks().put(point,state);object.getBlocks().put(new IrisBlockVector(1,1,0),resolver.get("minecraft:stone"));
                var properties=new art.arcane.volmlib.util.collection.KMap<String,Object>();properties.put("unknownInteger",9007199254740993L);properties.put("customText","<tile> \u2603");properties.put("nested",Map.of("values",List.of(1L,true,"preserved")));
                var tile=StubTileData.fromProperties(state,properties);object.getStates().put(point,tile);
                Path binary=Path.of(args[0]);try(var out=Files.newOutputStream(binary)){object.write(out);}
                IrisObject read=new IrisObject(0,0,0);read.read(binary.toFile());
                JsonObject result=new JsonObject();result.add("dimensions",new Gson().toJsonTree(List.of(read.getW(),read.getH(),read.getD())));result.addProperty("blockCount",read.getBlocks().size());result.addProperty("tileCount",read.getStates().size());
                var decoded=read.getStates().get(point);var payload=new java.io.ByteArrayOutputStream();decoded.toBinary(new java.io.DataOutputStream(payload));byte[] bytes=payload.toByteArray();
                try(var in=new java.io.DataInputStream(new java.io.ByteArrayInputStream(bytes))){result.addProperty("material",in.readUTF());result.addProperty("propertiesJson",in.readUTF());}
                result.addProperty("binaryBytes",bytes.length);result.addProperty("binaryBase64",Base64.getEncoder().encodeToString(bytes));result.addProperty("nativeCloneEqual",decoded.clone().equals(decoded));
                var codec=new art.arcane.iris.world.storage.matter.TileMatter(16,16,16);var node=new java.io.ByteArrayOutputStream();codec.writeNode(new art.arcane.iris.world.storage.matter.TileWrapper(decoded),new java.io.DataOutputStream(node));
                var roundTrip=codec.readNode(new java.io.DataInputStream(new java.io.ByteArrayInputStream(node.toByteArray())));result.addProperty("nativeTileMatterRoundTrip",roundTrip.getData().equals(decoded));
                result.addProperty("tileMatterNodeBase64",Base64.getEncoder().encodeToString(node.toByteArray()));
                Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(result));
            }finally{art.arcane.iris.generation.block.TileData.restorePlatformReader(previousReader);}
        }
    }
}
