// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.pack.loading.IrisRegistrant;
import art.arcane.iris.generation.biome.IrisBiome;
import art.arcane.iris.generation.terrain.IrisRegion;
import art.arcane.iris.generation.decoration.*;
import art.arcane.iris.generation.decoration.tree.IrisProceduralTree;
import art.arcane.iris.generation.decoration.formation.IrisFormation;
import art.arcane.iris.generation.decoration.coral.IrisCoral;
import art.arcane.iris.generation.decoration.fungus.IrisFungus;
import art.arcane.iris.generation.decoration.crystal.IrisCrystal;
import art.arcane.iris.structure.object.IrisObject;
import com.google.gson.stream.JsonWriter;
import studio.engine.pack.MemoryPack;
import java.io.*;
import java.util.*;

/** Isolated native baked variants; no invented placement terrain or chunk parity claim. */
public final class ProceduralPreview {
    private static final String[] FAMILIES={"trees","formations","coral","fungi","crystals"};
    private static IrisProceduralObjects settings(IrisRegistrant resource){
        if(resource instanceof IrisBiome biome)return biome.getProceduralObjects();
        if(resource instanceof IrisRegion region)return region.getProceduralObjects();
        throw new IllegalArgumentException("Procedural previews require a native biome or region");
    }
    private static List<? extends IrisProceduralPlacement> family(IrisProceduralObjects settings,String family){
        if(settings==null)return List.of();
        return switch(family){case"trees"->settings.getTrees();case"formations"->settings.getFormations();case"coral"->settings.getCoral();case"fungi"->settings.getFungi();case"crystals"->settings.getCrystals();default->throw new IllegalArgumentException("Procedural family is outside the natural-object preview scope");};
    }
    private static int variants(IrisProceduralPlacement value){return Math.max(1,value instanceof IrisProceduralTree tree?tree.getVariants():value instanceof IrisFormation formation?formation.getVariants():value instanceof IrisCoral coral?coral.getVariants():value instanceof IrisFungus fungus?fungus.getVariants():((IrisCrystal)value).getVariants());}
    private static long seed(IrisProceduralPlacement value){return value instanceof IrisProceduralTree tree?tree.getSeed():value instanceof IrisFormation formation?formation.getSeed():value instanceof IrisCoral coral?coral.getSeed():value instanceof IrisFungus fungus?fungus.getSeed():((IrisCrystal)value).getSeed();}
    public static void describe(IrisRegistrant resource,JsonWriter writer)throws IOException{
        if(!(resource instanceof IrisBiome)&&!(resource instanceof IrisRegion))return;
        writer.name("proceduralObjects").beginArray();
        for(String family:FAMILIES){var values=family(settings(resource),family);if(values==null)continue;for(int i=0;i<values.size();i++){var value=values.get(i);if(value==null)continue;writer.beginObject();writer.name("family").value(family);writer.name("index").value(i);writer.name("name").value(value.getName());writer.name("variants").value(variants(value));writer.name("seed").value(Long.toString(seed(value)));writer.endObject();}}
        writer.endArray();
    }
    public static String render(MemoryPack pack,String folder,String key,String family,int index,int variant)throws IOException{
        if(!folder.equals("biomes")&&!folder.equals("regions"))throw new IllegalArgumentException("Choose a native biome or region");
        pack.open();pack.requireGenerationReady();IrisRegistrant resource=pack.load(folder,key);if(resource==null||resource.isCompatExcluded())throw new IllegalArgumentException("Native procedural source is missing or excluded");
        var values=family(settings(resource),family);if(values==null||index<0||index>=values.size()||values.get(index)==null)throw new IllegalArgumentException("Native procedural entry is missing");
        var placement=values.get(index);if(variants(placement)>8)throw new IllegalArgumentException("Isolated previews support pools of at most eight native variants");
        if(variant<0||variant>=variants(placement))throw new IllegalArgumentException("Native variant index is outside its configured pool");
        WorkerProceduralMap.begin();try{
            var pool=placement.getVariantObjects(pack.open());if(pool==null||variant>=pool.size())throw new IllegalArgumentException("Native generator did not produce the requested baked variant");
            return serialize(pool.get(variant),family,index,variant,pool.size(),Long.toString(seed(placement)));
        }finally{WorkerProceduralMap.end();}
    }
    private static String serialize(IrisObject object,String family,int index,int variant,int poolSize,String seed)throws IOException{
        if(object==null||object.getBlocks().isEmpty())throw new IllegalArgumentException("Native procedural variant is empty");
        int[] min={Integer.MAX_VALUE,Integer.MAX_VALUE,Integer.MAX_VALUE},max={Integer.MIN_VALUE,Integer.MIN_VALUE,Integer.MIN_VALUE};
        for(var entry:object.getBlocks()){var p=entry.getKey();int[] position={p.getBlockX(),p.getBlockY(),p.getBlockZ()};for(int axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],position[axis]);max[axis]=Math.max(max[axis],position[axis]);}}
        int[] size=new int[3];long count=1;for(int axis=0;axis<3;axis++){long extent=(long)max[axis]-min[axis]+1;if(extent<1||extent>256)throw new IllegalArgumentException("Native variant exceeds the 256-block preview axis budget");size[axis]=(int)extent;count*=extent;}
        if(count>1048576||object.getBlocks().size()>262144)throw new IllegalArgumentException("Native variant exceeds its preview volume budget");
        int[] cells=new int[(int)count];Map<String,Integer> palette=new LinkedHashMap<>();palette.put(art.arcane.iris.generation.block.B.getAirState().key(),0);
        for(var entry:object.getBlocks()){String state=entry.getValue().key();Integer id=palette.get(state);if(id==null){id=palette.size();palette.put(state,id);}var p=entry.getKey();cells[p.getBlockX()-min[0]+size[0]*(p.getBlockZ()-min[2]+size[2]*(p.getBlockY()-min[1]))]=id;}
        StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){writer.beginObject();writer.name("scope").value("native-procedural-variant-development");writer.name("key").value(object.getLoadKey());writer.name("family").value(family);writer.name("index").value(index);writer.name("variant").value(variant);writer.name("poolSize").value(poolSize);writer.name("seed").value(seed);writer.name("blockCount").value(object.getBlocks().size());writer.name("size").beginArray();for(int value:size)writer.value(value);writer.endArray();writer.name("origin").beginArray();for(int value:min)writer.value(value);writer.endArray();writer.name("palette").beginArray();for(String state:palette.keySet())writer.value(state);writer.endArray();writer.name("cells").beginArray();for(int value:cells)writer.value(value);writer.endArray();writer.name("placementConnected").value(false);writer.endObject();}return output.toString();
    }
}
