// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
/** Private to one synchronous WebAssembly instance in one browser worker. */
public final class WorkerReferenceArray {
    private final Object[] values;
    public WorkerReferenceArray(int length) { values = new Object[length]; }
    public Object get(int index) { return values[index]; }
    public void set(int index, Object value) { values[index] = value; }
    public Object getAcquire(int index) { return values[index]; }
    public void setRelease(int index,Object value) { values[index]=value; }
    public int length() { return values.length; }
    public boolean compareAndSet(int index,Object expected,Object value) { if(values[index]!=expected)return false;values[index]=value;return true; }
    public Object compareAndExchange(int index,Object expected,Object value) { Object prior=values[index];if(prior==expected)values[index]=value;return prior; }
}
