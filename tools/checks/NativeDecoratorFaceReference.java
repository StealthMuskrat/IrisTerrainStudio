// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.*;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import com.google.gson.*;
import java.nio.file.*;

/** A few supplied native neighbor states; original NativeBlockFaces is the reference algorithm. */
public final class NativeDecoratorFaceReference {
    public static void main(String[] args)throws Exception{
        HeadlessNativeBootstrap.initialize();java.util.function.Function<String,NativeBlockState> resolver=NativeBlockResolver::strictParse;JsonArray requests=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray(),results=new JsonArray();
        for(JsonElement element:requests){var row=element.getAsJsonObject();var source=resolver.apply(row.get("key").getAsString());var input=row.getAsJsonObject("neighbors");int x=input.get("x").getAsInt()&15,y=input.get("y").getAsInt(),z=input.get("z").getAsInt()&15;
            var result=NativeBlockFaces.fixFaces(source,new NativeBlockFaces.Neighbors(){
                private NativeBlockState find(String field,int dx,int dy,int dz){for(JsonElement element:input.getAsJsonArray(field)){var value=element.getAsJsonArray();if(value.get(0).getAsInt()==dx&&value.get(1).getAsInt()==dy&&value.get(2).getAsInt()==dz)return resolver.apply(value.get(3).getAsString());}return resolver.apply("minecraft:air");}
                public NativeBlockState primary(int dx,int dy,int dz){return find("primary",dx,dy,dz);}
                public NativeBlockState secondary(int dx,int dy,int dz){return x+dx<0||x+dx>15||z+dz<0||z+dz>15||y+dy<0||y+dy>=16?null:find("secondary",dx,dy,dz);}
            });results.add(result.key());
        }Files.writeString(Path.of(args[1]),new Gson().toJson(results)+"\n");
    }
}
