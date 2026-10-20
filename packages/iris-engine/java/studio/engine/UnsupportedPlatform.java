// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
public final class UnsupportedPlatform {
    private UnsupportedPlatform() {}
    public static RuntimeException unavailable(String feature) {
        return new UnsupportedOperationException(feature + " is not connected in the browser engine.");
    }
}
