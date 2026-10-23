// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.runtime.Engine;
import art.arcane.iris.generation.block.BoundBlockState;
import art.arcane.iris.studio.generation.BiomeBuffetLayout;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import com.google.gson.stream.JsonWriter;
import java.io.IOException;

/** Explicit compatibility boundary for the original Bukkit studio biome-layout branch. */
public final class WorkerStudioLayout {
    private static final BoundBlockState FLOOR=BoundBlockState.of("BARRIER");
    // Called only at the pinned IrisComplex constructor's "bukkit" platform predicate.
    // Platform identity remains browser-worker everywhere, including diagnostics.
    public static boolean acceptsHost(String expected,Object actual){return expected.equals(actual)||"bukkit".equals(expected)&&"browser-worker".equals(actual);}
    private static BiomeBuffetLayout layout(Engine engine){return engine.isStudio()?engine.getComplex().getBiomeBuffet():null;}
    public static void describe(Engine engine,JsonWriter writer)throws IOException{
        var mode=engine.getDimension().getStudioMode();var layout=layout(engine);int count=layout==null?0:layout.cells().size(),width=count==0?0:Math.max((int)Math.sqrt(count),1);
        writer.name("studioLayout").beginObject();writer.name("requested").value(engine.isStudio());writer.name("authoredFocus").value(engine.getDimension().getFocus());writer.name("mode").value(mode==null?null:mode.name());writer.name("active").value(count>0);writer.name("biomeSizeChunks").value(mode==null?0:mode.biomeSizeChunks());writer.name("cellCount").value(count);writer.name("width").value(width);writer.name("rows").value(width==0?0:Math.ceilDiv(count,width));writer.name("scalarOutside").value("native-first-cell-fallback");writer.name("voxelOutside").value("native-studio-barrier-at-world-y-zero");writer.endObject();
    }
    /** Original BiomeBuffetGenerator outside-cell writer semantics over owned block arrays. */
    public static String outsideFloor(BrowserTerrainEngine engine,int x,int z)throws IOException{
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984)throw new IllegalArgumentException("Studio chunk exceeds worker world-coordinate bounds");
        var layout=layout(engine);if(layout==null||layout.cells().isEmpty()||layout.chunk(x>>4,z>>4)!=null)return "null";
        var blocks=new ArrayHunk<NativeBlockState>(16,engine.getHeight(),16);blocks.fill(IrisPlatforms.get().registries().air());
        // tc.setRegion(0,0,0,16,1,16,FLOOR) uses absolute Bukkit world Y, not dimension minY.
        try(var lease=engine.acquireGenerationLease("browser_biome_buffet_outside");var scope=art.arcane.iris.generation.context.IrisContext.open(engine,lease.sessionId(),null)){
            int y=-engine.getMinHeight();if(y>=0&&y<engine.getHeight()){var floor=FLOOR.get();for(int z1=0;z1<16;z1++)for(int x1=0;x1<16;x1++)blocks.setRaw(x1,y,z1,floor);}
        }catch(art.arcane.iris.generation.runtime.GenerationSessionException failure){throw new IOException("Studio floor session failed",failure);}
        // The original outside branch never invokes the biome actuator. Do not fabricate a biome buffer.
        String result=TerrainPaintStage.serialize(engine,x,z,blocks,"native-studio-buffet-outside-development");
        return result.substring(0,result.length()-1)+",\"studioOutsideLayout\":true,\"floorWorldY\":0,\"mode\":\""+engine.getDimension().getMode().getType().name()+"\",\"activeLeasesAfter\":"+engine.getGenerationSessions().activeLeases()+",\"nativeStudioGeneratorExecuted\":false}";
    }
}
