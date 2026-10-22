// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import com.mojang.math.Quadrant;
import net.minecraft.client.renderer.block.dispatch.*;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.block.state.*;
import net.minecraft.world.level.block.state.properties.Property;
import net.minecraft.util.*;
import net.minecraft.util.random.WeightedList;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;
import org.joml.Vector3f;

/** Original client rotation/UV matrices, per-state seeds and real weighted/multipart collection. */
public final class MinecraftModelCheck {
    static final Map<BlockStateModelPart,String> IDS=new IdentityHashMap<>();
    static BlockStateModel model(JsonObject group,int groupIndex){
        var models=new ArrayList<BlockStateModel>();int index=0;
        for(var weight:group.getAsJsonArray("weights")){String id=groupIndex+":"+index++;var part=(BlockStateModelPart)Proxy.newProxyInstance(MinecraftModelCheck.class.getClassLoader(),new Class<?>[]{BlockStateModelPart.class},(self,method,args)->switch(method.getName()){case "toString"->id;case "hashCode"->System.identityHashCode(self);case "equals"->self==args[0];default->throw new UnsupportedOperationException(method.toString());});IDS.put(part,id);models.add(new BlockStateModel(){public void collectParts(RandomSource random,List<BlockStateModelPart> output){output.add(part);}public net.minecraft.client.resources.model.sprite.Material.Baked particleMaterial(){return null;}public int materialFlags(){return 0;}});}
        if(!group.get("weighted").getAsBoolean())return models.getFirst();var builder=WeightedList.<BlockStateModel>builder();index=0;for(var weight:group.getAsJsonArray("weights"))builder.add(models.get(index++),weight.getAsInt());return new WeightedVariants(builder.build());
    }
    @SuppressWarnings({"rawtypes","unchecked"})static BlockState state(JsonObject block){var state=BuiltInRegistries.BLOCK.getValue(net.minecraft.resources.Identifier.parse(block.get("id").getAsString())).defaultBlockState();if(block.has("properties"))for(var entry:block.getAsJsonObject("properties").entrySet()){Property property=state.getBlock().getStateDefinition().getProperty(entry.getKey());if(property==null)throw new IllegalArgumentException("Missing native property "+entry.getKey());state=(BlockState)state.setValue(property,(Comparable)property.getValue(entry.getValue().getAsString()).orElseThrow());}return state;}
    public static void main(String[] args)throws Exception{
        net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();var input=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();var out=new JsonObject();var transformed=new JsonArray();
        for(var value:input.getAsJsonArray("transforms")){var request=value.getAsJsonObject();var group=Quadrant.fromXYZAngles(Quadrant.parseJson(request.get("x").getAsInt()),Quadrant.parseJson(request.get("y").getAsInt()),Quadrant.parseJson(request.get("z").getAsInt()));var rotation=BlockModelRotation.get(group);var face=Direction.byName(request.get("face").getAsString());var row=new JsonObject();var uv=request.getAsJsonArray("uv");var vector=rotation.withUvLock().inverseFaceTransformation(face).transformPosition(new Vector3f(uv.get(0).getAsFloat()/16.0F-.5F,uv.get(1).getAsFloat()/16.0F-.5F,0));var result=new JsonArray();result.add(vector.x+.5F);result.add(vector.y+.5F);row.add("uv",result);var point=request.getAsJsonArray("point");var position=rotation.transformation().getMatrix().transformPosition(new Vector3f(point.get(0).getAsFloat()-.5F,point.get(1).getAsFloat()-.5F,point.get(2).getAsFloat()-.5F));var p=new JsonArray();p.add(position.x+.5F);p.add(position.y+.5F);p.add(position.z+.5F);row.add("point",p);transformed.add(row);}out.add("transforms",transformed);
        var conditions=new JsonArray();for(var value:input.getAsJsonArray("conditions")){var request=value.getAsJsonObject();var nativeState=state(request.getAsJsonObject("block"));var condition=net.minecraft.client.renderer.block.dispatch.multipart.KeyValueCondition.CODEC.parse(com.mojang.serialization.JsonOps.INSTANCE,request.get("when")).getOrThrow();conditions.add(condition.instantiate(nativeState.getBlock().getStateDefinition()).test(nativeState));}out.add("conditions",conditions);
        var offsets=new JsonArray();for(var value:input.getAsJsonArray("offsets")){var request=value.getAsJsonObject();var nativeState=state(request.getAsJsonObject("block"));var point=request.getAsJsonArray("position");var offset=nativeState.getOffset(new BlockPos(point.get(0).getAsInt(),point.get(1).getAsInt(),point.get(2).getAsInt()));var row=new JsonArray();row.add(offset.x);row.add(offset.y);row.add(offset.z);offsets.add(row);}out.add("offsets",offsets);
        var selections=new JsonArray();for(var value:input.getAsJsonArray("selections")){var request=value.getAsJsonObject();var block=request.getAsJsonObject("block");var nativeState=state(block);var point=request.getAsJsonArray("position");long seed=nativeState.getSeed(new BlockPos(point.get(0).getAsInt(),point.get(1).getAsInt(),point.get(2).getAsInt()));var groups=new ArrayList<BlockStateModel>();int index=0;for(var group:request.getAsJsonArray("groups"))groups.add(model(group.getAsJsonObject(),index++));BlockStateModel selected;
            if(request.get("multipart").getAsBoolean()){
                var shared=Class.forName("net.minecraft.client.renderer.block.dispatch.multipart.MultiPartModel$SharedBakedState");var selectorType=Class.forName("net.minecraft.client.renderer.block.dispatch.multipart.MultiPartModel$Selector");var selectors=new ArrayList<Object>();var selector=selectorType.getDeclaredConstructor(java.util.function.Predicate.class,Object.class);selector.setAccessible(true);for(var model:groups)selectors.add(selector.newInstance((java.util.function.Predicate<BlockState>)s->true,model));var constructor=shared.getDeclaredConstructor(List.class);constructor.setAccessible(true);var source=constructor.newInstance(selectors);var type=Class.forName("net.minecraft.client.renderer.block.dispatch.multipart.MultiPartModel");var create=type.getDeclaredConstructor(shared,BlockState.class);create.setAccessible(true);selected=(BlockStateModel)create.newInstance(source,nativeState);
            }else selected=groups.getFirst();var random=RandomSource.createThreadLocalInstance(0);random.setSeed(seed);var parts=new ArrayList<BlockStateModelPart>();selected.collectParts(random,parts);var row=new JsonObject();row.addProperty("seed",Long.toString(seed));row.add("parts",new Gson().toJsonTree(parts.stream().map(IDS::get).toList()));selections.add(row);
        }out.add("selections",selections);Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(out)+"\n");
    }
}
