// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** VarHandle operations on a single worker's private arrays. */
public final class WorkerArrayAccess{
    public static WorkerArrayAccess arrayElementVarHandle(Class<?> type){if(type!=byte[].class&&type!=int[].class&&type!=long[].class&&type!=double[].class&&type!=boolean[].class)throw new UnsupportedOperationException("Unlinked worker array type");return new WorkerArrayAccess();}
    public double getOpaque(double[] array,int index){return array[index];}
    public void setOpaque(double[] array,int index,double value){array[index]=value;}
    public boolean getVolatile(boolean[] array,int index){return array[index];}
    public void setVolatile(boolean[] array,int index,boolean value){array[index]=value;}
    public boolean getAndSet(boolean[] array,int index,boolean value){boolean old=array[index];array[index]=value;return old;}
    public boolean compareAndSet(boolean[] array,int index,boolean expected,boolean value){if(array[index]!=expected)return false;array[index]=value;return true;}
    public byte getAcquire(byte[] array,int index){return array[index];}
    public void setRelease(byte[] array,int index,byte value){array[index]=value;}
    public boolean compareAndSet(byte[] array,int index,byte expected,byte value){if(array[index]!=expected)return false;array[index]=value;return true;}
    public double getVolatile(double[] array,int index){return array[index];}
    public void setRelease(double[] array,int index,double value){array[index]=value;}
    public int getAcquire(int[] array,int index){return array[index];}
    public long getAcquire(long[] array,int index){return array[index];}
    public void setRelease(int[] array,int index,int value){array[index]=value;}
    public void setRelease(long[] array,int index,long value){array[index]=value;}
    public boolean compareAndSet(int[] array,int index,int expected,int value){if(array[index]!=expected)return false;array[index]=value;return true;}
    public static void loadLoadFence(){}
}
