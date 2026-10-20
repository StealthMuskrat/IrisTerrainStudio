// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Private metric samples; no generation values or algorithms are changed. */
public final class WorkerDoubleArray {
    private final double[] values;
    public WorkerDoubleArray(int length){values=new double[length];}
    public int length(){return values.length;}
    public double get(int index){return values[index];}
    public double getAndSet(int index,double value){double old=values[index];values[index]=value;return old;}
}
