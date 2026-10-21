// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Cache host is unavailable in the one-source diagnostic; no native cache operation is substituted. */
public final class WorkerUnconnectedSourcePlans {
    public WorkerUnconnectedSourcePlans(){}
    public void clear(){throw studio.engine.UnsupportedPlatform.unavailable("Automatic source-plan cache and scheduling");}
}
