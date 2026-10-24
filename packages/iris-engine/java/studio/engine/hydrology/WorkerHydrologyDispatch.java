// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import java.util.concurrent.*;

/** One-worker scheduling/heap contract. Hydrology's native serial branches select the algorithms. */
public final class WorkerHydrologyDispatch implements Executor {
    public static final WorkerHydrologyDispatch burst=new WorkerHydrologyDispatch();
    public static final WorkerHydrologyDispatch hydrology=burst;
    public static long maximumHeap(){return 512L*1024*1024;}
    public static int processors(){return 1;}
    public static <T>java.util.Set<T> newKeySet(){return new java.util.HashSet<>();}
    public int parallelism(){return 1;}
    public boolean ownsCurrentThread(){return true;}
    @Override public void execute(Runnable task){task.run();}
    public interface ManagedBlocker {boolean isReleasable();boolean block()throws InterruptedException;}
    public static void managedBlock(ManagedBlocker blocker)throws InterruptedException{
        if(!blocker.isReleasable()&&!blocker.block())throw studio.engine.UnsupportedPlatform.unavailable("Blocking hydrology admission in one worker");
    }
    public static final class Pool implements Executor {
        public static void managedBlock(ManagedBlocker blocker)throws InterruptedException{WorkerHydrologyDispatch.managedBlock(blocker);}
        @Override public void execute(Runnable task){throw studio.engine.UnsupportedPlatform.unavailable("Hydrology JVM pool dispatch");}
        public int getParallelism(){return 1;}
        public static int getCommonPoolParallelism(){return 1;}
    }
    public static final class PoolThread extends Thread {
        private PoolThread(){}
        public Pool getPool(){throw studio.engine.UnsupportedPlatform.unavailable("Hydrology JVM worker pool");}
    }
    public static final class Queue<E> extends java.util.ArrayDeque<E> {}
    public static final class Latch {
        private int count;
        public Latch(int count){if(count<0)throw new IllegalArgumentException("Negative latch count");this.count=count;}
        public void countDown(){if(count>0)count--;}
        public long getCount(){return count;}
        public void await()throws InterruptedException{if(count!=0)throw studio.engine.UnsupportedPlatform.unavailable("Waiting for hydrology planning on another thread");}
    }
    public static void requireComplete(Latch completion){if(completion.getCount()!=0)throw new WorkerHydrologyRejectedException("Native hydrology task did not complete in the inline worker dispatch");}
}
