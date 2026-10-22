// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import art.arcane.iris.generation.runtime.Engine;
import art.arcane.iris.generation.context.IrisContext;
import com.google.gson.stream.JsonWriter;
import java.io.*;

/** Explicit one-column original planner diagnostic. Coordinates and all Y values are native internal values. */
public final class HydrologyDiagnostic {
    public static String sample(Engine engine,int x,int z)throws IOException{
        if(Math.abs((long)x)>29999984||Math.abs((long)z)>29999984)throw new IllegalArgumentException("Hydrology diagnostic exceeds worker coordinates");
        var runtime=engine.getComplex().getHydrologyRuntime();if(runtime==null)throw new IllegalArgumentException("Selected dimension has no active native hydrology runtime");
        WorkerHydrologyBudget.begin();
        try(var matter=engine instanceof studio.engine.terrain.BrowserTerrainEngine browser?WorkerHydrologyMatter.open(browser,x,z):null;var lease=engine.acquireGenerationLease("browser_hydrology_column");var scope=IrisContext.open(engine,lease.sessionId(),null)){
            runtime.prepareChunkColumns(x&~15,z&~15);var snapshot=runtime.sampleSnapshot(x,z);
            if(!snapshot.available())throw new IllegalStateException("Native hydrology did not publish the requested column");
            StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){
                writer.beginObject();writer.name("scope").value("native-hydrology-column-development");writer.name("x").value(x);writer.name("z").value(z);writer.name("worldMinY").value(engine.getMinHeight());
                writer.name("runtimeSettingsFingerprint").value(Long.toUnsignedString(runtime.settings().fingerprint(),16));writer.name("settingsFingerprintPortable").value(false);writer.name("tileSize").value(runtime.settings().routing().tileSize());writer.name("publicationRadius").value(runtime.settings().publicationRadius());
                writer.name("available").value(snapshot.available());var column=snapshot.column();writer.name("present").value(column!=null&&column.present());
                writer.name("heightBits").value(Long.toUnsignedString(Double.doubleToRawLongBits(engine.getComplex().getHeightStream().getDouble(x,z)),16));writer.name("biome").value(engine.getComplex().getTrueBiomeStream().get(x,z).getLoadKey());
                if(column!=null){writer.name("naturalHeight").value(column.naturalHeight());writer.name("seaLevel").value(column.seaLevel());writer.name("ocean").value(column.ocean());writer.name("parentBiome").value(column.parentBiomeKey());writer.name("layers").beginArray();
                    for(var layer:column.layers()){
                        writer.beginObject();var feature=layer.feature();writer.name("featureId").value(Long.toUnsignedString(feature.id(),16));writer.name("featureType").value(feature.type().name());writer.name("courseId").value(Long.toUnsignedString(feature.courseId(),16));writer.name("segmentId").value(Long.toUnsignedString(feature.segmentId(),16));
                        writer.name("bedY").value(layer.bedY());writer.name("fluidHeadY").value(layer.fluidHeadY());writer.name("ceilingY").value(layer.ceilingY());writer.name("channel").value(layer.channel());writer.name("shore").value(layer.shore());writer.name("grading").value(layer.grading());writer.name("terrainOwned").value(layer.terrainOwned());writer.name("fluidOwned").value(layer.fluidOwned());writer.name("connectedFluid").value(layer.connectedFluid());writer.name("fallingFluid").value(layer.fallingFluid());writer.name("receivingPool").value(layer.receivingPool());writer.name("oceanApron").value(layer.oceanApron());writer.name("profile").value(layer.profileKey());writer.name("biome").value(layer.biomeKey());writer.endObject();
                    }writer.endArray();
                }
                writer.name("admittedRoots").value(WorkerHydrologyBudget.roots());writer.name("admittedPlanningCalls").value(WorkerHydrologyBudget.calls());writer.name("admittedCarvingChunks").value(WorkerHydrologyMatter.admittedChunks());writer.name("chargedCarvingInputCells").value(WorkerHydrologyMatter.chargedCells());writer.name("terrainParityVerified").value(false);writer.endObject();
            }return output.toString();
        }catch(art.arcane.iris.generation.runtime.GenerationSessionException failure){throw new IOException("Hydrology diagnostic generation lease failed",failure);}
        finally{WorkerHydrologyBudget.end();}
    }
}
