// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockProperties;
import com.google.gson.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.tags.BlockTags;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.EmptyBlockGetter;
import net.minecraft.world.level.block.SupportType;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import java.nio.file.*;
import java.util.*;

/** Export actual pinned native predicates; no block-name classification guesses. */
public final class NativeStateExport {
    private static final String[] FLAGS={"isAir","isSolid","isOccluding","isFluid","isWater","isWaterLogged","isLit","isUpdatable","isFoliage","isTreeBlock","isFoliagePlantable","isDecorant","isStorage","isStorageChest","isOre","isDeepSlate","isVineBlock","hasTileEntity"};
    static int flags(BlockState state){
        boolean[] values={NativeBlockProperties.isAir(state),NativeBlockProperties.isSolid(state),NativeBlockProperties.isOccluding(state),NativeBlockProperties.isFluid(state),NativeBlockProperties.isWater(state),NativeBlockProperties.isWaterLogged(state),NativeBlockProperties.isLit(state),NativeBlockProperties.isUpdatable(state),NativeBlockProperties.isFoliage(state),state.is(BlockTags.LOGS)||state.is(BlockTags.LEAVES),NativeBlockProperties.isFoliagePlantable(state),NativeBlockProperties.isDecorant(state),NativeBlockProperties.isStorage(state),NativeBlockProperties.isStorageChest(state),NativeBlockProperties.isOre(state),NativeBlockProperties.isDeepSlate(state),NativeBlockProperties.isVineBlock(state),NativeBlockProperties.hasTileEntity(state)};
        int bits=0;for(int i=0;i<values.length;i++)if(values[i])bits|=1<<i;return bits;
    }
    private static final Direction[] FACES={Direction.NORTH,Direction.EAST,Direction.SOUTH,Direction.WEST,Direction.UP,Direction.DOWN};
    static int faces(BlockState state){int bits=0;for(int i=0;i<FACES.length;i++)if(state.isFaceSturdy(EmptyBlockGetter.INSTANCE,BlockPos.ZERO,FACES[i],SupportType.FULL))bits|=1<<i;return bits;}
    static String key(BlockState state){
        StringBuilder result=new StringBuilder(BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString());
        if(!state.isSingletonState())result.append('[').append(state.getValues().map(value->value.property().getName()+"="+value.valueName()).collect(java.util.stream.Collectors.joining(","))).append(']');
        return result.toString();
    }
    public static void main(String[] args)throws Exception{
        HeadlessNativeBootstrap.initialize();
        List<Block> blocks=new ArrayList<>();BuiltInRegistries.BLOCK.forEach(blocks::add);blocks.sort(Comparator.comparing(block->BuiltInRegistries.BLOCK.getKey(block).toString()));
        int count=blocks.size(),states=Block.BLOCK_STATE_REGISTRY.size();int[] stateFlags=new int[states],faceSupport=new int[states],stateTypes=new int[states];Arrays.fill(stateTypes,-1);JsonArray types=new JsonArray();JsonObject orders=new JsonObject(),deep=new JsonObject(),normal=new JsonObject();
        NativePlacementGroups.Result placement=NativePlacementGroups.capture(blocks,Path.of(args[1]));
        for(int i=0;i<count;i++){
            Block block=blocks.get(i);String name=BuiltInRegistries.BLOCK.getKey(block).toString();types.add(name);
            JsonArray order=new JsonArray();block.defaultBlockState().getValues().forEach(value->order.add(value.property().getName()));orders.add(name,order);
            for(BlockState state:block.getStateDefinition().getPossibleStates()){
                int id=Block.BLOCK_STATE_REGISTRY.getId(state);if(id<0||id>=states||stateTypes[id]!=-1)throw new IllegalStateException("Invalid native state identity");stateTypes[id]=i;stateFlags[id]=flags(state);faceSupport[id]=faces(state);
            }
            BlockState ore=block.defaultBlockState(),mapped=NativeBlockProperties.toDeepSlateOre(Blocks.DEEPSLATE.defaultBlockState(),ore);if(mapped!=ore)deep.addProperty(name,key(mapped));
            mapped=NativeBlockProperties.toDeepSlateOre(Blocks.STONE.defaultBlockState(),ore);if(mapped!=ore)normal.addProperty(name,key(mapped));
        }
        for(int type:stateTypes)if(type<0)throw new IllegalStateException("Incomplete native state coverage");
        JsonObject result=new JsonObject();result.addProperty("formatVersion",1);result.addProperty("scope","pinned-native-block-predicates");result.addProperty("minecraft","26.3");result.add("flagNames",new Gson().toJsonTree(FLAGS));result.add("blockTypes",types);result.add("stateFlags",new Gson().toJsonTree(stateFlags));result.add("faceNames",new Gson().toJsonTree(new String[]{"north","east","south","west","up","down"}));result.add("faceSupport",new Gson().toJsonTree(faceSupport));result.add("stateTypes",new Gson().toJsonTree(stateTypes));result.add("propertyOrder",orders);result.add("toDeepSlate",deep);result.add("toNormalOre",normal);result.addProperty("placementBits",Base64.getEncoder().encodeToString(placement.bits()));result.addProperty("allowedPlacementPairs",placement.allowed());
        JsonObject admission=new JsonObject();admission.addProperty("method","pinned-native-input-equivalence-v1");admission.addProperty("sourceSha256",placement.sourceSha256());admission.addProperty("groups",placement.groups());admission.addProperty("nativeEvaluations",placement.evaluations());admission.addProperty("expandedPairs",(long)count*count);result.add("placementCapture",admission);
        Path target=Path.of(args[0]);Files.createDirectories(target.getParent());Files.writeString(target,new Gson().toJson(result)+"\n");System.out.println("Exported "+states+" native state predicates and "+placement.allowed()+" allowed material placement pairs using "+placement.evaluations()+" native evaluations in "+placement.groups()+" groups.");
    }
}
