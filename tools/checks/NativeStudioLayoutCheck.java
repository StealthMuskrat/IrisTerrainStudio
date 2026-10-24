// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.iris.generation.runtime.Engine;
import art.arcane.iris.generation.context.*;
import art.arcane.iris.generation.chunk.TerrainChunk;
import art.arcane.iris.studio.generation.BiomeBuffetGenerator;
import art.arcane.iris.generation.stage.*;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import art.arcane.volmlib.nativelib.terrain.*;
import com.google.gson.*;
import java.lang.reflect.Proxy;

/** Original native studio streams/writer; owned probes, no Bukkit world or block-data buffer. */
public final class NativeStudioLayoutCheck {
    public static JsonObject inspect(Engine engine,JsonObject request)throws Exception{
        JsonObject result=new JsonObject();var layout=engine.getComplex().getBiomeBuffet();
        result.addProperty("active",layout!=null&&!layout.cells().isEmpty());result.addProperty("authoredFocus",engine.getDimension().getFocus());
        result.addProperty("mode",engine.getDimension().getStudioMode().name());JsonArray keys=new JsonArray();if(layout!=null)for(var cell:layout.cells())keys.add(cell.biome().getLoadKey());result.add("cells",keys);
        JsonArray paintings=new JsonArray();
        for(var item:request.getAsJsonArray("paint")){
            var row=item.getAsJsonObject();int x=row.get("x").getAsInt(),z=row.get("z").getAsInt();var blocks=new ArrayHunk<NativeBlockState>(16,engine.getHeight(),16);blocks.fill(IrisPlatforms.get().registries().air());var biomes=new ArrayHunk<NativeBiome>(16,engine.getHeight(),16);var context=new ChunkContext(x,z,engine.getComplex(),false);context.setTerrainBiomeOutput(biomes);
            try(var scope=IrisContext.open(engine,engine.getGenerationSessionId(),context)){new IrisBiomeActuator(engine).onActuate(x,z,biomes,false,context);new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);}
            JsonObject painting=new JsonObject();painting.addProperty("x",x);painting.addProperty("z",z);JsonArray probes=new JsonArray();for(var item2:row.getAsJsonArray("probes")){var p=item2.getAsJsonArray();int lx=p.get(0).getAsInt(),y=p.get(1).getAsInt(),lz=p.get(2).getAsInt();var probe=p.deepCopy();probe.add(blocks.getRaw(lx,y,lz).key());probe.add(biomes.getRaw(lx,y,lz).key());probes.add(probe);}painting.add("probes",probes);paintings.add(painting);
        }result.add("paint",paintings);
        JsonArray floors=new JsonArray();
        for(var item:request.getAsJsonArray("outside")){
            var point=item.getAsJsonArray();int x=point.get(0).getAsInt(),z=point.get(1).getAsInt();if(layout==null||layout.chunk(x,z)!=null)throw new IllegalArgumentException("Reference floor probe must be outside the layout");
            JsonArray calls=new JsonArray();int[] biomeWrites={0};
            TerrainChunk chunk=(TerrainChunk)Proxy.newProxyInstance(TerrainChunk.class.getClassLoader(),new Class<?>[]{TerrainChunk.class},(self,method,args)->switch(method.getName()){
                case "getMinHeight"->engine.getMinHeight();case "getMaxHeight"->engine.getMaxHeight();
                case "setRegion"->{JsonArray call=new JsonArray();for(int i=0;i<6;i++)call.add((Integer)args[i]);call.add(((NativeBlockState)args[6]).key());calls.add(call);yield null;}
                case "setBiome"->{biomeWrites[0]++;yield null;}
                default->throw new UnsupportedOperationException("Unexpected studio floor buffer method: "+method);
            });
            var previous=IrisContext.get();new BiomeBuffetGenerator(engine).generateChunk(engine,chunk,x,z);
            JsonObject floor=new JsonObject();floor.add("chunk",point.deepCopy());floor.add("regionCalls",calls);floor.addProperty("biomeWrites",biomeWrites[0]);floor.addProperty("activeLeasesAfter",engine.getGenerationSessions().activeLeases());floor.addProperty("scopeRestored",IrisContext.get()==previous);floors.add(floor);
        }result.add("outside",floors);return result;
    }
}
