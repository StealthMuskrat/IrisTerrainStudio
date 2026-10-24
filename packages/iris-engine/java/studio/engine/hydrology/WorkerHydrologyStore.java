// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import java.util.*;
import java.util.function.Function;
import java.util.concurrent.ConcurrentMap;
import com.github.benmanes.caffeine.cache.Weigher;
import studio.engine.cache.WorkerSourcePlanStore;

/** Platform storage only; original native planner weights and cache decisions remain authoritative. */
public final class WorkerHydrologyStore<K,V> {
    public static final class Builder<K,V>{
        private long budget=-1,expiry;private Weigher<K,V> weigher;
        public static Builder<Object,Object> newBuilder(){return new Builder<>();}
        public Builder<K,V> maximumSize(long count){if(count<0||count>65536)throw new IllegalArgumentException("Hydrology entry cache exceeds worker bounds");budget=count;weigher=(key,value)->1;return this;}
        public Builder<K,V> maximumWeight(long bytes){if(bytes<0||bytes>64L*1024*1024)throw new IllegalArgumentException("Hydrology weighted cache exceeds worker bounds");budget=bytes;return this;}
        public Builder<K,V> expireAfterAccess(long duration,java.util.concurrent.TimeUnit unit){if(duration<0)throw new IllegalArgumentException("Negative hydrology expiry");expiry=Objects.requireNonNull(unit).toNanos(duration);if(expiry==0)throw new IllegalArgumentException("Positive hydrology expiry required");return this;}
        @SuppressWarnings("unchecked") public <K1 extends K,V1 extends V> Builder<K1,V1> weigher(Weigher<? super K1,? super V1> value){weigher=(Weigher<K,V>)Objects.requireNonNull(value);return (Builder<K1,V1>)this;}
        @SuppressWarnings("unchecked") public <K1 extends K,V1 extends V> WorkerHydrologyStore<K1,V1> build(){if(budget<0||weigher==null)throw new IllegalStateException("Hydrology cache requires native capacity/weight configuration");return new WorkerHydrologyStore<>(budget,(Weigher<K1,V1>)weigher,expiry);}
    }
    private final WorkerSourcePlanStore<K,V> delegate;
    private final Set<K> building=new HashSet<>();
    private final long expiry;private final boolean retaining;private final Map<K,Long> accessed=new HashMap<>();
    private final ConcurrentMap<K,V> expiringView=new ExpiringView();
    private final ConcurrentMap<K,V> emptyView=new EmptyView();
    private WorkerHydrologyStore(long budget,Weigher<K,V> weigher,long expiry){delegate=WorkerSourcePlanStore.Builder.newBuilder().maximumWeight(Math.max(1,budget)).<K,V>weigher(weigher).build();this.expiry=expiry;retaining=budget!=0;}
    private void expire(){if(expiry==0)return;long now=System.nanoTime();var iterator=accessed.entrySet().iterator();while(iterator.hasNext()){var entry=iterator.next();if(delegate.getIfPresent(entry.getKey())==null||now-entry.getValue()>=expiry){delegate.asMap().remove(entry.getKey());iterator.remove();}}}
    @SuppressWarnings("unchecked") public V getIfPresent(Object key){Objects.requireNonNull(key);if(!retaining)return null;expire();V value=delegate.getIfPresent(key);if(value!=null&&expiry!=0)accessed.put((K)key,System.nanoTime());return value;}
    public V get(K key,Function<? super K,? extends V> factory){
        Objects.requireNonNull(key);Objects.requireNonNull(factory);V present=getIfPresent(key);if(present!=null)return present;
        if(!building.add(key))throw new IllegalStateException("Recursive native hydrology cache load");
        try{V value=factory.apply(key);if(value!=null)put(key,value);return value;}finally{building.remove(key);}
    }
    public void put(K key,V value){Objects.requireNonNull(key);Objects.requireNonNull(value);if(!retaining)return;expire();delegate.put(key,value);if(expiry!=0){if(delegate.getIfPresent(key)!=null)accessed.put(key,System.nanoTime());else accessed.remove(key);}}
    public ConcurrentMap<K,V> asMap(){return !retaining?emptyView:expiry==0?delegate.asMap():expiringView;}
    public void invalidate(Object key){delegate.asMap().remove(key);accessed.remove(key);}
    public void invalidateAll(){delegate.asMap().clear();accessed.clear();}
    public void cleanUp(){expire();delegate.cleanUp();}
    public long estimatedSize(){expire();return delegate.estimatedSize();}
    public WorkerSourcePlanStore.Policy policy(){return delegate.policy();}
    private final class EmptyView extends AbstractMap<K,V> implements ConcurrentMap<K,V>{
        @Override public V get(Object key){Objects.requireNonNull(key);return null;}
        @Override public V put(K key,V value){Objects.requireNonNull(key);Objects.requireNonNull(value);return null;}
        @Override public V putIfAbsent(K key,V value){return put(key,value);}
        @Override public V remove(Object key){Objects.requireNonNull(key);return null;}
        @Override public boolean remove(Object key,Object value){Objects.requireNonNull(key);Objects.requireNonNull(value);return false;}
        @Override public V replace(K key,V value){return put(key,value);}
        @Override public boolean replace(K key,V previous,V value){Objects.requireNonNull(previous);put(key,value);return false;}
        @Override public Set<Map.Entry<K,V>> entrySet(){return java.util.Collections.emptySet();}
    }
    private final class ExpiringView extends AbstractMap<K,V> implements ConcurrentMap<K,V>{
        @Override public V get(Object key){return getIfPresent(key);}
        @Override public V put(K key,V value){V previous=get(key);WorkerHydrologyStore.this.put(key,value);return previous;}
        @Override public V putIfAbsent(K key,V value){Objects.requireNonNull(value);V previous=get(key);if(previous==null)WorkerHydrologyStore.this.put(key,value);return previous;}
        @Override public V remove(Object key){V previous=get(key);invalidate(key);return previous;}
        @Override public boolean remove(Object key,Object value){V previous=get(key);if(previous==null||!previous.equals(value))return false;invalidate(key);return true;}
        @Override public V replace(K key,V value){Objects.requireNonNull(value);V previous=get(key);if(previous!=null)WorkerHydrologyStore.this.put(key,value);return previous;}
        @Override public boolean replace(K key,V previous,V value){Objects.requireNonNull(value);V present=get(key);if(present==null||!present.equals(previous))return false;WorkerHydrologyStore.this.put(key,value);return true;}
        @Override public void clear(){invalidateAll();}
        @Override public Set<Map.Entry<K,V>> entrySet(){expire();return delegate.asMap().entrySet();}
    }
}
