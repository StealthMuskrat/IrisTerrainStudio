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
    private static long subterrainWork;
    private static final long SUBTERRAIN_WORK_LIMIT=16777216;
    private static final Map<Long,MantleChunk<Matter>> chunks=new LinkedHashMap<>();
    public static void begin(int worldHeight,int x,int z){begin(worldHeight,x,z,5);}
    public static void begin(int worldHeight,int x,int z,int limit){
        if(limit!=5&&limit!=9&&limit!=25&&limit!=49)throw new IllegalArgumentException("Invalid worker chunk window");chunkLimit=limit;
        if(active!=null)throw new IllegalStateException("Nested worker cave storage");
        height=worldHeight;chunkX=x;chunkZ=z;subterrainWork=0;
        active=new MantleChunk<>((worldHeight+15)/16,x,z,new CavernAdapter(),MantleHooks.NONE);chunks.put(key(x,z),active);
    }
    public static void requirePrepared(int x,int z){requireActive();if(!chunks.containsKey(key(x,z)))throw studio.engine.UnsupportedPlatform.unavailable("Object access outside the prepared chunk window");}
    public static void clear(){active=null;height=0;subterrainWork=0;chunks.clear();}
    public static void select(int x,int z){requireActive();if(chunks.size()>=chunkLimit&&!chunks.containsKey(key(x,z)))throw new IllegalStateException("Worker window exceeds its chunk budget");active=chunks.computeIfAbsent(key(x,z),ignored->new MantleChunk<>((height+15)/16,x,z,new CavernAdapter(),MantleHooks.NONE));chunkX=x;chunkZ=z;}
    private static long key(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
    public static art.arcane.iris.generation.mantle.EngineMantle engineMantle(art.arcane.iris.generation.runtime.Engine ignored){requireActive();return null;}
    public static Mantle<Matter> getMantle(art.arcane.iris.generation.mantle.EngineMantle ignored){requireActive();return null;}
    public static art.arcane.volmlib.util.mantle.MantleChunk<Matter> useChunk(Mantle<?> ignored,int x,int z){MantleChunk<Matter> chunk=existingChunk(ignored,x,z);if(chunk==null)throw new IllegalStateException("Cave chunk is not prepared");return chunk.use();}
    public static MantleChunk<Matter> existingChunk(Mantle<?> ignored,int x,int z){requireActive();return chunks.get(key(x,z));}
    public static Mantle<Matter> getMantle(MantleWriter unused){requireActive();return null;}
    public static int getWorldHeight(Mantle<?> unused){requireActive();return height;}
    public static MantleChunk<Matter> acquireChunk(MantleWriter unused,int x,int z){requirePrepared(x,z);return chunks.get(key(x,z));}
    public static void getChunks(Mantle<?> ignored,int minX,int maxX,int minZ,int maxZ,int parallelism,art.arcane.volmlib.util.function.Consumer3<Integer,Integer,MantleChunk<Matter>> consumer){
        requireActive();if(minX>maxX||minZ>maxZ||(long)(maxX-minX+1)*(maxZ-minZ+1)>49)throw studio.engine.UnsupportedPlatform.unavailable("Native matter prefetch exceeds its prepared chunk budget");
        for(int x=minX;x<=maxX;x++)for(int z=minZ;z<=maxZ;z++){requirePrepared(x,z);consumer.accept(x,z,chunks.get(key(x,z)));}
    }
    public static String flagWindow()throws java.io.IOException{
        requireActive();var output=new java.io.StringWriter();try(var writer=new com.google.gson.stream.JsonWriter(output)){writer.beginArray();for(var chunk:chunks.values()){
            boolean carved=chunk.isFlagged(art.arcane.volmlib.util.mantle.flag.ReservedFlag.CARVED),planned=chunk.isFlagged(art.arcane.volmlib.util.mantle.flag.MantleFlag.PLANNED);
            if(carved||planned){writer.beginArray();writer.value(chunk.getX());writer.value(chunk.getZ());writer.value(carved);writer.value(planned);writer.endArray();}
        }writer.endArray();}return output.toString();
    }
    public static void setMarker(Mantle<?> ignored,int x,int y,int z,Object value){requireActive();if(!(value instanceof MatterMarker marker))throw unsupported();if(y<0||y>=height)return;MantleChunk<Matter> chunk=existingChunk(ignored,x>>4,z>>4);if(chunk==null)throw studio.engine.UnsupportedPlatform.unavailable("Cave marker writes outside the prepared window");chunk.getOrCreate(y>>4).<MatterMarker>slice(MatterMarker.class).set(x&15,y&15,z&15,marker);}
    public static String componentFlags()throws java.io.IOException{
        requireActive();var flags=new art.arcane.volmlib.util.mantle.flag.MantleFlag[]{art.arcane.volmlib.util.mantle.flag.ReservedFlag.CARVED,art.arcane.volmlib.util.mantle.flag.ReservedFlag.OBJECT,art.arcane.volmlib.util.mantle.flag.ReservedFlag.FLOATING_OBJECT,art.arcane.volmlib.util.mantle.flag.ReservedFlag.JIGSAW,art.arcane.volmlib.util.mantle.flag.MantleFlag.PLANNED};
        var output=new java.io.StringWriter();try(var writer=new com.google.gson.stream.JsonWriter(output)){writer.beginArray();for(var chunk:chunks.values()){
            boolean any=false;for(var flag:flags)any|=chunk.isFlagged(flag);if(!any)continue;
            writer.beginArray();writer.value(chunk.getX());writer.value(chunk.getZ());for(var flag:flags)writer.value(chunk.isFlagged(flag));writer.endArray();
        }writer.endArray();}return output.toString();
    }
    public static art.arcane.volmlib.util.mantle.MantleChunk<Matter> customChunk(Mantle<?> ignored,int x,int z){
        var chunk=existingChunk(ignored,x,z);if(chunk==null)throw new IllegalStateException("Custom stage chunk is not prepared");
        if(chunk.isFlagged(art.arcane.volmlib.util.mantle.flag.MantleFlag.CUSTOM_ACTIVE))throw studio.engine.UnsupportedPlatform.unavailable("Native custom block contributions");return chunk.use();
    }
    private record MarkerEntry(int x,int y,int z,String tag){}
    public static String markerEntries()throws java.io.IOException{
        requireActive();List<MarkerEntry> entries=new ArrayList<>();
        for(int section=0;section<(height+15)/16;section++)if(active.exists(section)){
            var slice=active.get(section).getSlice(MatterMarker.class);int baseY=section<<4;
            if(slice!=null)slice.iterate((x,y,z,marker)->entries.add(new MarkerEntry(x,baseY+y,z,marker.getTag())));
        }
        entries.sort(Comparator.comparingInt(MarkerEntry::y).thenComparingInt(MarkerEntry::z).thenComparingInt(MarkerEntry::x));
        var output=new java.io.StringWriter();try(var writer=new com.google.gson.stream.JsonWriter(output)){
            writer.beginArray();for(var entry:entries){writer.beginArray();writer.value(entry.x());writer.value(entry.y());writer.value(entry.z());writer.value(entry.tag());writer.endArray();}writer.endArray();
        }return output.toString();
    }
    private static int journalCellCount(MantleChunk<Matter> chunk){
        int[] count={0};for(int section=0;section<(height+15)/16;section++)if(chunk.exists(section)){var slice=chunk.get(section).getSlice(art.arcane.iris.world.storage.matter.PreObjectMatterCell.class);if(slice!=null)slice.iterate((x,y,z,value)->count[0]++);}return count[0];
    }
    public static int journalCellCount(){requireActive();return journalCellCount(active);}
    public static String journalWindow()throws java.io.IOException{
        requireActive();var output=new java.io.StringWriter();try(var writer=new com.google.gson.stream.JsonWriter(output)){
            writer.beginArray();for(var entry:chunks.entrySet()){int count=journalCellCount(entry.getValue());if(count==0)continue;writer.beginArray();writer.value((int)(entry.getKey()>>32));writer.value((int)(long)entry.getKey());writer.value(count);writer.endArray();}writer.endArray();
        }return output.toString();
    }
    public static String objectTags(){
        requireActive();Set<String> placements=new HashSet<>();int[] counts={0,0};
        for(int section=0;section<(height+15)/16;section++)if(active.exists(section)){
            var matter=active.get(section);var strings=matter.getSlice(String.class);var trees=matter.getSlice(art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class);
            if(strings!=null)strings.iterate((x,y,z,value)->{counts[0]++;placements.add(value);});
            if(trees!=null)trees.iterate((x,y,z,value)->counts[1]++);
        }
        return "{\"cells\":"+counts[0]+",\"placements\":"+placements.size()+",\"treeMaterials\":"+counts[1]+"}";
    }
    public static void restoreContinuations(studio.engine.matter.WorkerContinuationStore store,Object owner)throws java.io.IOException{
        requireActive();for(long key:store.keys(owner)){var chunk=chunks.get(key);if(chunk==null)continue;var bundle=store.get(owner,(int)(key>>32),(int)key);if(bundle!=null)chunk.getOrCreate(0).<art.arcane.iris.generation.mantle.ObjectContinuationBundle>slice(art.arcane.iris.generation.mantle.ObjectContinuationBundle.class).set(0,0,0,bundle);}
    }
    public static void retainContinuations(studio.engine.matter.WorkerContinuationStore store,Object owner)throws java.io.IOException{
        requireActive();for(var chunk:chunks.values())if(chunk.exists(0)){var slice=chunk.get(0).getSlice(art.arcane.iris.generation.mantle.ObjectContinuationBundle.class);if(slice!=null){var bundle=slice.get(0,0,0);if(bundle!=null)store.put(owner,chunk.getX(),chunk.getZ(),bundle);}}
    }
    public static <T>T get(Mantle<?> unused,int x,int y,int z,Class<T> type){
        requireActive();if(y<0||y>=height)return null;var chunk=chunks.get(key(x>>4,z>>4));if(chunk==null)throw studio.engine.UnsupportedPlatform.unavailable("Decorator neighbor outside the prepared matter window");return chunk.get(x&15,y,z&15,type);
    }
    public static MatterCavern get(int x,int y,int z){requireActive();return active.get(x,y,z,MatterCavern.class);}
    /** Admission only: the original rasterizer still selects plans and evaluates every cell. */
    public static void admitSubterrain(art.arcane.iris.generation.subterrain.SubterrainPlanner planner,int x,int z){
        requirePrepared(x,z);var plans=planner.plansForBounds((x<<4)-1,(z<<4)-1,(x<<4)+16,(z<<4)+16);if(plans.isEmpty())return;
        long low=Long.MAX_VALUE,high=Long.MIN_VALUE;for(var plan:plans){low=Math.min(low,plan.bounds().minY());high=Math.max(high,plan.bounds().maxY());}
        // Include the six neighboring samples used by the native fluid-seal rule.
        long work=256L*(high-low+1)*plans.size()*7L;
        if(work>SUBTERRAIN_WORK_LIMIT-subterrainWork)throw new IllegalArgumentException("Subterrain preview exceeds its bounded native sampling budget");subterrainWork+=work;
    }
    public static long subterrainWork(){requireActive();return subterrainWork;}

    private static Class<?> valueType(Object value){if(value instanceof art.arcane.iris.generation.mantle.ObjectContinuationBundle)return art.arcane.iris.generation.mantle.ObjectContinuationBundle.class;if(value instanceof MatterCavern)return MatterCavern.class;if(value instanceof MatterMarker)return MatterMarker.class;if(value instanceof art.arcane.volmlib.nativelib.terrain.NativeBlockState)return art.arcane.volmlib.nativelib.terrain.NativeBlockState.class;if(value instanceof String)return String.class;if(value instanceof art.arcane.iris.world.storage.matter.PreObjectMatterCell)return art.arcane.iris.world.storage.matter.PreObjectMatterCell.class;if(value instanceof art.arcane.iris.generation.decoration.tree.TreeBlockMaterial)return art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class;if(value instanceof art.arcane.iris.integration.Identifier)return art.arcane.iris.integration.Identifier.class;throw unsupported();}
    private static void requireActive(){if(active==null)throw new IllegalStateException("No worker cave storage");}
    private static RuntimeException unsupported(){return studio.engine.UnsupportedPlatform.unavailable("Unconnected Matter value type or persistence");}
    private static final class CavernSection implements Matter {
        private final MatterHeader header=new MatterHeader();
        private final Map<Class<?>,MatterSlice<?>> slices=new HashMap<>();
        public Class<?> getClass(Object value){return valueType(value);}
        public MatterHeader getHeader(){return header;}
        public int getWidth(){return 16;}public int getHeight(){return 16;}public int getDepth(){return 16;}
        public Map<Class<?>,MatterSlice<?>> getSliceMap(){return slices;}
        @SuppressWarnings("unchecked") public <T>MatterSlice<T> createSlice(Class<T> type,Matter matter){if(type==art.arcane.iris.generation.mantle.ObjectContinuationBundle.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.ObjectContinuationMatter(16,16,16);if(type==String.class)return (MatterSlice<T>)new art.arcane.volmlib.util.matter.slices.StringMatter(16,16,16);if(type==art.arcane.iris.world.storage.matter.PreObjectMatterCell.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.PreObjectMatter(16,16,16);if(type==art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.TreeBlockMaterialMatter(16,16,16);if(type==art.arcane.iris.integration.Identifier.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.IdentifierMatter(16,16,16);if(type==MatterCavern.class)return (MatterSlice<T>)new CavernMatter(16,16,16);if(type==art.arcane.volmlib.nativelib.terrain.NativeBlockState.class)return (MatterSlice<T>)new art.arcane.iris.world.storage.matter.PlatformBlockMatter(16,16,16);if(type==MatterMarker.class)return (MatterSlice<T>)new MarkerMatter(16,16,16);throw unsupported();}
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
