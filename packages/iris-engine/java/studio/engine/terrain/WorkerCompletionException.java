// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Type boundary for an unreachable parallel branch; parallel submission fails explicitly. */
public final class WorkerCompletionException extends RuntimeException {
    public WorkerCompletionException(Throwable cause){super(cause);}
}
