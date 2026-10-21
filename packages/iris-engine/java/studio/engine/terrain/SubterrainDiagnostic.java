// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.runtime.Engine;
import com.google.gson.stream.JsonWriter;
import java.io.*;

/** Small world-coordinate inspection of the original planner; no replacement terrain. */
public final class SubterrainDiagnostic {
    public static String cell(Engine engine,int x,int worldY,int z)throws IOException {
        if(Math.abs((long)x)>29999968||Math.abs((long)z)>29999968||worldY<engine.getMinHeight()||worldY>=engine.getMaxHeight())throw new IllegalArgumentException("Subterrain cell exceeds native inspection bounds");
        var cell=engine.getSubterrainCell(x,worldY-engine.getMinHeight(),z);
        var output=new StringWriter();try(var writer=new JsonWriter(output)){
            writer.beginObject();writer.name("kind").value(cell.kind().name());writer.name("material").value(cell.material());
            if(cell.owned()){var room=cell.room();writer.name("featureId").value(room.featureId());writer.name("family").value(room.family().name());writer.name("biome").value(room.biome());writer.name("floorY").value(room.floorY());writer.name("ceilingY").value(room.ceilingY());writer.name("fluidHeadY").value(room.fluidHeadY());writer.name("reservedPassage").value(room.reservedPassage());writer.name("reservedSolid").value(room.reservedSolid());}
            writer.endObject();
        }return output.toString();
    }
}
