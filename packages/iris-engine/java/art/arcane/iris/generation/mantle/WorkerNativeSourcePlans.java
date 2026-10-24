// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;
import java.util.function.Supplier;
import studio.engine.terrain.BrowserTerrainEngine;

/** Field host for the unchanged native object component; the dimension owns the actual native cache. */
public final class WorkerNativeSourcePlans {
    private final BrowserTerrainEngine owner;
    private final WorkerObjectSession session;
    public WorkerNativeSourcePlans(EngineMantle host){
        if(!(host.getEngine() instanceof BrowserTerrainEngine terrain))throw new IllegalArgumentException("Native source plans require their worker terrain owner");
        owner=terrain;session=owner.objectSession(host instanceof art.arcane.iris.generation.runtime.IrisEngineMantle);
    }
    ObjectSourcePlan acquire(int sx,int sz,int dx,int dz,int radius,Supplier<ObjectSourcePlan> builder){return session.acquire(owner,sx,sz,dx,dz,radius,builder);}
    ObjectSourcePlanCache.Stats stats(){return session.nativeStats(owner);}
    void clear(){session.invalidate(owner);}
}
