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
        for(int section=0;section<(height+15)/16;section++)if(chunk.exists(section)){
            var matter=chunk.get(section);var hydrology=matter.getSlice(HydrologyCaveCell.class);
            if(hydrology!=null)hydrology.iterate((x,y,z,value)->{
                counts[switch(value.action()){case WET_SOURCE->0;case FALLING_FLUID->1;case DRY_AIR->2;case SEAL_GUARD->3;}]++;
            });
            var updates=matter.getSlice(MatterUpdate.class);if(updates!=null)updates.iterate((x,y,z,value)->{if(value.isUpdate())counts[4]++;});
        }
        var output=new StringWriter();try(var writer=new JsonWriter(output)){
            writer.beginObject();writer.name("nativeComponentFlag").value(chunk.isFlagged(ReservedFlag.RIVER_HYDROLOGY));
            writer.name("wetSources").value(counts[0]);writer.name("fallingFluids").value(counts[1]);writer.name("dryAir").value(counts[2]);writer.name("sealGuards").value(counts[3]);writer.name("fluidUpdates").value(counts[4]);writer.name("completePipeline").value(false);writer.endObject();
        }return output.toString();
    }
}
