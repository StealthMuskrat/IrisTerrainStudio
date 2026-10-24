// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import org.teavm.jso.JSBody;

/** A browser worker has no nested ForkJoin density jobs. Native callers select their sequential path. */
public final class WorkerCaveDispatch {
    // Keep the nullable primitive-array boundary opaque to TeaVM: folding a Java
    // null-only result currently emits an Object local for an unwrapped GC array.
    @JSBody(params={},script="return null;") public static native byte[] classification();
    @JSBody(params={},script="return null;") public static native double[] lattice();
}
