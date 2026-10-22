// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Permit accounting for one worker. Blocking on another owner is explicitly unavailable. */
public final class WorkerSemaphore {
    private int permits;
    public WorkerSemaphore(int permits,boolean fair){this.permits=permits;}
    public int availablePermits(){return permits;}
    public boolean tryAcquire(){return tryAcquire(1);}
    public boolean tryAcquire(long timeout,java.util.concurrent.TimeUnit unit){if(timeout<0)throw new IllegalArgumentException("Negative worker permit timeout");java.util.Objects.requireNonNull(unit);return tryAcquire(1);}
    public boolean tryAcquire(int count){if(count<0)throw new IllegalArgumentException();if(count>permits)return false;permits-=count;return true;}
    public void acquireUninterruptibly(){acquireUninterruptibly(1);}
    public void acquireUninterruptibly(int count){if(!tryAcquire(count))throw studio.engine.UnsupportedPlatform.unavailable("Blocking Mantle chunk permit in one worker");}
    public void release(){release(1);}
    public void release(int count){if(count<0||count>Integer.MAX_VALUE-permits)throw new IllegalStateException("Invalid worker permit release");permits+=count;}
}
