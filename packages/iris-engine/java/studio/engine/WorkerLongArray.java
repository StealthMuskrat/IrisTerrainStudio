// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
/** Exact long storage for native palette bits owned by one worker. */
public final class WorkerLongArray {
    private final long[] values;
    public WorkerLongArray(int length){values=new long[length];}
    public WorkerLongArray(long[] source){values=source.clone();}
    public int length(){return values.length;}
    public long get(int index){return values[index];}
    public long getPlain(int index){return values[index];}
    public void set(int index,long value){values[index]=value;}
    public void setPlain(int index,long value){values[index]=value;}
    public boolean compareAndSet(int index,long expected,long value){if(values[index]!=expected)return false;values[index]=value;return true;}
}
