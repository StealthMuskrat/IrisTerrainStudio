// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

/** Native false-multicore task ordering at the guarded material-stage call sites. */
public final class WorkerDepositDispatch {
    public static WorkerDepositDispatch burst(boolean multicore){
        if(multicore)throw studio.engine.UnsupportedPlatform.unavailable("Parallel material-stage dispatch inside one worker");
        return new WorkerDepositDispatch();
    }
    public java.util.concurrent.Future<?> queue(Runnable task){task.run();return null;} // Guarded native callers discard the future.
    public void complete(){} // Each task finished before queue returned; native preparation still owns failure handling.
}
