// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;
import java.util.*;
import java.util.function.Supplier;
import studio.engine.matter.WorkerContinuationStore;

/** One immutable dimension/seed/pack context owns native source plans and native continuation bytes. */
public final class WorkerObjectSession implements AutoCloseable {
    public static final long PLAN_BYTE_BUDGET=8L*1024*1024;
    private final Object owner;private final ObjectSourcePlanCache cache;private final WorkerContinuationStore continuations;
    private boolean active,closed;private long builtBytes,requests,contributions;
    public WorkerObjectSession(Object owner){this.owner=Objects.requireNonNull(owner);cache=new ObjectSourcePlanCache(PLAN_BYTE_BUDGET);continuations=new WorkerContinuationStore(owner,4*1024*1024,64);}
    private void require(Object token){if(closed)throw new IllegalStateException("Object session is closed");if(owner!=token)throw new IllegalArgumentException("Object session belongs to another terrain context");}
    public Pass begin(Object token){require(token);if(active)throw new IllegalStateException("Nested object session pass");active=true;return new Pass();}
    ObjectSourcePlan acquire(Object token,int sx,int sz,int dx,int dz,int radius,Supplier<ObjectSourcePlan> builder){require(token);if(!active)throw new IllegalStateException("Object source-plan access outside a pass");if(radius<0||radius>1)throw studio.engine.UnsupportedPlatform.unavailable("Object source cache radius exceeds the prepared preview scope");var result=cache.acquire(sx,sz,dx,dz,radius,()->{var plan=Objects.requireNonNull(builder.get(),"Source plan builder returned no plan");builtBytes+=plan.estimatedRetainedBytes();return plan;});requests++;if(result!=null)contributions++;return result;}
    public WorkerContinuationStore continuations(Object token){require(token);return continuations;}
    ObjectSourcePlanCache.Stats nativeStats(Object token){require(token);if(!active)throw new IllegalStateException("Native source-plan stats outside a pass");return cache.stats();}
    long requests(Object token){require(token);return requests;}
    long contributions(Object token){require(token);return contributions;}
    public long builtBytes(Object token){require(token);return builtBytes;}
    public String statistics(Object token){require(token);var s=cache.stats();return "{\"lookups\":"+s.lookups()+",\"builds\":"+s.builds()+",\"replays\":"+s.replays()+",\"drained\":"+s.drained()+",\"retired\":"+s.retired()+",\"retained\":"+s.retained()+",\"retainedBytes\":"+s.retainedBytes()+",\"budgetBytes\":"+s.budgetBytes()+",\"continuationChunks\":"+continuations.chunkCount(owner)+",\"continuationBytes\":"+continuations.retainedBytes(owner)+"}";}
    public void invalidate(Object token){require(token);cache.clear();continuations.clear(owner);}
    @Override public void close(){if(closed)return;cache.clear();continuations.close();active=false;closed=true;}
    public final class Pass implements AutoCloseable {private boolean committed,ended;public void commit(){if(ended||closed)throw new IllegalStateException("Object pass is closed");committed=true;}@Override public void close(){if(ended)return;ended=true;if(!closed&&!committed)invalidate(owner);active=false;}}
}
