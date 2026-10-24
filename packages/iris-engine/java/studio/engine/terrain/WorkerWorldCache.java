// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import java.util.*;
import java.util.function.Supplier;
import art.arcane.volmlib.util.function.IntIntFunction;
/** Bounded worker-local memoization; native streams retain coordinate conversion and provisional tracking. */
public final class WorkerWorldCache<T>{
    private final IntIntFunction<T> resolver;
    private int maximum;
    private final LinkedHashMap<Long,T> values=new LinkedHashMap<>();
    private WorkerWorldCache(IntIntFunction<T> resolver,int chunks){this.resolver=resolver;setMaximumChunks(chunks);}
    public static <T> WorkerWorldCache<T> ofInts(IntIntFunction<T> resolver,int chunks,Supplier<?> unused){return new WorkerWorldCache<>(resolver,chunks);}
    static long key(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
    public T get(int x,int z){long key=key(x,z);T value=values.get(key);if(value!=null||values.containsKey(key))return value;value=resolver.apply(x,z);if(values.size()>=maximum)values.remove(values.keySet().iterator().next());values.put(key,value);return value;}
    public void fillChunk(int x,int z,Object[] target){if(target==null||target.length!=256)throw new IllegalArgumentException("Expected 16x16 target");for(int i=0;i<256;i++)target[i]=get((x<<4)+(i&15),(z<<4)+(i>>4));}
    public long getSize(){return values.size();}
    public long getMaxSize(){return maximum;}
    public void setMaximumChunks(int chunks){if(chunks<=0)throw new IllegalArgumentException("Cache size must be positive");maximum=(int)Math.min(65536L,(long)chunks*256);while(values.size()>maximum)values.remove(values.keySet().iterator().next());}
}
