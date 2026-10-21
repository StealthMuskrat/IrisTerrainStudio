// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;
import java.util.function.Supplier;
import studio.engine.terrain.BrowserTerrainEngine;

/** Field host for the unchanged native object component; the dimension owns the actual native cache. */
public final class WorkerNativeSourcePlans {
    private final BrowserTerrainEngine owner;
    public WorkerNativeSourcePlans(EngineMantle host){
        if(!(host.getEngine() instanceof BrowserTerrainEngine terrain))throw new IllegalArgumentException("Native source plans require their worker terrain owner");
        owner=terrain;
    }
    ObjectSourcePlan acquire(int sx,int sz,int dx,int dz,int radius,Supplier<ObjectSourcePlan> builder){return owner.objectSession().acquire(owner,sx,sz,dx,dz,radius,builder);}
    ObjectSourcePlanCache.Stats stats(){return owner.objectSession().nativeStats(owner);}
    void clear(){owner.objectSession().invalidate(owner);}
}
