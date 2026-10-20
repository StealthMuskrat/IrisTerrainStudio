// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Reentrant lock accounting for memory owned exclusively by a single worker. */
public class WorkerLock {
    private int holds;
    public void lock(){holds++;}
    public void unlock(){if(holds==0)throw new IllegalMonitorStateException();holds--;}
}
