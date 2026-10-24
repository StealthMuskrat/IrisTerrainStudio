// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/** Single-worker bounded map service for the original WorldCache2DDouble, not a sampling algorithm. */
public final class WorkerChunkCacheMap<K,V> extends LinkedHashMap<K,V> {
    private int maximum;
    private WorkerChunkCacheMap(long capacity){setCapacity(capacity);}
    @Override public V get(Object key){V value=super.get(key);if(value!=null){super.remove(key);super.put((K)key,value);}return value;}
    public V getQuietly(Object key){return super.get(key);}
    @Override public V computeIfAbsent(K key,Function<? super K,? extends V> function){V value=super.get(key);if(value!=null)return value;value=function.apply(key);if(value!=null)put(key,value);return value;}
    @Override protected boolean removeEldestEntry(Map.Entry<K,V> entry){return size()>maximum;}
    public long capacity(){return maximum;}
    public void setCapacity(long requested){if(requested<=0)throw new IllegalArgumentException("Chunk cache capacity must be positive");maximum=(int)Math.min(256L,requested);while(size()>maximum)remove(keySet().iterator().next());}
    public static final class Builder<K,V> {
        private long maximum;
        public Builder<K,V> initialCapacity(int value){if(value<0)throw new IllegalArgumentException("Negative cache capacity");return this;}
        public Builder<K,V> maximumWeightedCapacity(long value){maximum=value;return this;}
        public Builder<K,V> concurrencyLevel(int value){if(value<1)throw new IllegalArgumentException("Invalid cache concurrency");return this;}
        public WorkerChunkCacheMap<K,V> build(){return new WorkerChunkCacheMap<>(maximum);}
    }
}
