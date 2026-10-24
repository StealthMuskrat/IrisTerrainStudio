// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Nullable memoization reference owned by one native terrain runtime, released with that runtime. */
public final class WorkerWeakReference<T>{
    private final T value;
    public WorkerWeakReference(T value){this.value=value;}
    public T get(){return value;}
}
