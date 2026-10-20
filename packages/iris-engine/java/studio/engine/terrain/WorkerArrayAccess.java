// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** VarHandle operations on a single worker's private arrays. */
public final class WorkerArrayAccess{
    public static WorkerArrayAccess arrayElementVarHandle(Class<?> type){if(type!=int[].class&&type!=long[].class)throw new UnsupportedOperationException("Unlinked worker array type");return new WorkerArrayAccess();}
    public int getAcquire(int[] array,int index){return array[index];}
    public long getAcquire(long[] array,int index){return array[index];}
    public void setRelease(int[] array,int index,int value){array[index]=value;}
    public void setRelease(long[] array,int index,long value){array[index]=value;}
    public boolean compareAndSet(int[] array,int index,int expected,int value){if(array[index]!=expected)return false;array[index]=value;return true;}
    public static void loadLoadFence(){}
}
