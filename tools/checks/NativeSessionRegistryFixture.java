// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockProperties;
import com.google.gson.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.block.*;
import java.nio.file.*;
import java.util.*;

/** TEST ONLY: a few native block types for the small oak/cache fixture. Never a production registry export. */
public final class NativeSessionRegistryFixture {
    public static void main(String[] args)throws Exception{
        Path output=Path.of(args[0]);Files.createDirectories(output);NativeRegistryExport.main(new String[]{output.resolve("platform.json").toString()});Gson gson=new Gson();JsonObject platform=JsonParser.parseString(Files.readString(output.resolve("platform.json"))).getAsJsonObject();
        List<Block> blocks=List.of(Blocks.AIR,Blocks.CAVE_AIR,Blocks.VOID_AIR,Blocks.STONE,Blocks.BEDROCK,Blocks.GRASS_BLOCK,Blocks.DIRT,Blocks.OAK_LOG,Blocks.OAK_LEAVES,Blocks.WATER,Blocks.LAVA,Blocks.SNOW,Blocks.SNOW_BLOCK,Blocks.COBWEB,Blocks.DEEPSLATE,Blocks.SAND,Blocks.CLAY).stream().sorted(Comparator.comparing(block->BuiltInRegistries.BLOCK.getKey(block).toString())).toList();
        JsonObject wire=new JsonObject();wire.addProperty("formatVersion",2);wire.addProperty("scope","native-browser-registry-input");wire.addProperty("minecraft","26.3");wire.addProperty("fixtureInput",true);
        wire.add("flagNames",gson.toJsonTree(List.of("isAir","isSolid","isOccluding","isFluid","isWater","isWaterLogged","isLit","isUpdatable","isFoliage","isTreeBlock","isFoliagePlantable","isDecorant","isStorage","isStorageChest","isOre","isDeepSlate","isVineBlock","hasTileEntity")));wire.add("faceNames",gson.toJsonTree(List.of("north","east","south","west","up","down")));
        JsonArray types=new JsonArray(),states=new JsonArray(),names=new JsonArray();JsonObject assignments=new JsonObject(),deep=new JsonObject(),normal=new JsonObject();
        for(int index=0;index<blocks.size();index++){
            Block block=blocks.get(index);String name=BuiltInRegistries.BLOCK.getKey(block).toString();names.add(name);JsonObject type=new JsonObject();type.addProperty("name",name);type.addProperty("leaf",block instanceof LeavesBlock);JsonArray order=new JsonArray();block.defaultBlockState().getValues().forEach(value->order.add(value.property().getName()));type.add("order",order);
            for(var state:block.getStateDefinition().getPossibleStates()){int id=states.size();JsonObject row=new JsonObject();row.addProperty("id",id);row.addProperty("nativeId",Block.BLOCK_STATE_REGISTRY.getId(state));row.addProperty("type",index);row.addProperty("key",NativeStateExport.key(state));row.addProperty("flags",NativeStateExport.flags(state));row.addProperty("faces",NativeStateExport.faces(state));JsonArray values=new JsonArray();state.getValues().forEach(value->values.add(value.valueName()));row.add("values",values);states.add(row);if(state==block.defaultBlockState())type.addProperty("defaultState",id);}
            types.add(type);assignments.add(name,platform.getAsJsonObject("blockPropertyGroups").get(name));
            var base=block.defaultBlockState();var mapped=NativeBlockProperties.toDeepSlateOre(Blocks.DEEPSLATE.defaultBlockState(),base);if(mapped!=base)deep.addProperty(name,NativeStateExport.key(mapped));mapped=NativeBlockProperties.toDeepSlateOre(Blocks.STONE.defaultBlockState(),base);if(mapped!=base)normal.addProperty(name,NativeStateExport.key(mapped));
        }
        byte[] placement=new byte[(blocks.size()*blocks.size()+7)/8];for(int i=0;i<blocks.size();i++)for(int j=0;j<blocks.size();j++)if(NativeBlockProperties.canPlaceOnto(blocks.get(i),blocks.get(j))){int bit=i*blocks.size()+j;placement[bit>>>3]|=(byte)(1<<(bit&7));}
        JsonObject keys=platform.getAsJsonObject("keys").deepCopy();keys.add("blocks",names);wire.add("types",types);wire.add("states",states);wire.addProperty("placementBits",Base64.getEncoder().encodeToString(placement));wire.add("toDeepSlate",deep);wire.add("toNormalOre",normal);wire.add("keys",keys);wire.add("propertyGroups",platform.get("propertyGroups"));wire.add("blockPropertyGroups",assignments);wire.add("entityCategories",platform.get("entityCategories"));Files.writeString(output.resolve("browser-registry.json"),gson.toJson(wire)+"\n");System.out.println("Test-only native registry fixture: "+blocks.size()+" types, "+states.size()+" states, "+blocks.size()*blocks.size()+" placement pairs.");
    }
}
