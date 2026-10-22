// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.*;
import net.minecraft.world.level.block.state.properties.Property;
import java.nio.file.*;
public final class MinecraftFaceCheck {
 @SuppressWarnings({"rawtypes","unchecked"})static BlockState state(JsonObject block){var state=BuiltInRegistries.BLOCK.getValue(net.minecraft.resources.Identifier.parse(block.get("id").getAsString())).defaultBlockState();if(block.has("properties"))for(var entry:block.getAsJsonObject("properties").entrySet()){Property p=state.getBlock().getStateDefinition().getProperty(entry.getKey());state=(BlockState)state.setValue(p,(Comparable)p.getValue(entry.getValue().getAsString()).orElseThrow());}return state;}
 @SuppressWarnings({"rawtypes","unchecked"})static JsonObject block(BlockState state){var out=new JsonObject();out.addProperty("id",BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString());var props=new JsonObject();for(Property p:state.getProperties())props.addProperty(p.getName(),p.getName(state.getValue(p)));out.add("properties",props);return out;}
 public static void main(String[] args)throws Exception{
  net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();var output=new JsonArray();
  for(var value:JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray()){var request=value.getAsJsonObject();var state=state(request.getAsJsonObject("block"));var neighbor=state(request.getAsJsonObject("neighbor"));LeavesBlock.setCutoutLeaves(!request.has("cutoutLeaves")||request.get("cutoutLeaves").getAsBoolean());var row=new JsonObject();row.add("block",block(state));row.add("neighbor",block(neighbor));row.addProperty("render",Block.shouldRenderFace(state,neighbor,Direction.byName(request.get("direction").getAsString())));output.add(row);}LeavesBlock.setCutoutLeaves(true);Files.writeString(Path.of(args[1]),new Gson().toJson(output)+"\n");
 }
}
