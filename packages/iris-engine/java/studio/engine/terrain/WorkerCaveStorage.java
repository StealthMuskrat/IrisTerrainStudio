// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.mantle.MantleWriter;
import art.arcane.volmlib.util.mantle.runtime.*;
import art.arcane.volmlib.util.matter.*;
import art.arcane.volmlib.util.matter.slices.CavernMatter;
import art.arcane.volmlib.util.matter.slices.MarkerMatter;
import art.arcane.volmlib.util.io.CountingDataInputStream;
import art.arcane.volmlib.util.function.Consumer4;
import java.io.DataOutputStream;
import java.util.*;

/** A bounded ephemeral native Mantle chunk window. No region loading, persistence, or world access. */
public final class WorkerCaveStorage {
    private static MantleChunk<Matter> active;
    private static int height,chunkX,chunkZ,chunkLimit;
    private static final Map<Long,MantleChunk<Matter>> chunks=new LinkedHashMap<>();
    public static void begin(int worldHeight,int x,int z){begin(worldHeight,x,z,5);}
    public static void begin(int worldHeight,int x,int z,int limit){
        if(limit!=5&&limit!=9)throw new IllegalArgumentException("Invalid worker chunk window");chunkLimit=limit;
        if(active!=null)throw new IllegalStateException("Nested worker cave storage");
        height=worldHeight;chunkX=x;chunkZ=z;
        active=new MantleChunk<>((worldHeight+15)/16,x,z,new CavernAdapter(),MantleHooks.NONE);chunks.put(key(x,z),active);
    }
    public static void requirePrepared(int x,int z){requireActive();if(!chunks.containsKey(key(x,z)))throw studio.engine.UnsupportedPlatform.unavailable("Object access outside the prepared three-by-three chunk window");}
    public static void clear(){active=null;height=0;chunks.clear();}
    public static void select(int x,int z){requireActive();if(chunks.size()>=chunkLimit&&!chunks.containsKey(key(x,z)))throw new IllegalStateException("Worker window exceeds its chunk budget");active=chunks.computeIfAbsent(key(x,z),ignored->new MantleChunk<>((height+15)/16,x,z,new CavernAdapter(),MantleHooks.NONE));chunkX=x;chunkZ=z;}
    private static long key(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
    public static art.arcane.iris.generation.mantle.EngineMantle engineMantle(art.arcane.iris.generation.runtime.Engine ignored){requireActive();return null;}
    public static Mantle<Matter> getMantle(art.arcane.iris.generation.mantle.EngineMantle ignored){requireActive();return null;}
    public static art.arcane.volmlib.util.mantle.MantleChunk<Matter> useChunk(Mantle<?> ignored,int x,int z){MantleChunk<Matter> chunk=existingChunk(ignored,x,z);if(chunk==null)throw new IllegalStateException("Cave chunk is not prepared");return chunk.use();}
    public static MantleChunk<Matter> existingChunk(Mantle<?> ignored,int x,int z){requireActive();return chunks.get(key(x,z));}
    public static Mantle<Matter> getMantle(MantleWriter unused){requireActive();return null;}
    public static int getWorldHeight(Mantle<?> unused){requireActive();return height;}
    public static MantleChunk<Matter> acquireChunk(MantleWriter unused,int x,int z){requireActive();if(x!=chunkX||z!=chunkZ)throw studio.engine.UnsupportedPlatform.unavailable("Cave access outside the prepared chunk");return active;}
    public static void setMarker(Mantle<?> ignored,int x,int y,int z,Object value){requireActive();if(!(value instanceof MatterMarker marker))throw unsupported();if(y<0||y>=height)return;MantleChunk<Matter> chunk=existingChunk(ignored,x>>4,z>>4);if(chunk==null)throw studio.engine.UnsupportedPlatform.unavailable("Cave marker writes outside the prepared window");chunk.getOrCreate(y>>4).<MatterMarker>slice(MatterMarker.class).set(x&15,y&15,z&15,marker);}
    public static String markerEntries()throws java.io.IOException{requireActive();var output=new java.io.StringWriter();try(var writer=new com.google.gson.stream.JsonWriter(output)){writer.beginArray();for(int y=0;y<height;y++)for(int z=0;z<16;z++)for(int x=0;x<16;x++){MatterMarker marker=active.get(x,y,z,MatterMarker.class);if(marker!=null){writer.beginArray();writer.value(x);writer.value(y);writer.value(z);writer.value(marker.getTag());writer.endArray();}}writer.endArray();}return output.toString();}
    public static int journalCellCount(){requireActive();int[] count={0};for(int section=0;section<(height+15)/16;section++)if(active.exists(section)){var slice=active.get(section).getSlice(art.arcane.iris.world.storage.matter.PreObjectMatterCell.class);if(slice!=null)slice.iterate((x,y,z,value)->count[0]++);}return count[0];}
    public static MatterCavern get(int x,int y,int z){requireActive();return active.get(x,y,z,MatterCavern.class);}
    public static void requireNoSubterrain(art.arcane.iris.generation.mantle.MantleWriter ignored,int x,int z,art.arcane.iris.generation.runtime.IrisComplex complex){var planner=complex.getSubterrainPlanner();if(planner!=null&&!planner.isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Subterrain writes in the cave component stage");}
    private static Class<?> valueType(Object value){if(value instanceof MatterCavern)return MatterCavern.class;if(value instanceof MatterMarker)return MatterMarker.class;if(value instanceof art.arcane.volmlib.nativelib.terrain.NativeBlockState)return art.arcane.volmlib.nativelib.terrain.NativeBlockState.class;if(value instanceof String)return String.class;if(value instanceof art.arcane.iris.world.storage.matter.PreObjectMatterCell)return art.arcane.iris.world.storage.matter.PreObjectMatterCell.class;if(value instanceof art.arcane.iris.generation.decoration.tree.TreeBlockMaterial)return art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class;if(value instanceof art.arcane.iris.integration.Identifier)return art.arcane.iris.integration.Identifier.class;throw unsupported();}
    private static void requireActive(){if(active==null)throw new IllegalStateException("No worker cave storage");}
    private static RuntimeException unsupported(){return studio.engine.UnsupportedPlatform.unavailable("Unconnected Matter value type or persistence");}
    private static final class CavernSection implements Matter {
        private final MatterHeader header=new MatterHeader();
        private final Map<Class<?>,MatterSlice<?>> slices=new HashMap<>();
        public Class<?> getClass(Object value){return valueType(value);}
        public MatterHeader getHeader(){return header;}
        public int getWidth(){return 16;}public int getHeight(){return 16;}public int getDepth(){return 16;}
        public Map<Class<?>,MatterSlice<?>> getSliceMap(){return slices;}
        @SuppressWarnings("unchecked") public <T>MatterSlice<T> createSlice(Class<T> type,Matter matter){if(type==String.class)return (MatterSlice<T>)new art.arcane.volmlib.util.matter.slices.StringMatter(16,16,16);if(type==art.arcane.iris.world.storage.matter.PreObjectMatterCell.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.PreObjectMatter(16,16,16);if(type==art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.TreeBlockMaterialMatter(16,16,16);if(type==art.arcane.iris.integration.Identifier.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.IdentifierMatter(16,16,16);if(type==MatterCavern.class)return (MatterSlice<T>)new CavernMatter(16,16,16);if(type==art.arcane.volmlib.nativelib.terrain.NativeBlockState.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.PlatformBlockMatter(16,16,16);if(type==MatterMarker.class)return (MatterSlice<T>)new MarkerMatter(16,16,16);throw unsupported();}
    }
    private static final class CavernAdapter implements MantleDataAdapter<Matter> {
        public Matter createSection(){return new CavernSection();}
        public Matter readSection(CountingDataInputStream input){throw unsupported();}
        public void writeSection(Matter section,DataOutputStream output){throw unsupported();}
        public void trimSection(Matter section){section.trimSlices();}
        public boolean isSectionEmpty(Matter section){return section.isEmpty();}
        public Class<?> classifyValue(Object value){return valueType(value);}
        public <T>void set(Matter section,int x,int y,int z,Class<?> type,T value){section.<T>slice(type).set(x,y,z,value);}
        public <T>void remove(Matter section,int x,int y,int z,Class<T> type){MatterSlice<T> slice=section.getSlice(type);if(slice!=null)slice.set(x,y,z,null);}
        public <T>T get(Matter section,int x,int y,int z,Class<T> type){MatterSlice<T> slice=section.getSlice(type);return slice==null?null:slice.get(x,y,z);}
        public <T>void iterate(Matter section,Class<T> type,Consumer4<Integer,Integer,Integer,T> consumer){MatterSlice<T> slice=section.getSlice(type);if(slice!=null)slice.iterate(consumer);}
        public boolean hasSlice(Matter section,Class<?> type){return section.hasSlice(type);}
        public void deleteSlice(Matter section,Class<?> type){section.deleteSlice(type);}
    }
}
