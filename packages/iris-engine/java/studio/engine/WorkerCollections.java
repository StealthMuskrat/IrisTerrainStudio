// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
/** Equivalent set construction using JDK APIs supplied by the browser class library. */
public final class WorkerCollections {
    private WorkerCollections() {}
    public static <T> Set<T> newKeySet() { return Collections.newSetFromMap(new ConcurrentHashMap<T,Boolean>()); }
}
