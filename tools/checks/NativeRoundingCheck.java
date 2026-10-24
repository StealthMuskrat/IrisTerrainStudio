// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import java.nio.file.*;

/** JVM reference uses original Math overloads and original CNG fitting; no browser compiler is installed. */
public final class NativeRoundingCheck {
    public static void main(String[] args)throws Exception{
        var request=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray();
        if(request.size()>32)throw new IllegalArgumentException("At most 32 selected rounding pairs");
        var result=new JsonArray();for(var entry:request){var row=entry.getAsJsonArray();result.add(JsonParser.parseString(studio.engine.NativeRoundingDiagnostic.sample(row.get(0).getAsString(),row.get(1).getAsString())));}
        Files.writeString(Path.of(args[1]),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(result));
    }
}
