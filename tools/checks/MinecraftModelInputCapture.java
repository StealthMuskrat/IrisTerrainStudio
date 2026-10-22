// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import com.mojang.math.Quadrant;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.client.renderer.block.dispatch.*;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.BlockBehaviour;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;

/** One method-owner classification per block type and finite rotation tables; no state sweep. */
public final class MinecraftModelInputCapture {
    static JsonArray values(float... values){var row=new JsonArray();for(float value:values)row.add(Integer.toUnsignedString(Float.floatToRawIntBits(value),16));return row;}
    static float offsetLimit(Block block,String name)throws Exception{Class<?> owner=block.getClass();while(owner!=null){try{var method=owner.getDeclaredMethod(name);method.setAccessible(true);return(float)method.invoke(block);}catch(NoSuchMethodException e){owner=owner.getSuperclass();}}throw new IllegalStateException("Missing offset limit "+name);}
    public static void main(String[] args)throws Exception{
        net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();
        var out=new JsonObject();out.addProperty("formatVersion",1);out.addProperty("minecraftVersion","26.3");out.addProperty("clientSha256",args[1]);
        var rotations=new JsonObject();var aliases=new JsonObject();int rotationApplications=0;
        for(var x:Quadrant.values())for(var y:Quadrant.values())for(var z:Quadrant.values()){
            var group=Quadrant.fromXYZAngles(x,y,z);String name=group.getSerializedName();aliases.addProperty((x.shift*90)+","+(y.shift*90)+","+(z.shift*90),name);
            if(rotations.has(name))continue;var state=BlockModelRotation.get(group);var matrix=state.transformation().getMatrix();var row=new JsonObject();row.add("matrix",values(matrix.m00(),matrix.m01(),matrix.m02(),matrix.m10(),matrix.m11(),matrix.m12(),matrix.m20(),matrix.m21(),matrix.m22()));var faces=new JsonObject();
            for(var direction:Direction.values()){var uv=state.withUvLock().inverseFaceTransformation(direction);faces.add(direction.getSerializedName(),values(uv.m00(),uv.m10(),uv.m30(),uv.m01(),uv.m11(),uv.m31()));rotationApplications++;}row.add("inverseUv",faces);rotations.add(name,row);
        }
        out.add("rotations",rotations);out.add("aliases",aliases);out.addProperty("capturedFaceMappings",rotationApplications);
        var builderOffset=BlockBehaviour.Properties.class.getDeclaredField("offsetFunction");builderOffset.setAccessible(true);var xz=builderOffset.get(BlockBehaviour.Properties.of().offsetType(BlockBehaviour.OffsetType.XZ)).getClass();var xyz=builderOffset.get(BlockBehaviour.Properties.of().offsetType(BlockBehaviour.OffsetType.XYZ)).getClass();var stateOffset=BlockBehaviour.BlockStateBase.class.getDeclaredField("offsetFunction");stateOffset.setAccessible(true);var offsets=new JsonObject();
        var rules=new JsonObject();var blockTypes=new TreeSet<String>();int types=0;for(var block:BuiltInRegistries.BLOCK){types++;String blockId=BuiltInRegistries.BLOCK.getKey(block).toString();blockTypes.add(blockId);var offset=stateOffset.get(block.defaultBlockState());if(offset!=null){String kind=offset.getClass()==xz?"xz":offset.getClass()==xyz?"xyz":null;if(kind==null)throw new IllegalStateException("Unadapted block offset function "+blockId);var profile=new JsonObject();profile.addProperty("kind",kind);profile.addProperty("horizontal",Integer.toUnsignedString(Float.floatToRawIntBits(offsetLimit(block,"getMaxHorizontalOffset")),16));profile.addProperty("vertical",Integer.toUnsignedString(Float.floatToRawIntBits(offsetLimit(block,"getMaxVerticalOffset")),16));offsets.add(blockId,profile);}Class<?> owner=block.getClass();while(owner!=null){try{owner.getDeclaredMethod("getSeed",BlockState.class,BlockPos.class);break;}catch(NoSuchMethodException e){owner=owner.getSuperclass();}}if(owner==null)throw new IllegalStateException("Missing native visual seed method");String rule=switch(owner.getName()){case "net.minecraft.world.level.block.state.BlockBehaviour"->"position";case "net.minecraft.world.level.block.DoorBlock","net.minecraft.world.level.block.DoublePlantBlock"->"lower-half";case "net.minecraft.world.level.block.AbstractBedBlock"->"bed-source";default->throw new IllegalStateException("Unadapted visual seed owner "+owner.getName());};if(!rule.equals("position"))rules.addProperty(BuiltInRegistries.BLOCK.getKey(block).toString(),rule);}
        out.add("modelOffsets",offsets);out.addProperty("defaultStateOffsetMetadataReads",types);out.addProperty("offsetCellsEvaluated",0);out.addProperty("classifiedBlockTypes",types);out.addProperty("defaultSeedRule","position");out.add("seedRules",rules);out.add("blockTypes",new Gson().toJsonTree(blockTypes));
        Files.writeString(Path.of(args[0]),new GsonBuilder().setPrettyPrinting().create().toJson(out)+"\n");
    }
}
