// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.generation.runtime.Engine;
import com.google.gson.stream.JsonWriter;
import java.io.*;
import java.util.LinkedHashMap;

/** Original Engine.getRegion for unstacked contexts, where the region is independent of internal Y. */
public final class TerrainRegionSnapshot {
    public static String sample(Engine engine,int x,int z)throws IOException{
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984)throw new IllegalArgumentException("Region columns require an aligned bounded native chunk");
        if(engine.getDimensionStackContext()!=null)throw studio.engine.UnsupportedPlatform.unavailable("A column region map cannot represent dimension-stack regions");
        var palette=new LinkedHashMap<String,Integer>();int[] cells=new int[256];
        for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){
            var region=engine.getRegion(x+lx,0,z+lz);if(region==null)throw new IllegalStateException("Native region query returned no region");
            String key=region.getLoadKey();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells[lx+16*lz]=index;
        }
        var text=new StringWriter();try(var writer=new JsonWriter(text)){writer.beginObject();writer.name("scope").value("native-engine-region-columns");writer.name("dimension").value(engine.getDimension().getLoadKey());writer.name("x").value(x);writer.name("z").value(z);writer.name("palette").beginArray();for(var key:palette.keySet())writer.value(key);writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();writer.endObject();}return text.toString();
    }
}
