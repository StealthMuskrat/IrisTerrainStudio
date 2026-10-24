// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import java.util.function.Consumer;

/** Preserve native content-error reporting; unavailable host services must stop generation. */
public final class RotationFailures implements Consumer<Throwable> {
    private static final Consumer<Throwable> INSTANCE=new RotationFailures();
    public static Consumer<Throwable> instance(){return INSTANCE;}
    @Override public void accept(Throwable failure){
        art.arcane.iris.generation.runtime.GenerationFailures.rethrowEngineFailure(failure);
        art.arcane.iris.spi.IrisLogging.reportError(failure);
    }
}
