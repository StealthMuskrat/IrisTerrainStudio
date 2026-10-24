// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import art.arcane.iris.generation.hydrology.HydrologyTileKey;
import java.util.*;
/** Admission only; no tile, route, feature or terrain result is synthesized. */
public final class WorkerHydrologyBudget {
    private static Set<HydrologyTileKey> active;private static int calls;private static long publicationLayerCells;
    public static void begin(){if(active!=null)throw new IllegalStateException("Nested worker hydrology operation");active=new HashSet<>();calls=0;publicationLayerCells=0;}
    public static void admit(HydrologyTileKey key){if(active==null)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology planning outside an owned worker operation");if(++calls>64||!active.contains(key)&&active.size()>=32)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology root planning exceeds its 32-tile / 64-call worker budget");active.add(key);}
    /** Charge sampled native layer metadata, without probing blocks or changing publication decisions. */
    public static void admitPublication(Map<?,art.arcane.iris.generation.hydrology.HydrologyColumnSample> samples,int height){
        if(active==null)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology publication outside an owned worker operation");
        long work=0;for(var sample:samples.values())work+=(long)sample.layers().size()*height;
        if(work>1048576-publicationLayerCells)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology publication exceeds its 1,048,576 layer-cell admission budget");publicationLayerCells+=work;
    }
    public static long publicationLayerCells(){return publicationLayerCells;}
    public static int calls(){return calls;}
    public static int roots(){return active==null?0:active.size();}
    public static void end(){active=null;calls=0;publicationLayerCells=0;}
}
