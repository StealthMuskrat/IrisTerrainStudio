// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.generation.runtime.Engine;
import com.google.gson.stream.JsonWriter;
import java.io.*;

/** Reports original native contexts in internal Y coordinates, with the world-Y origin explicit. */
public final class TerrainLayerDiagnostic {
    public static void writeMetadata(JsonWriter writer,Engine engine)throws IOException{
        writer.name("biomeSeed").value(Long.toString(engine.getWorld().getRawWorldSeed()));
        writer.name("environment").value(engine.getDimension().getEnvironment().name());
        var upper=engine.getUpperContext();var stack=engine.getDimensionStackContext();
        writer.name("upperDimension").value(upper==null?null:upper.getDimension().getLoadKey());
        writer.name("dimensionStackLayers").value(stack==null?0:stack.getLayersBottomToTop().size());
        writer.name("scalarFields").value("host-dimension");
    }
    public static String metadata(Engine engine)throws IOException{
        StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){
            writer.beginObject();writer.name("minHeight").value(engine.getMinHeight());writer.name("maxHeight").value(engine.getMaxHeight());writer.name("hydrologyActive").value(engine.getComplex().getHydrologyRuntime()!=null);writeMetadata(writer,engine);writer.name("terrainParityVerified").value(false);writer.endObject();
        }return output.toString();
    }
    public static String column(Engine engine,int x,int z)throws IOException{
        if(Math.abs((long)x)>29999984||Math.abs((long)z)>29999984)throw new IllegalArgumentException("Layer column exceeds worker world-coordinate bounds");
        StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){
            writer.beginObject();writer.name("x").value(x);writer.name("z").value(z);writer.name("worldMinY").value(engine.getMinHeight());writeMetadata(writer,engine);
            var upper=engine.getUpperContext();if(upper!=null){writer.name("upper").beginObject();writer.name("surfaceY").value(upper.getEffectiveSurfaceY(x,z));writer.name("biome").value(upper.getUpperBiome(x,z).getLoadKey());writer.name("region").value(upper.getUpperRegion(x,z).getLoadKey());writer.endObject();}
            var stack=engine.getDimensionStackContext();if(stack!=null){var layout=stack.getLayout(x,z);writer.name("stack").beginObject();writer.name("terrainTopY").value(layout.clippedStackTerrainTopY());writer.name("topY").value(layout.clippedStackTopY());writer.name("layersBottomToTop").beginArray();
                for(var layer:layout.layersBottomToTop()){
                    writer.beginObject();writer.name("dimension").value(layer.terrainContext().getDimension().getLoadKey());writer.name("baseY").value(layer.localBaseY());writer.name("surfaceY").value(layer.clippedSurfaceY());writer.name("fluidY").value(layer.clippedFluidY());writer.name("contentTopY").value(layer.contentTopY());writer.name("renderMinY").value(layer.renderMinY());writer.name("renderMaxY").value(layer.renderMaxY());writer.name("seamOffsetBelow").value(layer.seamOffsetBelow());writer.name("visible").value(layer.visible());writer.name("biome").value(layer.biome()==null?null:layer.biome().getLoadKey());writer.endObject();
                }writer.endArray();writer.endObject();
            }writer.endObject();
        }return output.toString();
    }
}
