// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;

import art.arcane.iris.generation.hydrology.cave.HydrologyCaveCell;
import art.arcane.volmlib.util.mantle.flag.ReservedFlag;
import art.arcane.volmlib.util.mantle.runtime.MantleChunk;
import art.arcane.volmlib.util.matter.Matter;
import art.arcane.volmlib.util.matter.MatterUpdate;
import com.google.gson.stream.JsonWriter;
import java.io.*;

/** Counts original published sparse matter, never samples or reconstructs terrain. */
public final class HydrologyMatterSnapshot {
    public static String describe(MantleChunk<Matter> chunk,int height)throws IOException{
        if(chunk==null)throw new IllegalStateException("Hydrology publication chunk is absent");
        int[] counts=new int[5];
        var sections=new java.util.ArrayList<int[]>();var profiles=new java.util.TreeMap<String,int[]>();
        for(int section=0;section<(height+15)/16;section++)if(chunk.exists(section)){
            int[] local=new int[6];local[0]=section;
            var matter=chunk.get(section);var hydrology=matter.getSlice(HydrologyCaveCell.class);
            if(hydrology!=null)hydrology.iterate((x,y,z,value)->{
                int action=switch(value.action()){case WET_SOURCE->0;case FALLING_FLUID->1;case DRY_AIR->2;case SEAL_GUARD->3;};
                counts[action]++;local[action+1]++;profiles.computeIfAbsent(value.fluidProfileKey(),key->new int[4])[action]++;
            });
            var updates=matter.getSlice(MatterUpdate.class);if(updates!=null)updates.iterate((x,y,z,value)->{if(value.isUpdate()){counts[4]++;local[5]++;}});
            if(local[1]+local[2]+local[3]+local[4]+local[5]>0)sections.add(local);
        }
        var output=new StringWriter();try(var writer=new JsonWriter(output)){
            writer.beginObject();writer.name("nativeComponentFlag").value(chunk.isFlagged(ReservedFlag.RIVER_HYDROLOGY));
            writer.name("wetSources").value(counts[0]);writer.name("fallingFluids").value(counts[1]);writer.name("dryAir").value(counts[2]);writer.name("sealGuards").value(counts[3]);writer.name("fluidUpdates").value(counts[4]);writer.name("sections").beginArray();for(var section:sections){writer.beginObject();writer.name("internalSectionY").value(section[0]);writeCounts(writer,section,1);writer.endObject();}writer.endArray();
            writer.name("profiles").beginArray();for(var profile:profiles.entrySet()){writer.beginObject();writer.name("key").value(profile.getKey());writer.name("wetSources").value(profile.getValue()[0]);writer.name("fallingFluids").value(profile.getValue()[1]);writer.name("dryAir").value(profile.getValue()[2]);writer.name("sealGuards").value(profile.getValue()[3]);writer.endObject();}writer.endArray();
            writer.name("fluidSimulationExecuted").value(false);writer.name("completePipeline").value(false);writer.endObject();
        }return output.toString();
    }
    private static void writeCounts(JsonWriter writer,int[] values,int offset)throws IOException{
        writer.name("wetSources").value(values[offset]);writer.name("fallingFluids").value(values[offset+1]);writer.name("dryAir").value(values[offset+2]);writer.name("sealGuards").value(values[offset+3]);writer.name("fluidUpdates").value(values[offset+4]);
    }
}
