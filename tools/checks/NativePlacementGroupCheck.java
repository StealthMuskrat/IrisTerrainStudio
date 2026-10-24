// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockProperties;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.block.Block;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;

/** Twenty selected branch probes, not an exhaustive placement-pair comparison. */
public final class NativePlacementGroupCheck {
    public static void main(String[] args)throws Exception{
        HeadlessNativeBootstrap.initialize();List<Block> blocks=new ArrayList<>();BuiltInRegistries.BLOCK.forEach(blocks::add);
        blocks.sort(Comparator.comparing(block->BuiltInRegistries.BLOCK.getKey(block).toString()));
        var result=NativePlacementGroups.capture(blocks,Path.of(args[0]));
        String[][] pairs={{"sugar_cane","sand"},{"sugar_cane","stone"},{"cactus","red_sand"},{"cactus","grass_block"},{"crimson_fungus","crimson_nylium"},{"warped_roots","soul_soil"},{"poppy","grass_block"},{"poppy","stone"},{"stone","air"},{"stone","cave_air"},{"dead_bush","grass_block"},{"dead_bush","dirt"},{"torch","dirt_path"},{"stone","dirt_path"},{"poppy","oak_leaves"},{"granite","birch_leaves"},{"diamond_block","glass"},{"grass_block","stone"},{"red_mushroom","sand"},{"warped_fungus","warped_nylium"}};
        JsonArray probes=new JsonArray();
        for(String[] pair:pairs){
            Block material=BuiltInRegistries.BLOCK.getValue(Identifier.parse("minecraft:"+pair[0])),onto=BuiltInRegistries.BLOCK.getValue(Identifier.parse("minecraft:"+pair[1]));
            int from=blocks.indexOf(material),to=blocks.indexOf(onto);if(from<0||to<0)throw new AssertionError("Missing probe block");int bit=from*blocks.size()+to;
            boolean grouped=(result.bits()[bit>>>3]&(1<<(bit&7)))!=0,nativeValue=NativeBlockProperties.canPlaceOnto(material,onto);
            if(grouped!=nativeValue)throw new AssertionError("Placement differs: "+Arrays.toString(pair));
            JsonObject probe=new JsonObject();probe.addProperty("material",pair[0]);probe.addProperty("onto",pair[1]);probe.addProperty("allowed",nativeValue);probes.add(probe);
        }
        Path changed=Path.of(args[1]+".changed-source");
        try{
            Files.writeString(changed,Files.readString(Path.of(args[0]))+"\n");boolean refused=false;
            try{NativePlacementGroups.capture(blocks,changed);}catch(IllegalStateException expected){refused=true;}
            if(!refused)throw new AssertionError("Changed placement source was admitted");
        }finally{Files.deleteIfExists(changed);}
        JsonObject report=new JsonObject();report.addProperty("scope","native-placement-grouping-targeted");report.addProperty("result","pass");report.addProperty("sourceSha256",result.sourceSha256());report.addProperty("blockTypes",blocks.size());report.addProperty("groups",result.groups());report.addProperty("nativeEvaluations",result.evaluations());report.addProperty("expandedPairs",(long)blocks.size()*blocks.size());report.addProperty("allowedPairs",result.allowed());report.addProperty("changedSourceRefused",true);report.add("selectedProbes",probes);report.addProperty("exhaustiveComparison",false);
        Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(report)+"\n");
        System.out.println("Placement grouping passed: "+pairs.length+" selected native probes, "+result.groups()+" input groups and "+result.evaluations()+" native capture calls; no full pair comparison.");
    }
}
