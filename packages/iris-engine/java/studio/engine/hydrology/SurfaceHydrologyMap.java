// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;

import art.arcane.iris.generation.runtime.Engine;
import art.arcane.iris.generation.runtime.GenerationSessionException;
import art.arcane.iris.generation.context.IrisContext;
import art.arcane.iris.generation.hydrology.HydrologyFeatureType;
import studio.engine.terrain.BrowserTerrainEngine;
import com.google.gson.stream.JsonWriter;
import java.io.*;
import java.util.*;

/** A display of original primary surface features at whole-block sample centers, not terrain synthesis. */
public final class SurfaceHydrologyMap {
    public static String sample(Engine engine,double x,double z,double span,int width,int height)throws IOException{
        double depth=span*height/width;
        if(!Double.isFinite(x)||!Double.isFinite(z)||!Double.isFinite(span)||width<1||height<1||width>256||height>256||span<=0||span>256||!Double.isFinite(depth)||depth>256||Math.abs(x)+span/2>29999984||Math.abs(z)+depth/2>29999984)throw new IllegalArgumentException("Surface hydrology maps require at most 256 samples per axis and a 256-block window within worker coordinates");
        var runtime=engine.getComplex().getHydrologyRuntime();if(runtime==null)throw new IllegalArgumentException("Selected dimension has no active native hydrology runtime");
        int[] xs=new int[width],zs=new int[height];for(int column=0;column<width;column++)xs[column]=(int)Math.floor(x-span/2+(column+.5)*span/width);for(int row=0;row<height;row++)zs[row]=(int)Math.floor(z-depth/2+(row+.5)*depth/height);
        Set<Long> chunks=new LinkedHashSet<>();for(int rz:zs)for(int rx:xs)chunks.add(((long)(rx>>4)<<32)|((rz>>4)&0xffffffffL));
        var categories=new ArrayList<String>();categories.add("No primary surface feature");int[] ids=new int[HydrologyFeatureType.values().length];
        for(var type:HydrologyFeatureType.values())if(type.isSurface()){ids[type.ordinal()]=categories.size();categories.add(type.name());}
        WorkerHydrologyBudget.begin();
        try(var matter=engine instanceof BrowserTerrainEngine browser?WorkerHydrologyMatter.open(browser,(int)Math.floor(x),(int)Math.floor(z)):null;var lease=engine.acquireGenerationLease("browser_surface_hydrology_map");var scope=IrisContext.open(engine,lease.sessionId(),null)){
            for(long key:chunks)runtime.prepareChunkColumns((int)(key>>32)<<4,(int)key<<4);
            int[] values=new int[width*height];for(int row=0;row<height;row++)for(int column=0;column<width;column++){
                var snapshot=runtime.sampleSnapshot(xs[column],zs[row]);if(!snapshot.available())throw new IllegalStateException("Native hydrology did not publish a requested map column");
                var sample=snapshot.column();var layer=sample==null?null:sample.primarySurfaceLayerOrNull();
                if(layer!=null){int id=ids[layer.feature().type().ordinal()];if(id==0)throw new IllegalStateException("Native primary surface layer has no surface feature category");values[row*width+column]=id;}
            }
            var output=new StringWriter();try(var writer=new JsonWriter(output)){
                writer.beginObject();writer.name("scope").value("native-surface-hydrology-map-development");writer.name("width").value(width);writer.name("height").value(height);writer.name("x").value(x);writer.name("z").value(z);writer.name("span").value(span);writer.name("depth").value(depth);
                writer.name("selection").value("original-primarySurfaceLayer");writer.name("sampling").value("floor-world-block-at-grid-center");writer.name("preparedSampleChunks").value(chunks.size());
                writer.name("categories").beginArray();for(String category:categories)writer.value(category);writer.endArray();writer.name("values").beginArray();for(int value:values)writer.value(value);writer.endArray();
                writer.name("network");HydrologyNetworkSnapshot.write(writer,runtime,(int)Math.floor(x-span/2),(int)Math.floor(z-depth/2),(int)Math.ceil(x+span/2),(int)Math.ceil(z+depth/2));
                writer.name("admittedPlanningRoots").value(WorkerHydrologyBudget.roots());writer.name("admittedPlanningCalls").value(WorkerHydrologyBudget.calls());writer.name("admittedCarvingChunks").value(WorkerHydrologyMatter.admittedChunks());writer.name("chargedCarvingInputCells").value(WorkerHydrologyMatter.chargedCells());writer.name("terrainParityVerified").value(false);writer.name("completePipeline").value(false);writer.endObject();
            }return output.toString();
        }catch(GenerationSessionException failure){throw new IOException("Surface hydrology map generation lease failed",failure);}finally{WorkerHydrologyBudget.end();}
    }
}
