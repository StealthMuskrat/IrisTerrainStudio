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
import art.arcane.iris.generation.decoration.ruin.IrisRuin;
import art.arcane.iris.structure.object.IrisObject;
import com.google.gson.stream.JsonWriter;
import studio.engine.pack.MemoryPack;
import java.io.*;
import java.util.*;

/** Isolated native baked variants; no invented placement terrain or chunk parity claim. */
public final class ProceduralPreview {
    private static final String[] FAMILIES={"trees","formations","coral","fungi","crystals","ruins"};
    private static IrisProceduralObjects settings(IrisRegistrant resource){
        if(resource instanceof IrisBiome biome)return biome.getProceduralObjects();
        if(resource instanceof IrisRegion region)return region.getProceduralObjects();
        throw new IllegalArgumentException("Procedural previews require a native biome or region");
    }
    private static List<? extends IrisProceduralPlacement> family(IrisProceduralObjects settings,String family){
        if(settings==null)return List.of();
        return switch(family){case"trees"->settings.getTrees();case"formations"->settings.getFormations();case"coral"->settings.getCoral();case"fungi"->settings.getFungi();case"crystals"->settings.getCrystals();case"ruins"->settings.getRuins();default->throw new IllegalArgumentException("Procedural family is outside the procedural preview scope");};
    }
    static int variants(IrisProceduralPlacement value){return Math.max(1,value instanceof IrisProceduralTree tree?tree.getVariants():value instanceof IrisFormation formation?formation.getVariants():value instanceof IrisCoral coral?coral.getVariants():value instanceof IrisFungus fungus?fungus.getVariants():value instanceof IrisCrystal crystal?crystal.getVariants():((IrisRuin)value).getVariants());}
    private static long seed(IrisProceduralPlacement value){return value instanceof IrisProceduralTree tree?tree.getSeed():value instanceof IrisFormation formation?formation.getSeed():value instanceof IrisCoral coral?coral.getSeed():value instanceof IrisFungus fungus?fungus.getSeed():value instanceof IrisCrystal crystal?crystal.getSeed():((IrisRuin)value).getSeed();}
    public static void describe(IrisRegistrant resource,JsonWriter writer)throws IOException{
        if(!(resource instanceof IrisBiome)&&!(resource instanceof IrisRegion))return;
        writer.name("proceduralObjects").beginArray();
        for(String family:FAMILIES){var values=family(settings(resource),family);if(values==null)continue;for(int i=0;i<values.size();i++){var value=values.get(i);if(value==null)continue;writer.beginObject();writer.name("family").value(family);writer.name("index").value(i);writer.name("name").value(value.getName());writer.name("variants").value(variants(value));writer.name("seed").value(Long.toString(seed(value)));writer.endObject();}}
        writer.endArray();
    }
    /** Bound loops and temporary candidate lists before the unchanged native ruin generator runs. */
    static void admit(IrisProceduralPlacement value){
        if(!(value instanceof IrisRuin ruin))return;
        if(ruin.getForm()==null)throw new IllegalArgumentException("Ruin preview requires a native form");
        for(int extent:new int[]{ruin.getHeightMin(),ruin.getHeightMax(),ruin.getWidthMin(),ruin.getWidthMax(),ruin.getLengthMin(),ruin.getLengthMax()})if(extent<1||extent>64)throw new IllegalArgumentException("Ruin preview dimensions must be between one and 64 blocks");
        if(!Double.isFinite(ruin.getBuriedFraction())||!Double.isFinite(ruin.getErosion())||!Double.isFinite(ruin.getErosionScale())||!Double.isFinite(ruin.getMossiness())||!Double.isFinite(ruin.getWeatheringScale()))throw new IllegalArgumentException("Ruin preview settings must be finite");
        var accents=ruin.getAccents();if(accents==null||accents.size()>16)throw new IllegalArgumentException("Ruin preview allows up to sixteen accents");
        long width=Math.max(ruin.getWidthMin(),ruin.getWidthMax())+4L,length=Math.max(ruin.getLengthMin(),ruin.getLengthMax())+4L,height=Math.max(ruin.getHeightMin(),ruin.getHeightMax())+4L,work=0;
        for(var accent:accents){
            if(accent==null||accent.getTarget()==null||!Double.isFinite(accent.getChance())||accent.getScatterRadius()<1||accent.getScatterRadius()>16)throw new IllegalArgumentException("Ruin accent requires a native target, finite chance and scatter radius from one to sixteen");
            // Each accent can expand the footprint; retain a conservative cumulative envelope.
            int expansion=accent.getTarget()==art.arcane.iris.generation.decoration.ruin.IrisRuinDecoratorTarget.BASE_SCATTER?accent.getScatterRadius():1;width+=2L*expansion;length+=2L*expansion;height++;
            work+=Math.max(width*length,4L*width*length*height);
        }
        if(work*Math.max(1,variants(ruin))>1048576)throw new IllegalArgumentException("Ruin accents exceed the bounded native candidate-work budget");
    }
    private record Selection(IrisProceduralPlacement placement,IrisObject object,int poolSize){}
    private static Selection select(MemoryPack pack,String folder,String key,String family,int index,int variant){
        if(!folder.equals("biomes")&&!folder.equals("regions"))throw new IllegalArgumentException("Choose a native biome or region");
        pack.open();pack.requireGenerationReady();IrisRegistrant resource=pack.load(folder,key);if(resource==null||resource.isCompatExcluded())throw new IllegalArgumentException("Native procedural source is missing or excluded");
        var values=family(settings(resource),family);if(values==null||index<0||index>=values.size()||values.get(index)==null)throw new IllegalArgumentException("Native procedural entry is missing");
        var placement=values.get(index);if(variants(placement)>8)throw new IllegalArgumentException("Isolated previews support pools of at most eight native variants");
        if(variant<0||variant>=variants(placement))throw new IllegalArgumentException("Native variant index is outside its configured pool");
        admit(placement);var pool=placement.getVariantObjects(pack.open());if(pool==null||variant>=pool.size())throw new IllegalArgumentException("Native generator did not produce the requested baked variant");
        return new Selection(placement,pool.get(variant),pool.size());
    }
    public static String render(MemoryPack pack,String folder,String key,String family,int index,int variant)throws IOException{
        WorkerProceduralMap.begin();try{var selected=select(pack,folder,key,family,index,variant);return serialize(selected.object(),family,index,variant,selected.poolSize(),Long.toString(seed(selected.placement())));}finally{WorkerProceduralMap.end();}
    }
    public static String place(MemoryPack pack,BrowserTerrainEngine engine,int x,int z,String folder,String key,String family,int index,int variant,String placementSeed)throws IOException{
        return place(pack,engine,x,z,folder,key,family,index,variant,placementSeed,null);
    }
    public static String place(MemoryPack pack,BrowserTerrainEngine engine,int x,int z,String folder,String key,String family,int index,int variant,String placementSeed,art.arcane.iris.structure.object.IrisObjectReplace diagnosticEdit)throws IOException{
        WorkerProceduralMap.begin();try{
            var selected=select(pack,folder,key,family,index,variant);var rng=new art.arcane.volmlib.util.math.RNG(Long.parseLong(placementSeed));var config=selected.placement().asPlacement();if(diagnosticEdit!=null)config.getEdit().add(diagnosticEdit);IrisObject object=config.scaleObject(rng,selected.object(),engine.getDimension());
            if(object==null)throw new IllegalArgumentException("Native scale produced no object");
            var request=new TerrainCarvingComponent.Placement(object,config,rng,selected.placement().isPlausible());
            String result=TerrainCarvingComponent.place(engine,x,z,request);
            StringWriter metadata=new StringWriter();try(JsonWriter writer=new JsonWriter(metadata)){writer.beginObject();writer.name("key").value(object.getLoadKey());writer.name("family").value(family);writer.name("entryIndex").value(index);writer.name("variant").value(variant);writer.name("poolSize").value(selected.poolSize());writer.name("configuredSeed").value(Long.toString(seed(selected.placement())));writer.name("placementSeed").value(placementSeed);writer.name("automaticScatter").value(false);writer.name("crossSourceCollisionReplay").value(false);writer.endObject();}
            return result.substring(0,result.length()-1)+",\"placement\":"+metadata+"}";
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
