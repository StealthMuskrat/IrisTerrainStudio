// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
/** Private to one synchronous WebAssembly instance in one browser worker. */
public final class WorkerReferenceArray {
    private final Object[] values;
    public WorkerReferenceArray(int length) { values = new Object[length]; }
    public Object get(int index) { return values[index]; }
    public void set(int index, Object value) { values[index] = value; }
}
