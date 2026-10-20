// SPDX-License-Identifier: GPL-3.0-or-later
// Development-only harness linked with verified, unmodified VolmLib source.
package studio.probe;

import art.arcane.volmlib.util.noise.FastNoiseDouble;
import org.teavm.jso.JSExport;

public final class NoiseProbe {
    private static FastNoiseDouble warmNoise;
    private static long warmSeed;
    private static final String[] SEEDS = {
        "-9223372036854775808", "-935731", "0", "813753", "9223372036854775807"
    };
    private static final double[] COORDINATES = {
        -29999983.25, -513, -16, -1, -0.125, 0, 0.125, 15, 16, 29999983.25
    };

    @JSExport
    public static String sample(String decimalSeed, double x, double y, double z, boolean reuse) {
        long seed = Long.parseLong(decimalSeed);
        FastNoiseDouble noise;
        if (reuse) {
            if (warmNoise == null || seed != warmSeed) {
                warmNoise = new FastNoiseDouble(seed);
                warmSeed = seed;
            }
            noise = warmNoise;
        } else {
            noise = new FastNoiseDouble(seed);
        }
        return bits(noise.GetWhiteNoise(x, z)) + ":" + bits(noise.GetWhiteNoise(x, y, z)) + ":"
            + bits(noise.GetWhiteNoise(x, y, z, x + 0.125)) + ":"
            + bits(noise.GetPerlin(x, z)) + ":" + bits(noise.GetPerlin(x, y, z));
    }

    private static String bits(double value) {
        if (!Double.isFinite(value)) throw new IllegalStateException("Non-finite primitive result");
        String hex = Long.toHexString(Double.doubleToRawLongBits(value));
        return "0000000000000000".substring(hex.length()) + hex;
    }

    @JSExport
    public static String sampleRng(String seed, boolean textSeed, String signature) {
        try {
            return RngProbe.sample(seed, textSeed, signature);
        } catch (Throwable error) {
            return "ERROR: " + error;
        }
    }

    public static void main(String[] args) {
        System.out.print("{\"formatVersion\":1,\"scope\":\"volmlib-primitive-portability\",\"cases\":[");
        int index = 0;
        for (String seed : SEEDS) for (double x : COORDINATES) for (double y : COORDINATES) for (double z : COORDINATES) {
            if (index != 0) System.out.print(",");
            String cold = sample(seed, x, y, z, false);
            String warm = sample(seed, x, y, z, true);
            if (!cold.equals(warm)) throw new IllegalStateException("Native reuse mismatch at " + index);
            System.out.print("{\"id\":" + index++ + ",\"seed\":\"" + seed + "\",\"x\":" + x
                + ",\"y\":" + y + ",\"z\":" + z + ",\"bits\":\"" + cold + "\"}");
        }
        System.out.println("]}");
    }
}
