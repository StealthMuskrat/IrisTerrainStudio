// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.*;
import com.google.gson.*;
import java.nio.file.*;

/** Selected merges through the original JVM platform implementation, without a state sweep. */
public final class NativeMergeCheck {
    public static void main(String[] args)throws Exception{
        HeadlessNativeBootstrap.initialize();var resolver=new NativeBlockResolver(new NativeBlockResolver.Policy(){
            public ModdedBlockState resolveCustomBlock(String key){throw new IllegalArgumentException("Custom states excluded from this fixture");}
            public boolean preventLeafDecay(){return true;}
            public void reportError(String key,Throwable failure){throw new IllegalStateException(key,failure);}
            public void warnUnresolved(String key,String message){throw new IllegalArgumentException(message);}
            public void debug(String message){}
        });var merger=new NativeStateMerger(resolver);JsonArray output=new JsonArray();
        for(JsonElement value:JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray()){
            JsonObject request=value.getAsJsonObject();var base=NativeBlockResolver.strictParse(request.get("base").getAsString());
            var update=request.has("normalize")&&request.get("normalize").getAsBoolean()?ModdedBlockState.of(resolver.resolveGet(request.get("update").getAsString()).state(),null):NativeBlockResolver.strictParse(request.get("update").getAsString());
            var result=merger.merge(base,update);JsonObject row=new JsonObject();row.addProperty("state",result.key());if(request.has("match"))row.addProperty("match",NativeBlockResolver.strictParse(request.get("match").getAsString()).matches(result));output.add(row);
        }Files.writeString(Path.of(args[1]),new GsonBuilder().serializeNulls().create().toJson(output)+"\n");
    }
}
