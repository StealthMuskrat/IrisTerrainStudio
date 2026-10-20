// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.mantle.MantleWriter;
import art.arcane.volmlib.util.mantle.runtime.*;
import art.arcane.volmlib.util.matter.*;
import art.arcane.volmlib.util.matter.slices.CavernMatter;
import art.arcane.volmlib.util.io.CountingDataInputStream;
import art.arcane.volmlib.util.function.Consumer4;
import java.io.DataOutputStream;
import java.util.*;

/** A bounded ephemeral native Mantle chunk window. No region loading, persistence, or world access. */
public final class WorkerCaveStorage {
    private static MantleChunk<Matter> active;
    private static int height,chunkX,chunkZ;
    private static final Map<Long,MantleChunk<Matter>> chunks=new LinkedHashMap<>();
    public static void begin(int worldHeight,int x,int z){
        if(active!=null)throw new IllegalStateException("Nested worker cave storage");
        height=worldHeight;chunkX=x;chunkZ=z;
        active=new MantleChunk<>((worldHeight+15)/16,x,z,new CavernAdapter(),MantleHooks.NONE);chunks.put(key(x,z),active);
    }
    public static void clear(){active=null;height=0;chunks.clear();}
    public static void select(int x,int z){requireActive();if(chunks.size()>=5&&!chunks.containsKey(key(x,z)))throw new IllegalStateException("Cave window exceeds five chunks");active=chunks.computeIfAbsent(key(x,z),ignored->new MantleChunk<>((height+15)/16,x,z,new CavernAdapter(),MantleHooks.NONE));chunkX=x;chunkZ=z;}
    private static long key(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
    public static art.arcane.iris.generation.mantle.EngineMantle engineMantle(art.arcane.iris.generation.runtime.Engine ignored){requireActive();return null;}
    public static Mantle<Matter> getMantle(art.arcane.iris.generation.mantle.EngineMantle ignored){requireActive();return null;}
    public static art.arcane.volmlib.util.mantle.MantleChunk<Matter> useChunk(Mantle<?> ignored,int x,int z){MantleChunk<Matter> chunk=existingChunk(ignored,x,z);if(chunk==null)throw new IllegalStateException("Cave chunk is not prepared");return chunk.use();}
    public static MantleChunk<Matter> existingChunk(Mantle<?> ignored,int x,int z){requireActive();return chunks.get(key(x,z));}
    public static Mantle<Matter> getMantle(MantleWriter unused){requireActive();return null;}
    public static int getWorldHeight(Mantle<?> unused){requireActive();return height;}
    public static MantleChunk<Matter> acquireChunk(MantleWriter unused,int x,int z){requireActive();if(x!=chunkX||z!=chunkZ)throw studio.engine.UnsupportedPlatform.unavailable("Cave access outside the prepared chunk");return active;}
    public static MatterCavern get(int x,int y,int z){requireActive();return active.get(x,y,z,MatterCavern.class);}
    public static void requireNoSubterrain(art.arcane.iris.generation.mantle.MantleWriter ignored,int x,int z,art.arcane.iris.generation.runtime.IrisComplex complex){var planner=complex.getSubterrainPlanner();if(planner!=null&&!planner.isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Subterrain writes in the cave component stage");}
    private static void requireActive(){if(active==null)throw new IllegalStateException("No worker cave storage");}
    private static RuntimeException unsupported(){return studio.engine.UnsupportedPlatform.unavailable("Non-cavern Matter storage or persistence");}
    private static final class CavernSection implements Matter {
        private final MatterHeader header=new MatterHeader();
        private final Map<Class<?>,MatterSlice<?>> slices=new HashMap<>();
        public MatterHeader getHeader(){return header;}
        public int getWidth(){return 16;}public int getHeight(){return 16;}public int getDepth(){return 16;}
        public Map<Class<?>,MatterSlice<?>> getSliceMap(){return slices;}
        @SuppressWarnings("unchecked") public <T>MatterSlice<T> createSlice(Class<T> type,Matter matter){if(type!=MatterCavern.class)throw unsupported();return (MatterSlice<T>)new CavernMatter(16,16,16);}
    }
    private static final class CavernAdapter implements MantleDataAdapter<Matter> {
        public Matter createSection(){return new CavernSection();}
        public Matter readSection(CountingDataInputStream input){throw unsupported();}
        public void writeSection(Matter section,DataOutputStream output){throw unsupported();}
        public void trimSection(Matter section){section.trimSlices();}
        public boolean isSectionEmpty(Matter section){return section.isEmpty();}
        public Class<?> classifyValue(Object value){if(value instanceof MatterCavern)return MatterCavern.class;throw unsupported();}
        public <T>void set(Matter section,int x,int y,int z,Class<?> type,T value){section.<T>slice(type).set(x,y,z,value);}
        public <T>void remove(Matter section,int x,int y,int z,Class<T> type){MatterSlice<T> slice=section.getSlice(type);if(slice!=null)slice.set(x,y,z,null);}
        public <T>T get(Matter section,int x,int y,int z,Class<T> type){MatterSlice<T> slice=section.getSlice(type);return slice==null?null:slice.get(x,y,z);}
        public <T>void iterate(Matter section,Class<T> type,Consumer4<Integer,Integer,Integer,T> consumer){MatterSlice<T> slice=section.getSlice(type);if(slice!=null)slice.iterate(consumer);}
        public boolean hasSlice(Matter section,Class<?> type){return section.hasSlice(type);}
        public void deleteSlice(Matter section,Class<?> type){section.deleteSlice(type);}
    }
}
