// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import java.util.HashMap;
import java.io.File;

/** Original HashMap behavior with a per-preview allocation budget for native procedural canvases. */
public final class WorkerProceduralMap<K,V> extends HashMap<K,V> {
    private static boolean active;
    private static int entries;
    public static void begin(){if(active)throw new IllegalStateException("Nested procedural preview");active=true;entries=0;}
    public static void end(){active=false;entries=0;}
    @Override public V put(K key,V value){
        if(!active)throw new IllegalStateException("Native procedural canvas requires an owned preview");
        if(!containsKey(key)&&++entries>262144)throw new IllegalArgumentException("Procedural preview exceeds its native canvas entry budget");
        return super.put(key,value);
    }
    public static boolean debugFile(File file){if(!file.getPath().equals("plugins/Iris/goldendebug.txt"))throw studio.engine.UnsupportedPlatform.unavailable("Procedural filesystem access");return false;}
}
