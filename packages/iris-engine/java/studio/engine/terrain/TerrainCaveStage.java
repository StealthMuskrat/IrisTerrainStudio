// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.mantle.IrisCaveCarver3D;
import art.arcane.volmlib.util.matter.MatterCavern;
import com.google.gson.stream.JsonWriter;
import java.io.*;
import java.util.*;

/** Unchanged dimension-profile carver output. Markers have not been resolved into terrain blocks. */
public final class TerrainCaveStage {
    public static String carve(BrowserTerrainEngine engine,int x,int z)throws IOException {
        int height=engine.getHeight();if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984||height<1||height>4096)throw new IllegalArgumentException("Cave preview exceeds worker chunk bounds");
        var profile=engine.getDimension().getCaveProfile();if(profile==null||!profile.isEnabled())throw new IllegalArgumentException("The dimension cave profile is disabled");
        // Supply native natural surfaces at the carver's public precomputed-height boundary.
        int[] surface=new int[256];for(int lx=0;lx<16;lx++)for(int lz=0;lz<16;lz++)surface[(lx<<4)|lz]=engine.getComplex().naturalTrueHeight(x+lx,z+lz);
        WorkerCaveStorage.begin(height,x>>4,z>>4);
        try {
            int carved=new IrisCaveCarver3D(engine,profile).carve(null,x>>4,z>>4,null,0D,0D,null,surface);
            LinkedHashMap<MatterCavern,Integer> palette=new LinkedHashMap<>();palette.put(null,0);int[] cells=new int[256*height];
            for(int y=0;y<height;y++)for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){MatterCavern value=WorkerCaveStorage.get(lx,y,lz);Integer index=palette.get(value);if(index==null){index=palette.size();palette.put(value,index);}cells[(y*16+lz)*16+lx]=index;}
            StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){writer.setSerializeNulls(true);writer.beginObject();writer.name("scope").value("native-dimension-cave-markers-development");writer.name("x").value(x);writer.name("z").value(z);writer.name("minY").value(engine.getMinHeight());writer.name("height").value(height);writer.name("carved").value(carved);writer.name("palette").beginArray();for(MatterCavern value:palette.keySet()){if(value==null)writer.nullValue();else{writer.beginObject();writer.name("cavern").value(value.isCavern());writer.name("customBiome").value(value.getCustomBiome());writer.name("liquid").value(value.getLiquid());writer.endObject();}}writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();writer.endObject();}return output.toString();
        } finally {WorkerCaveStorage.clear();}
    }
}
