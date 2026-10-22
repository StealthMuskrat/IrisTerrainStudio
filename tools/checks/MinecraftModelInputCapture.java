// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import com.mojang.math.Quadrant;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.client.renderer.block.dispatch.*;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.BlockState;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;

/** One method-owner classification per block type and finite rotation tables; no state sweep. */
public final class MinecraftModelInputCapture {
    static JsonArray values(float... values){var row=new JsonArray();for(float value:values)row.add(Integer.toUnsignedString(Float.floatToRawIntBits(value),16));return row;}
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
        var rules=new JsonObject();var blockTypes=new TreeSet<String>();int types=0;for(var block:BuiltInRegistries.BLOCK){types++;blockTypes.add(BuiltInRegistries.BLOCK.getKey(block).toString());Class<?> owner=block.getClass();while(owner!=null){try{owner.getDeclaredMethod("getSeed",BlockState.class,BlockPos.class);break;}catch(NoSuchMethodException e){owner=owner.getSuperclass();}}if(owner==null)throw new IllegalStateException("Missing native visual seed method");String rule=switch(owner.getName()){case "net.minecraft.world.level.block.state.BlockBehaviour"->"position";case "net.minecraft.world.level.block.DoorBlock","net.minecraft.world.level.block.DoublePlantBlock"->"lower-half";case "net.minecraft.world.level.block.AbstractBedBlock"->"bed-source";default->throw new IllegalStateException("Unadapted visual seed owner "+owner.getName());};if(!rule.equals("position"))rules.addProperty(BuiltInRegistries.BLOCK.getKey(block).toString(),rule);}
        out.addProperty("classifiedBlockTypes",types);out.addProperty("defaultSeedRule","position");out.add("seedRules",rules);out.add("blockTypes",new Gson().toJsonTree(blockTypes));
        Files.writeString(Path.of(args[0]),new GsonBuilder().setPrettyPrinting().create().toJson(out)+"\n");
    }
}
