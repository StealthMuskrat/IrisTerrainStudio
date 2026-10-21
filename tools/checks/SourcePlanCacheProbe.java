// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;
import org.teavm.jso.JSExport;
import studio.engine.cache.*;
import java.util.*;
import java.nio.file.*;

/** Isolated native cache lifecycle + worker store contract. Plans are controlled test-only ABI fixtures. */
public final class SourcePlanCacheProbe {
    private static void require(boolean value,String label){if(!value)throw new AssertionError(label);}
    private static ObjectSourcePlan plan(){return new ObjectSourcePlan(new int[][]{{0,0},{1,0}},4096,192);}
    @JSExport public static String cacheLifecycle(){
        ObjectSourcePlanCache cache=new ObjectSourcePlanCache(1048576);ObjectSourcePlan original=plan(),rebuilt=plan();
        require(cache.acquire(0,0,0,0,1,()->original)==original,"first destination");long full=cache.stats().retainedBytes();
        require(cache.acquire(0,0,0,1,1,()->{throw new AssertionError("untouched rebuilt");})==null,"untouched destination");
        require(cache.acquire(0,0,1,0,1,()->{throw new AssertionError("second destination rebuilt");})==original,"shared retained plan");
        require(cache.stats().retainedBytes()<full,"drained payload released");
        require(cache.acquire(0,0,0,0,1,()->rebuilt)==rebuilt,"consumed destination rebuilt");
        for(int x=-1;x<=1;x++)for(int z=-1;z<=1;z++)if(!((x==0&&(z==0||z==1))||(x==1&&z==0)))cache.acquire(0,0,x,z,1,()->{throw new AssertionError("untouched source rebuilt");});
        var stats=cache.stats();require(stats.lookups()==10&&stats.builds()==2&&stats.replays()==1&&stats.drained()==1&&stats.retired()==1&&stats.retained()==0,"claim/visitor lifecycle");
        ObjectSourcePlanCache empty=new ObjectSourcePlanCache(4096);for(int i=0;i<3;i++)require(empty.acquire(2,-3,2,-3,1,()->ObjectSourcePlan.EMPTY)==null,"empty plan");require(empty.stats().builds()==1,"empty index retained");empty.clear();require(empty.estimatedSize()==0,"clear");empty.acquire(2,-3,2,-3,1,()->ObjectSourcePlan.EMPTY);require(empty.stats().builds()==2,"clear rebuild");
        ObjectSourcePlanCache small=new ObjectSourcePlanCache(1);for(int i=0;i<2;i++)require(small.acquire(0,0,0,0,1,()->original)==original,"oversized served");require(small.stats().builds()==2&&small.stats().retained()==0,"oversized not retained");
        ObjectSourcePlanCache recursive=new ObjectSourcePlanCache(4096);boolean recursion=false;try{recursive.acquire(0,0,0,0,1,()->recursive.acquire(0,0,1,0,1,()->original));}catch(IllegalStateException expected){recursion=expected.getMessage().contains("Recursive source plan construction");}require(recursion,"recursive construction refused");require(recursive.acquire(0,0,0,0,1,()->original)==original,"pending removed after failure");require(recursive.stats().builds()==2&&recursive.stats().waits()==1,"recursion stats");
        return "{\"lookups\":"+stats.lookups()+",\"builds\":"+stats.builds()+",\"replays\":"+stats.replays()+",\"drained\":"+stats.drained()+",\"retired\":"+stats.retired()+",\"retained\":"+stats.retained()+",\"emptyBuildsAfterClear\":"+empty.stats().builds()+",\"oversizedBuilds\":"+small.stats().builds()+",\"recursiveBuilds\":"+recursive.stats().builds()+",\"recursiveWaits\":"+recursive.stats().waits()+"}";
    }
    @JSExport public static String storeContract(){
        var builder=WorkerSourcePlanStore.Builder.newBuilder();WorkerSourcePlanStore<String,Integer> store=builder.maximumWeight(6).weigher((String key,Integer value)->value).build();
        store.put("a",2);store.put("b",3);require(store.asMap().replace("a",2,4),"conditional replacement");require(store.getIfPresent("b")==null&&store.getIfPresent("a")==4,"replacement reweighs and evicts");
        require(!store.asMap().replace("a",2,1),"stale replacement refused");require(store.asMap().computeIfPresent("a",(key,value)->null)==null,"compute removal");require(store.policy().eviction().orElseThrow().weightedSize().orElseThrow()==0,"weight released");
        store.put("a",2);store.put("b",3);store.getIfPresent("a");store.put("c",2);require(store.getIfPresent("b")==null&&store.getIfPresent("a")==2&&store.getIfPresent("c")==2,"worker access eviction");
        store.put("oversized",7);require(store.getIfPresent("oversized")==null&&store.estimatedSize()==2,"oversized insertion bounded");
        boolean immutable=false;try{store.asMap().entrySet().iterator().next().setValue(99);}catch(UnsupportedOperationException expected){immutable=true;}require(immutable,"map view cannot bypass weighing");
        require(store.asMap().remove("a",2),"conditional removal");store.asMap().clear();require(store.estimatedSize()==0&&store.policy().eviction().orElseThrow().weightedSize().orElseThrow()==0,"clear accounts weight");
        WorkerPlanCounter counter=new WorkerPlanCounter();counter.increment();counter.increment();require(counter.sum()==2,"long counter");
        WorkerPlanCompletion<String> completed=new WorkerPlanCompletion<>();require(completed.complete("value")&&!completed.complete("other")&&completed.join().equals("value"),"completion value");
        WorkerPlanCompletion<String> failed=new WorkerPlanCompletion<>();RuntimeException cause=new IllegalArgumentException("fixture");failed.completeExceptionally(cause);boolean failure=false;try{failed.join();}catch(WorkerPlanCompletionException expected){failure=expected.getCause()==cause;}require(failure,"failure identity");
        boolean incomplete=false;try{new WorkerPlanCompletion<>().join();}catch(UnsupportedOperationException expected){incomplete=expected.getCause() instanceof Error;}require(incomplete,"blocking unavailable");return "{\"store\":true,\"counter\":true,\"completion\":true}";
    }
    public static void main(String[] args){}
}
