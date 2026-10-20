// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
public final class UnsupportedPlatform {
    private UnsupportedPlatform() {}
    public static RuntimeException unavailable(String feature) {
        // Native content loops deliberately skip bad content, but classify an
        // Error cause as an engine failure. Missing platform services must abort
        // generation rather than quietly dropping an authored layer or object.
        return new UnsupportedOperationException(feature + " is not connected in the browser engine.",
                new Error("Unconnected browser engine service"));
    }
}
