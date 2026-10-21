// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

/** Host task transport only. Original EngineMode stage loop, context scopes and failures execute. */
public final class WorkerModeDispatch {
    private boolean configured;
    public static WorkerModeDispatch burst(int estimate){if(estimate<1||estimate>16)throw new IllegalArgumentException("Native mode stage count exceeds worker bounds");return new WorkerModeDispatch();}
    public void setMulticore(boolean value){if(value)throw studio.engine.UnsupportedPlatform.unavailable("Parallel native mode stages inside one worker");configured=true;}
    public java.util.concurrent.Future<?> queue(Runnable task){if(!configured)throw new IllegalStateException("Native mode dispatch must select inline execution");task.run();return null;}
    public void complete(){if(!configured)throw new IllegalStateException("Native mode dispatch was not configured");}
}
