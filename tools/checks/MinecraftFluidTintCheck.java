// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.color.block.*;
import net.minecraft.client.renderer.block.*;
import net.minecraft.client.renderer.chunk.ChunkSectionLayer;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import net.minecraft.client.resources.model.sprite.Material;
import net.minecraft.client.resources.model.sprite.TextureSlots;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.*;
import net.minecraft.world.level.biome.*;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.*;
import net.minecraft.world.level.block.state.properties.Property;
import net.minecraft.world.level.material.*;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;

/** Runs the original client tesselator and tint sources with controlled worlds/material carriers. */
public final class MinecraftFluidTintCheck {
    static final Gson GSON=new Gson();
    @SuppressWarnings({"rawtypes","unchecked"})static BlockState state(JsonObject block){var state=BuiltInRegistries.BLOCK.getValue(net.minecraft.resources.Identifier.parse(block.get("id").getAsString())).defaultBlockState();if(block.has("properties"))for(var entry:block.getAsJsonObject("properties").entrySet()){Property property=state.getBlock().getStateDefinition().getProperty(entry.getKey());state=(BlockState)state.setValue(property,(Comparable)property.getValue(entry.getValue().getAsString()).orElseThrow());}return state;}
    static JsonObject block(BlockState state){var out=new JsonObject();out.addProperty("id",BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString());var props=new JsonObject();for(var p:state.getProperties())props.addProperty(p.getName(),name(state,p));out.add("properties",props);return out;}
    @SuppressWarnings({"rawtypes","unchecked"})static String name(BlockState state,Property p){return p.getName(state.getValue(p));}
    static BlockPos pos(JsonArray values){return new BlockPos(values.get(0).getAsInt(),values.get(1).getAsInt(),values.get(2).getAsInt());}
    static Object unsafe()throws Exception{var f=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return f.get(null);}
    static TextureAtlasSprite sprite(float start)throws Exception{var instance=(TextureAtlasSprite)((sun.misc.Unsafe)unsafe()).allocateInstance(TextureAtlasSprite.class);for(var entry:Map.of("u0",start,"v0",start,"u1",start+.25F,"v1",start+.25F).entrySet()){var field=TextureAtlasSprite.class.getDeclaredField(entry.getKey());field.setAccessible(true);field.setFloat(instance,entry.getValue());}return instance;}
    static BlockAndTintGetter level(Map<BlockPos,BlockState> states,Biome biome,List<BlockPos> tintPositions){return(BlockAndTintGetter)Proxy.newProxyInstance(MinecraftFluidTintCheck.class.getClassLoader(),new Class<?>[]{BlockAndTintGetter.class},(self,method,args)->switch(method.getName()){
        case "getBlockState"->states.getOrDefault((BlockPos)args[0],Blocks.AIR.defaultBlockState());case "getFluidState"->states.getOrDefault((BlockPos)args[0],Blocks.AIR.defaultBlockState()).getFluidState();case "cardinalLighting"->CardinalLighting.DEFAULT;case "getBrightness","getRawBrightness","getMinY"->0;case "getHeight"->384;
        case "getBlockTint"->{var at=(BlockPos)args[0];tintPositions.add(at.immutable());yield((ColorResolver)args[1]).getColor(biome,at.getX(),at.getZ());}
        default->throw new UnsupportedOperationException(method.toString());});}
    static Biome biome(JsonObject json){return new Biome.BiomeBuilder().temperature(json.get("temperature").getAsFloat()).downfall(json.get("downfall").getAsFloat()).specialEffects(BiomeSpecialEffects.CODEC.parse(com.mojang.serialization.JsonOps.INSTANCE,json.get("effects")).getOrThrow()).generationSettings(BiomeGenerationSettings.EMPTY).build();}
    static int[] map(int salt){int[] colors=new int[65536];for(int i=0;i<colors.length;i++)colors[i]=0xff000000|((i&255)<<16)|((i>>8)<<8)|((i*salt)&255);return colors;}
    public static void main(String[] args)throws Exception{
        net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();GrassColor.init(map(17));FoliageColor.init(map(29));DryFoliageColor.init(map(41));
        var input=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();var metadata=JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonObject();var out=new JsonObject();var materials=new ArrayList<Material.Baked>();for(float offset:new float[]{0,.25F,.5F})materials.add(new Material.Baked(sprite(offset),false));
        var water=new FluidModel(ChunkSectionLayer.TRANSLUCENT,materials.get(0),materials.get(1),materials.get(2),BlockTintSources.water());var lava=new FluidModel(ChunkSectionLayer.SOLID,materials.get(0),materials.get(1),null,null);var renderer=new FluidRenderer(new FluidStateModelSet(Map.of(Fluids.WATER,water,Fluids.FLOWING_WATER,water,Fluids.LAVA,lava,Fluids.FLOWING_LAVA,lava),lava));
        var fluids=new JsonArray();for(var value:input.getAsJsonArray("fluids")){var request=value.getAsJsonObject();var at=pos(request.getAsJsonArray("position"));var states=new HashMap<BlockPos,BlockState>();var self=state(request.getAsJsonObject("block"));states.put(at,self);var neighbors=new JsonArray();for(var item:request.getAsJsonArray("neighbors")){var n=item.getAsJsonObject();var nstate=state(n.getAsJsonObject("block"));var delta=pos(n.getAsJsonArray("at"));states.put(at.offset(delta),nstate);var resolved=new JsonObject();resolved.add("at",n.get("at"));resolved.add("block",block(nstate));neighbors.add(resolved);}
            var level=level(states,biome(metadata.getAsJsonObject("biomes").getAsJsonObject("minecraft:plains")),new ArrayList<>());var vertices=new JsonArray();var builder=(VertexConsumer)Proxy.newProxyInstance(MinecraftFluidTintCheck.class.getClassLoader(),new Class<?>[]{VertexConsumer.class},(proxy,method,params)->{if(method.getName().equals("addVertex")&&params.length==11){var v=new JsonArray();for(int index:new int[]{0,1,2,4,5})v.add((Float)params[index]);vertices.add(v);return null;}throw new UnsupportedOperationException(method.toString());});renderer.tesselate(level,at,layer->builder,self,self.getFluidState());var flow=self.getFluidState().getFlow(level,at);var row=new JsonObject();row.addProperty("name",request.get("name").getAsString());row.add("position",request.get("position"));row.add("block",block(self));row.add("neighbors",neighbors);row.add("vertices",vertices);row.add("flow",GSON.toJsonTree(new double[]{flow.x,flow.y,flow.z}));fluids.add(row);
        }out.add("fluids",fluids);
        var tints=new JsonArray();var colors=BlockColors.createDefault();for(var value:input.getAsJsonArray("tints")){var request=value.getAsJsonObject();var state=state(request.getAsJsonObject("block"));var positions=new ArrayList<BlockPos>();var at=pos(request.getAsJsonArray("position"));var level=level(Map.of(at,state),biome(metadata.getAsJsonObject("biomes").getAsJsonObject(request.get("biome").getAsString())),positions);var source=colors.getTintSource(state,request.get("layer").getAsInt());int color=source==null?-1:source.colorInWorld(state,level,at);var row=new JsonObject();row.add("block",block(state));row.addProperty("color",Integer.toUnsignedLong(color));row.add("samplePositions",GSON.toJsonTree(positions.stream().map(p->new int[]{p.getX(),p.getY(),p.getZ()}).toList()));tints.add(row);}out.add("tints",tints);
        var materialResults=new JsonArray();for(var value:input.getAsJsonArray("materials")){var request=value.getAsJsonObject();var resolver=new TextureSlots.Resolver();for(var layer:request.getAsJsonArray("layers"))resolver.addLast(TextureSlots.parseTextureMap(layer.getAsJsonObject()));var material=resolver.resolve(()->"Authored material check").getMaterial(request.get("slot").getAsString());var row=new JsonObject();row.addProperty("sprite",material.sprite().toString());row.addProperty("forceTranslucent",material.forceTranslucent());materialResults.add(row);}out.add("materials",materialResults);
        Files.writeString(Path.of(args[2]),GSON.toJson(out)+"\n");
    }
}
