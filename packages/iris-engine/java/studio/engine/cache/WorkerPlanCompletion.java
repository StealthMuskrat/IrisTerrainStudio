// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.cache;
/** Completion values for serialized worker calls; blocking another worker is unavailable. */
public final class WorkerPlanCompletion<T> {
    private boolean completed;private T value;private Throwable failure;
    public boolean complete(T result){if(completed)return false;completed=true;value=result;return true;}
    public boolean completeExceptionally(Throwable error){java.util.Objects.requireNonNull(error);if(completed)return false;completed=true;failure=error;return true;}
    public T join(){if(!completed)throw studio.engine.UnsupportedPlatform.unavailable("Waiting for another source-plan worker");if(failure!=null)throw new WorkerPlanCompletionException(failure);return value;}
}
