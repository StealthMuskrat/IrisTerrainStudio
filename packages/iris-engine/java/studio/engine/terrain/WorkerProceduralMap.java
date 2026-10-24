// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import java.util.HashMap;
import java.util.Map;
import java.io.File;

/** Original HashMap behavior with a per-preview allocation budget for native procedural canvases. */
public final class WorkerProceduralMap<K,V> extends HashMap<K,V> {
    private static boolean active;
    private static int entries;
    private static long caveSearchWork;
    private static final long CAVE_SEARCH_LIMIT=1048576;
    public static void begin(){if(active)throw new IllegalStateException("Nested procedural preview");active=true;entries=0;caveSearchWork=0;}
    public static void end(){active=false;entries=0;caveSearchWork=0;}
    /** Admission only: retain native retries, cached column scans and anchor selection unchanged. */
    public static void admitCaveSearch(int attempts){
        if(!active)throw new IllegalStateException("Cave anchor search requires an owned procedural preview");
        long work=(long)Math.max(1,attempts)*WorkerCaveStorage.getWorldHeight(null);
        if(work>CAVE_SEARCH_LIMIT-caveSearchWork)throw new IllegalArgumentException("Procedural cave anchor search exceeds its bounded native column budget");
        caveSearchWork+=work;
    }
    public static String caveSearchStatistics(){return "{\"columnWorkCharged\":"+caveSearchWork+",\"workLimit\":"+CAVE_SEARCH_LIMIT+"}";}
    @Override public V put(K key,V value){
        if(!active)throw new IllegalStateException("Native procedural canvas requires an owned preview");
        if(!containsKey(key)&&++entries>4194304)throw new IllegalArgumentException("Procedural preview exceeds its native canvas entry budget");
        return super.put(key,value);
    }
    @Override public void putAll(Map<? extends K,? extends V> values){
        if(!active)throw new IllegalStateException("Native procedural canvas requires an owned preview");
        int added=0;for(K key:values.keySet())if(!containsKey(key))added++;
        if(added>4194304-entries)throw new IllegalArgumentException("Procedural preview exceeds its native canvas entry budget");
        entries+=added;
        // Preserve HashMap.putAll capacity/iteration behavior; repeated put calls can change it.
        super.putAll(values);
    }
    /** Browser workers have no server marker file; preserve the native JVM-property query. */
    public static String debugSpec(){String value=System.getProperty("iris.goldendebug");return value==null||value.isBlank()?null:value;}
    public static boolean debugFile(File file){if(!file.getPath().equals("plugins/Iris/goldendebug.txt"))throw studio.engine.UnsupportedPlatform.unavailable("Procedural filesystem access");return false;}
}
