// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
/** Private fragment-classification state in one synchronous worker instance. */
public final class WorkerIntegerArray {
    private final int[] values;
    public WorkerIntegerArray(int length){values=new int[length];}
    public int get(int index){return values[index];}
    public void set(int index,int value){values[index]=value;}
}
