// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import art.arcane.iris.generation.runtime.*;
import art.arcane.iris.generation.mantle.EngineMantle;
import art.arcane.iris.generation.mantle.TerrainMatterView;
import art.arcane.volmlib.util.mantle.runtime.Mantle;
import art.arcane.volmlib.util.matter.Matter;
import art.arcane.volmlib.util.mantle.flag.MantleFlag;
import studio.engine.terrain.*;

/** Temporary owned native carving inputs for hydrology containment, with sparse admission. */
public final class WorkerHydrologyMatter implements AutoCloseable {
    private static WorkerHydrologyMatter active;
    private final java.util.Set<Long> carvingChunks=new java.util.HashSet<>();
    private final BrowserTerrainEngine engine;private IrisEngineMantle host;
    private boolean bound,runtime,storage;
    private WorkerHydrologyMatter(BrowserTerrainEngine engine){this.engine=engine;}
    public static WorkerHydrologyMatter open(BrowserTerrainEngine engine,int x,int z){
        if(active!=null)throw new IllegalStateException("Nested hydrology matter scope");
        var owned=new WorkerHydrologyMatter(engine);
        try{
            WorkerMatterRuntime.begin(engine);owned.runtime=true;
            owned.host=new IrisEngineMantle(engine,(java.nio.file.Path)null);engine.bindNativeMatter(owned.host);owned.bound=true;
            WorkerCaveStorage.begin(engine.getHeight(),x>>4,z>>4,256);owned.storage=true;active=owned;return owned;
        }catch(RuntimeException|Error failure){try{owned.close();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}throw failure;}
    }
    /** Borrow the existing registered mode's host/storage; this scope owns only hydrology admission. */
    public static WorkerHydrologyMatter attach(BrowserTerrainEngine engine,IrisEngineMantle host){
        if(active!=null)throw new IllegalStateException("Nested hydrology matter scope");
        if(engine.getMantle()!=host||WorkerCaveStorage.getWorldHeight(null)!=engine.getHeight())throw new IllegalStateException("Hydrology matter requires its prepared native mode host");
        var owned=new WorkerHydrologyMatter(engine);owned.host=host;active=owned;return owned;
    }
    public static int admittedChunks(){return active==null?0:active.carvingChunks.size();}
    public static long chargedCells(){return active==null?0:(long)active.carvingChunks.size()*active.engine.getHeight()*256;}
    public static Object storageHandle(Object handle){WorkerCaveStorage.getWorldHeight(null);return handle;}
    public static void prepareCarvingInput(int x,int z){
        if(active==null)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology carving outside its owned matter scope");
        if(Math.abs((long)x*16)>29999984||Math.abs((long)z*16)>29999984)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology carving input exceeds worker coordinates");
        long key=((long)x<<32)|(z&0xffffffffL);
        if(!active.carvingChunks.contains(key)&&((long)active.carvingChunks.size()+1)*active.engine.getHeight()*256>16777216)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology carving input exceeds its 16,777,216-cell admission budget");
        WorkerCaveStorage.select(x,z);active.carvingChunks.add(key);
    }
    public static boolean hasFlag(Mantle<?> token,int x,int z,MantleFlag flag){var chunk=WorkerCaveStorage.existingChunk(token,x,z);return chunk!=null&&chunk.isFlagged(flag);}
    public static <T>T terrainMatter(Mantle<Matter> token,int x,int y,int z,Class<T> type){
        if(y<0||y>=WorkerCaveStorage.getWorldHeight(token))return null;
        WorkerCaveStorage.requirePrepared(x>>4,z>>4);return TerrainMatterView.get(WorkerCaveStorage.existingChunk(token,x>>4,z>>4),x,y,z,type);
    }
    @Override public void close(){try{if(bound){engine.unbindNativeMatter(host);bound=false;}}finally{try{if(storage){WorkerCaveStorage.clear();storage=false;}}finally{if(active==this)active=null;if(runtime){WorkerMatterRuntime.end();runtime=false;}}}}
}
