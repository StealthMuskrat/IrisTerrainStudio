// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.generation.runtime.Engine;
import com.google.gson.stream.JsonWriter;
import java.io.*;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.TreeSet;

/** Original Engine.getRegion for unstacked contexts, where the region is independent of internal Y. */
public final class TerrainRegionSnapshot {
    public static String sample(Engine engine,int x,int z)throws IOException{
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984)throw new IllegalArgumentException("Region columns require an aligned bounded native chunk");
        if(engine.getDimensionStackContext()!=null)return spans(engine,x,z);
        var palette=new LinkedHashMap<String,Integer>();int[] cells=new int[256];
        for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){
            var region=engine.getRegion(x+lx,0,z+lz);if(region==null)throw new IllegalStateException("Native region query returned no region");
            String key=region.getLoadKey();Integer index=palette.get(key);if(index==null){index=palette.size();palette.put(key,index);}cells[lx+16*lz]=index;
        }
        var text=new StringWriter();try(var writer=new JsonWriter(text)){writer.beginObject();writer.name("scope").value("native-engine-region-columns");writer.name("dimension").value(engine.getDimension().getLoadKey());writer.name("x").value(x);writer.name("z").value(z);writer.name("palette").beginArray();for(var key:palette.keySet())writer.value(key);writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();writer.endObject();}return text.toString();
    }
    private static String spans(Engine engine,int x,int z)throws IOException{
        // Native getRegion gives occupied host subterrain precedence over the stack.
        // Layer endpoints alone cannot describe that raster, so do not guess its regions.
        if(!engine.getComplex().getSubterrainPlanner().isEmpty())return "{\"unavailable\":\"Vertical region spans with host subterrain require occupied-feature raster metadata.\"}";
        int height=engine.getHeight(),queries=0;var palette=new LinkedHashMap<String,Integer>();var starts=new ArrayList<Integer>();var cells=new ArrayList<Integer>();int[] offsets=new int[257];
        for(int lz=0;lz<16;lz++)for(int lx=0;lx<16;lx++){
            int column=lx+16*lz;offsets[column]=starts.size();var layout=engine.getDimensionStackContext().getLayout(x+lx,z+lz);var boundaries=new TreeSet<Integer>();boundaries.add(0);boundaries.add(height);
            // layerAt changes only at these rendered and gap endpoints. Preserve native
            // top-to-bottom overlap precedence by calling getRegion once per interval.
            for(var layer:layout.layersBottomToTop()){
                for(long endpoint:new long[]{layer.renderMinY(),(long)layer.renderMaxY()+1,(long)layer.contentTopY()+1,layer.localBaseY()})if(endpoint>0&&endpoint<height)boundaries.add((int)endpoint);
            }
            int previous=-1;for(int y:boundaries){if(y==height)continue;var region=engine.getRegion(x+lx,y,z+lz);queries++;if(region==null)throw new IllegalStateException("Native region query returned no region");String key=region.getLoadKey();Integer id=palette.get(key);if(id==null){if(palette.size()>=4096)throw new IllegalArgumentException("Stack region palette exceeds its transport budget");id=palette.size();palette.put(key,id);}if(id!=previous){starts.add(y);cells.add(id);previous=id;}}
        }offsets[256]=starts.size();
        var text=new StringWriter();try(var writer=new JsonWriter(text)){writer.beginObject();writer.name("scope").value("native-engine-region-spans");writer.name("dimension").value(engine.getDimension().getLoadKey());writer.name("x").value(x);writer.name("z").value(z);writer.name("height").value(height);writer.name("nativeQueries").value(queries);writer.name("palette").beginArray();for(var key:palette.keySet())writer.value(key);writer.endArray();writer.name("offsets").beginArray();for(int offset:offsets)writer.value(offset);writer.endArray();writer.name("starts").beginArray();for(int start:starts)writer.value(start);writer.endArray();writer.name("cells").beginArray();for(int cell:cells)writer.value(cell);writer.endArray();writer.endObject();}return text.toString();
    }
}
