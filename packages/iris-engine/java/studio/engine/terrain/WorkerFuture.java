// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Worker-local task completion at the native context prefill dispatch boundary. */
public final class WorkerFuture {
    public static WorkerFuture runAsync(Runnable task,java.util.concurrent.Executor unused){task.run();return new WorkerFuture();}
    public Object join(){return null;}
}
