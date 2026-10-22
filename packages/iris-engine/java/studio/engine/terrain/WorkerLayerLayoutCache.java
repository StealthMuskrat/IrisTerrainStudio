// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import java.util.*;
import java.util.function.Function;

/** Single-worker storage only; native layout sampling and provisional-cache decisions are unchanged. */
public final class WorkerLayerLayoutCache<K,V> {
    public static final int MAXIMUM_ENTRIES=4096;
    public static final class Builder<K,V>{
        private int maximum;
        public static Builder<Object,Object> newBuilder(){return new Builder<>();}
        public Builder<K,V> maximumSize(long count){if(count<1)throw new IllegalArgumentException("Positive layer cache capacity required");maximum=(int)Math.min(count,MAXIMUM_ENTRIES);return this;}
        public <K1 extends K,V1 extends V> WorkerLayerLayoutCache<K1,V1> build(){if(maximum==0)throw new IllegalStateException("Layer cache capacity is missing");return new WorkerLayerLayoutCache<>(maximum);}
    }
    private final int maximum;
    private final LinkedHashMap<K,V> values=new LinkedHashMap<>(16,.75f,true);
    private final Set<K> building=new HashSet<>();
    private WorkerLayerLayoutCache(int maximum){this.maximum=maximum;}
    public V get(K key,Function<? super K,? extends V> factory){
        V current=values.get(key);if(current!=null)return current;
        if(!building.add(key))throw new IllegalStateException("Recursive native dimension-stack layout");
        try{V value=Objects.requireNonNull(factory.apply(key),"Native layout is missing");if(values.size()==maximum)values.remove(values.keySet().iterator().next());values.put(key,value);return value;}
        finally{building.remove(key);}
    }
}
