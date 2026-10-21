// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.stage.IrisBiomeActuator;
import art.arcane.volmlib.nativelib.terrain.NativeBiome;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import com.google.gson.stream.JsonWriter;
import java.io.*;
import java.util.LinkedHashMap;

/** Original biome actuator output, sampled at one world-Y slice. No later-stage biome synthesis. */
public final class TerrainBiomeStage {
    public static void writeVolume(JsonWriter writer,ArrayHunk<NativeBiome> biomes)throws IOException {
        LinkedHashMap<String,Integer> palette=new LinkedHashMap<>();int[] cells=new int[16*biomes.getHeight()*16];
        for(int y=0;y<biomes.getHeight();y++)for(int z=0;z<16;z++)for(int x=0;x<16;x++){
            NativeBiome biome=biomes.getRaw(x,y,z);if(biome==null)throw studio.engine.UnsupportedPlatform.unavailable("Native mode left an unresolved physical biome");
            String key=biome.key();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells[(y*16+z)*16+x]=index;
        }
        writer.beginObject();writer.name("palette").beginArray();for(String key:palette.keySet())writer.value(key);writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();writer.endObject();
    }
    public static String slice(BrowserTerrainEngine engine,int x,int worldY,int z)throws IOException {
        int height=engine.getHeight();
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984||height<1||height>4096||worldY<engine.getMinHeight()||worldY>=engine.getMaxHeight())throw new IllegalArgumentException("Native biome stage exceeds worker chunk or world-Y bounds");
        ArrayHunk<NativeBiome> biomes=new ArrayHunk<>(16,height,16);
        new IrisBiomeActuator(engine).onActuate(x,z,biomes,false,new ChunkContext(x,z,engine.getComplex(),false));
        LinkedHashMap<String,Integer> palette=new LinkedHashMap<>();int[] cells=new int[256];int y=worldY-engine.getMinHeight();
        for(int localZ=0;localZ<16;localZ++)for(int localX=0;localX<16;localX++){
            NativeBiome biome=biomes.getRaw(localX,y,localZ);
            if(biome==null)throw studio.engine.UnsupportedPlatform.unavailable("Native biome actuator left an unresolved physical biome");
            String key=biome.key();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells[localZ*16+localX]=index;
        }
        StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){
            writer.beginObject();writer.name("scope").value("native-physical-biome-stage-development");writer.name("x").value(x);writer.name("y").value(worldY);writer.name("z").value(z);writer.name("minY").value(engine.getMinHeight());writer.name("worldHeight").value(height);
            writer.name("palette").beginArray();for(String key:palette.keySet())writer.value(key);writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();writer.endObject();
        }return output.toString();
    }
}
