// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.cache;

import java.util.*;
import com.github.benmanes.caffeine.cache.Weigher;
import java.util.concurrent.ConcurrentMap;
import java.util.function.BiFunction;

/** Worker-owned weighted storage. Native source-plan claim/visitor/rebuild logic stays upstream. */
public final class WorkerSourcePlanStore<K,V> {
    public static final class Builder<K,V>{
        private long budget;private Weigher<K,V> weigher;
        public static Builder<Object,Object> newBuilder(){return new Builder<>();}
        public Builder<K,V> maximumWeight(long value){if(value<=0)throw new IllegalArgumentException("Positive source-plan store budget required");budget=value;return this;}
        @SuppressWarnings("unchecked") public <K1 extends K,V1 extends V> Builder<K1,V1> weigher(Weigher<? super K1,? super V1> value){weigher=(Weigher<K,V>)Objects.requireNonNull(value);return (Builder<K1,V1>)this;}
        @SuppressWarnings("unchecked") public <K1 extends K,V1 extends V> WorkerSourcePlanStore<K1,V1> build(){if(budget==0||weigher==null)throw new IllegalStateException("Source-plan store requires a budget and native weigher");return new WorkerSourcePlanStore<>(budget,(Weigher<K1,V1>)weigher);}
    }
    public static final class Policy {
        private final Eviction eviction;Policy(WorkerSourcePlanStore<?,?> owner){eviction=new Eviction(owner);}
        public Optional<Eviction> eviction(){return Optional.of(eviction);}
    }
    public static final class Eviction {
        private final WorkerSourcePlanStore<?,?> owner;Eviction(WorkerSourcePlanStore<?,?> owner){this.owner=owner;}
        public OptionalLong weightedSize(){return OptionalLong.of(owner.retainedWeight);}
    }
    private record Entry<V>(V value,int weight){}
    private final long budget;private final Weigher<K,V> weigher;
    private final LinkedHashMap<K,Entry<V>> entries=new LinkedHashMap<>(16,.75f,true);
    private final ConcurrentMap<K,V> view=new MapView();private final Policy policy=new Policy(this);private long retainedWeight;
    private WorkerSourcePlanStore(long budget,Weigher<K,V> weigher){this.budget=budget;this.weigher=weigher;}
    public V getIfPresent(Object key){Entry<V> entry=entries.get(key);return entry==null?null:entry.value();}
    public void put(K key,V value){replaceEntry(key,Objects.requireNonNull(value));}
    public ConcurrentMap<K,V> asMap(){return view;}
    public void cleanUp(){}
    public long estimatedSize(){return entries.size();}
    public Policy policy(){return policy;}
    private V removeEntry(Object key){Entry<V> old=entries.remove(key);if(old==null)return null;retainedWeight-=old.weight();return old.value();}
    private V replaceEntry(K key,V value){
        Objects.requireNonNull(key);int weight=weigher.weigh(key,value);if(weight<0)throw new IllegalArgumentException("Negative native source-plan weight");
        V old=removeEntry(key);if(weight>budget)return old;entries.put(key,new Entry<>(value,weight));retainedWeight+=weight;
        while(retainedWeight>budget){var iterator=entries.entrySet().iterator();var removed=iterator.next();retainedWeight-=removed.getValue().weight();iterator.remove();}return old;
    }
    private final class MapView extends AbstractMap<K,V> implements ConcurrentMap<K,V>{
        @Override public V get(Object key){return getIfPresent(key);}
        @Override public int size(){return entries.size();}
        @Override public V put(K key,V value){return replaceEntry(key,Objects.requireNonNull(value));}
        @Override public V remove(Object key){return removeEntry(key);}
        @Override public void clear(){entries.clear();retainedWeight=0;}
        @Override public V putIfAbsent(K key,V value){V existing=get(key);if(existing==null)put(key,value);return existing;}
        @Override public boolean remove(Object key,Object value){V existing=get(key);if(existing==null||!existing.equals(value))return false;removeEntry(key);return true;}
        @Override public boolean replace(K key,V old,V value){V existing=get(key);if(existing==null||!existing.equals(old))return false;put(key,value);return true;}
        @Override public V replace(K key,V value){V existing=get(key);if(existing!=null)put(key,value);return existing;}
        @Override public V computeIfPresent(K key,BiFunction<? super K,? super V,? extends V> function){Objects.requireNonNull(function);V existing=get(key);if(existing==null)return null;V value=function.apply(key,existing);if(value==null)removeEntry(key);else put(key,value);return value;}
        @Override public Set<Map.Entry<K,V>> entrySet(){Map<K,V> snapshot=new LinkedHashMap<>();for(var entry:entries.entrySet())snapshot.put(entry.getKey(),entry.getValue().value());return Collections.unmodifiableMap(snapshot).entrySet();}
    }
}
