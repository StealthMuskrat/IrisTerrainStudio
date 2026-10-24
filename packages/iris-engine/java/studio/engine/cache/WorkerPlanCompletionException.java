// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.cache;
/** Cause-preserving completion failure for the worker class library. */
public final class WorkerPlanCompletionException extends RuntimeException {
    public WorkerPlanCompletionException(Throwable cause){super(cause);}
}
