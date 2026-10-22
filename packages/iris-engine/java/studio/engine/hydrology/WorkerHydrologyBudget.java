// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import art.arcane.iris.generation.hydrology.HydrologyTileKey;
import java.util.*;
/** Admission only; no tile, route, feature or terrain result is synthesized. */
public final class WorkerHydrologyBudget {
    private static Set<HydrologyTileKey> active;private static int calls;
    public static void begin(){if(active!=null)throw new IllegalStateException("Nested worker hydrology operation");active=new HashSet<>();calls=0;}
    public static void admit(HydrologyTileKey key){if(active==null)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology planning outside an owned worker operation");if(++calls>64||!active.contains(key)&&active.size()>=32)throw studio.engine.UnsupportedPlatform.unavailable("Hydrology root planning exceeds its 32-tile / 64-call worker budget");active.add(key);}
    public static int calls(){return calls;}
    public static int roots(){return active==null?0:active.size();}
    public static void end(){active=null;calls=0;}
}
