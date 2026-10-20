// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** No other thread can access the native palette's private data. */
public final class WorkerReadWriteLock {
    private final ReadLock read=new ReadLock();private final WriteLock write=new WriteLock();
    public ReadLock readLock(){return read;}public WriteLock writeLock(){return write;}
    public static final class ReadLock extends WorkerLock {}
    public static final class WriteLock extends WorkerLock {}
}
