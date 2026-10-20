// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.volmlib.util.function.IntIntToDoubleFunction;
import art.arcane.volmlib.util.cache.WorldCache2DDouble.BatchResolver;
/** Memoization adapter only; values come from the unmodified native stream. */
public final class WorkerWorldDoubleCache{
    private final WorkerWorldCache<Double> values;
    public WorkerWorldDoubleCache(IntIntToDoubleFunction resolver,int chunks){values=WorkerWorldCache.ofInts((x,z)->resolver.apply(x,z),chunks,null);}
    public double get(int x,int z){return values.get(x,z);}
    public void fillChunk(int x,int z,Object[] target){values.fillChunk(x,z,target);}
    public void fillChunk(int x,int z,double[] target){if(target==null||target.length!=256)throw new IllegalArgumentException("Expected 16x16 target");for(int i=0;i<256;i++)target[i]=get((x<<4)+(i&15),(z<<4)+(i>>4));}
    public void getBatch(long[] points,int count,double[] target,BatchResolver resolver){throw new UnsupportedOperationException("Native batch cache IO is not linked for scalar worker sampling");}
    public long getSize(){return values.getSize();}public long getMaxSize(){return values.getMaxSize();}public void setMaximumChunks(int chunks){values.setMaximumChunks(chunks);}
}
