// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import studio.engine.registry.BrowserRegistries;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import com.google.gson.stream.JsonReader;
import java.io.*;
import java.util.*;

/** Bounded diagnostic of the real decorator hook, including primary matter and secondary hunk reads. */
public final class DecoratorFaceDiagnostic {
    private record Neighbor(int dx,int dy,int dz,String state){}
    private static List<Neighbor> read(JsonReader reader)throws IOException{
        List<Neighbor> result=new ArrayList<>();reader.beginArray();while(reader.hasNext()){
            if(result.size()>=6)throw new IllegalArgumentException("At most six decorator neighbors required");reader.beginArray();int dx=reader.nextInt(),dy=reader.nextInt(),dz=reader.nextInt();String key=reader.nextString();reader.endArray();
            if(Math.abs((long)dx)+Math.abs((long)dy)+Math.abs((long)dz)!=1)throw new IllegalArgumentException("Only immediate face neighbors allowed");result.add(new Neighbor(dx,dy,dz,key));
        }reader.endArray();return result;
    }
    public static String run(BrowserRegistries registry,String key,String input)throws IOException{
        if(input==null||input.length()>8192)throw new IllegalArgumentException("Decorator diagnostic exceeds its input budget");
        int x=-1,y=-1,z=-1;List<Neighbor> primary=null,secondary=null;
        try(JsonReader reader=new JsonReader(new StringReader(input))){reader.beginObject();while(reader.hasNext())switch(reader.nextName()){
            case"x"->x=reader.nextInt();case"y"->y=reader.nextInt();case"z"->z=reader.nextInt();case"primary"->primary=read(reader);case"secondary"->secondary=read(reader);default->reader.skipValue();
        }reader.endObject();if(reader.peek()!=com.google.gson.stream.JsonToken.END_DOCUMENT)throw new IllegalArgumentException("Trailing decorator diagnostic input");}
        if(primary==null||secondary==null)throw new IllegalArgumentException("Both decorator neighbor layers required");
        if(x<0||x>31||z<0||z>31||y<1||y>14)throw new IllegalArgumentException("Decorator diagnostic exceeds its small window");
        var source=registry.decodeBlockState(key);var blocks=new ArrayHunk<NativeBlockState>(16,16,16);blocks.fill(registry.air());
        int cx=x>>4,cz=z>>4;WorkerCaveStorage.begin(16,cx,cz,9);
        try{
            for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)WorkerCaveStorage.select(cx+dx,cz+dz);
            for(String field:new String[]{"primary","secondary"}){
                for(Neighbor row:field.equals("primary")?primary:secondary){int dx=row.dx(),dy=row.dy(),dz=row.dz();var state=registry.decodeBlockState(row.state());
                    if(field.equals("primary")){int xx=x+dx,yy=y+dy,zz=z+dz;WorkerCaveStorage.existingChunk(null,xx>>4,zz>>4).getOrCreate(yy>>4).<NativeBlockState>slice(NativeBlockState.class).set(xx&15,yy&15,zz&15,state);}
                    else{int xx=(x&15)+dx,zz=(z&15)+dz;if(xx<0||xx>15||zz<0||zz>15)throw new IllegalArgumentException("Secondary diagnostic neighbor is outside its hunk");blocks.set(xx,y+dy,zz,state);}
                }
            }
            WorkerCaveStorage.select(cx,cz);
            var hook=new WorkerDecoratorHooks(registry);var host=new WorkerCarvingMantle(null);
            return hook.fixFaces(source,blocks,x&15,z&15,x,y,z,host).key();
        }finally{WorkerCaveStorage.clear();}
    }
}
