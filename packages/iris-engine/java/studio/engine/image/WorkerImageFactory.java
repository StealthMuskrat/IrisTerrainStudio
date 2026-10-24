// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
import art.arcane.iris.generation.image.IrisImage;
/** Constructor signature is bound to the original IrisImage by the image platform plugin. */
public final class WorkerImageFactory {
    public static IrisImage create(WorkerImagePixels pixels){throw studio.engine.UnsupportedPlatform.unavailable("Native image constructor requires its compiler binding");}
}
