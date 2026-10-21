// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.structure.object.IrisObjectRotation;
import art.arcane.iris.modded.ModdedStateRotator;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockResolver;
import com.google.gson.*;
import java.nio.file.*;

/** A few native rotation operations; no state-table or geometry sweep. */
public final class NativeRotationCheck {
    public static void main(String[] args)throws Exception{
        HeadlessNativeBootstrap.initialize();var rotation=new IrisObjectRotation();rotation.getXAxis().setEnabled(true);rotation.getYAxis().setEnabled(true);rotation.getZAxis().setEnabled(true);var rotator=new ModdedStateRotator();JsonArray output=new JsonArray();
        for(JsonElement value:JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray()){
            JsonObject request=value.getAsJsonObject();var source=NativeBlockResolver.strictParse(request.get("state").getAsString());var result=rotator.rotate(rotation,source,request.get("x").getAsInt(),request.get("y").getAsInt(),request.get("z").getAsInt());JsonObject row=new JsonObject();row.add("state",result==null?JsonNull.INSTANCE:new JsonPrimitive(result.key()));
            if(request.has("match"))row.addProperty("match",NativeBlockResolver.strictParse(request.get("match").getAsString()).matches(result));output.add(row);
        }Files.writeString(Path.of(args[1]),new GsonBuilder().serializeNulls().create().toJson(output)+"\n");
    }
}
