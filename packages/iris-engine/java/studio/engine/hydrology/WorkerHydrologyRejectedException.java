// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
/** Concrete worker transport failure; unavailable waits must not silently skip authored content. */
public final class WorkerHydrologyRejectedException extends RuntimeException {
    public WorkerHydrologyRejectedException(String message){super(message,new Error("Unavailable browser hydrology wait"));}
}
