// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.stage.IrisTerrainNormalActuator;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.nativelib.terrain.NativeBiome;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import com.google.gson.stream.JsonWriter;
import java.io.*;
import java.util.*;

/** Actual native terrain painting stage, not a completed chunk-generation pipeline. */
public final class TerrainPaintStage {
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException{
        int height=engine.getHeight();if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984||height<1||height>4096)throw new IllegalArgumentException("Terrain painting exceeds worker chunk bounds");
        ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());
        ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
        var biomes=TerrainBiomeStage.paint(engine,x,z,context);
        new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
        return serialize(engine,x,z,blocks,"native-terrain-paint-stage-development",biomes);
    }
    public static String serialize(BrowserTerrainEngine engine,int x,int z,ArrayHunk<NativeBlockState> blocks,String scope)throws IOException{
        return serialize(engine,x,z,blocks,scope,null);
    }
    public static String serialize(BrowserTerrainEngine engine,int x,int z,ArrayHunk<NativeBlockState> blocks,String scope,ArrayHunk<NativeBiome> biomes)throws IOException{
        int height=engine.getHeight();
        LinkedHashMap<String,Integer> indices=new LinkedHashMap<>();int[] cells=new int[16*height*16];
        for(int y=0;y<height;y++)for(int localZ=0;localZ<16;localZ++)for(int localX=0;localX<16;localX++){
            NativeBlockState block=blocks.getRaw(localX,y,localZ);if(block==null)throw new IllegalStateException("Native terrain painter returned an uninitialized block");String key=block.key();Integer index=indices.get(key);if(index==null){index=indices.size();indices.put(key,index);}cells[(y*16+localZ)*16+localX]=index;
        }
        StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){writer.beginObject();writer.name("scope").value(scope);writer.name("x").value(x);writer.name("z").value(z);writer.name("minY").value(engine.getMinHeight());writer.name("height").value(height);writer.name("palette").beginArray();for(String key:indices.keySet())writer.value(key);writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();if(biomes!=null){writer.name("biomes");TerrainBiomeStage.writeVolume(writer,biomes);}writer.endObject();}return output.toString();
    }
}
