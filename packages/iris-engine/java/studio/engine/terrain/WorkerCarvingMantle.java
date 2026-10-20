// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.generation.runtime.Engine;

/** Host ownership for the actual native Mantle carving component; other services fail closed. */
public final class WorkerCarvingMantle extends MantleBoundary {
    private final Engine engine;
    public WorkerCarvingMantle(Engine engine){this.engine=engine;}
    @Override public Engine getEngine(){return engine;}
}
