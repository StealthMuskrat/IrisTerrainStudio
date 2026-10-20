// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
/** Equivalent set construction using JDK APIs supplied by the browser class library. */
public final class WorkerCollections {
    private WorkerCollections() {}
    public static <T> Set<T> newKeySet() { return Collections.newSetFromMap(new ConcurrentHashMap<T,Boolean>()); }
    public static <T> Set<T> keys(Map<T,?> map){return map.keySet();}
    /** JDK immutable-map lookup, including empty copies; TeaVM 0.16 otherwise divides by zero. */
    public static Object immutableGet(Map.Entry<?,?>[] entries,Object key){
        Objects.requireNonNull(key);
        for(Map.Entry<?,?> entry:entries)if(entry!=null&&key.equals(entry.getKey()))return entry.getValue();
        return null;
    }
}
