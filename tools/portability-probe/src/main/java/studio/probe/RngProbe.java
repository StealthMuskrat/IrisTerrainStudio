// SPDX-License-Identifier: GPL-3.0-or-later
// Development-only harness; all RNG operations call unmodified upstream code.
package studio.probe;

import art.arcane.volmlib.util.math.RNG;

public final class RngProbe {
    private static final String[] NUMERIC = {
        "-9223372036854775808", "-1", "0", "42", "813753", "9007199254740993", "9223372036854775807"
    };
    private static final String[] TEXT = {
        "", "Iris World Generator", "terrain", "-9223372036854775808", "洞窟🌲", "é", "e\u0301",
        "line\n\u0000seed", "\uD800", "\uDC00"
    };
    private static final String[] SIGNATURES = {
        "-9223372036854775808", "-1", "0", "9223372036854775807"
    };

    public static String sample(String seed, boolean textSeed, String signature) {
        RNG initial = textSeed ? new RNG(seed) : new RNG(Long.parseLong(seed));
        RNG rng = initial.nextParallelRNG(Long.parseLong(signature));
        StringBuilder out = new StringBuilder();
        for (int round = 0; round < 16; round++) {
            if (round > 0) out.append(':');
            out.append(hex(rng.nextLong())).append(':');
            out.append(hex(rng.imax())).append(':');
            out.append(hex(rng.lmax())).append(':');
            out.append(bits(rng.d(-Math.PI, Math.E))).append(':');
            out.append(bits(rng.d(Math.PI, -Math.E))).append(':');
            out.append(hex(rng.getSeed())).append(':');
            out.append(bits(rng.nextDouble()));
        }
        return out.toString();
    }

    private static String bits(double value) {
        if (!Double.isFinite(value)) throw new IllegalStateException("Non-finite RNG result");
        return hex(Double.doubleToRawLongBits(value));
    }

    private static String hex(long value) {
        String hex = Long.toHexString(value);
        return "0000000000000000".substring(hex.length()) + hex;
    }

    private static String jsonString(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index++) {
            char c = value.charAt(index);
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 32 || c >= 127) {
                String hex = Integer.toHexString(c);
                out.append("\\u").append("0000".substring(hex.length())).append(hex);
            } else out.append(c);
        }
        return out.append('"').toString();
    }

    public static void main(String[] args) {
        UuidCompat.verifyAgainstNativeJdk();
        System.out.print("{\"formatVersion\":1,\"scope\":\"volmlib-rng-portability\",\"cases\":[");
        int id = 0;
        for (int mode = 0; mode < 2; mode++) for (String seed : mode == 0 ? NUMERIC : TEXT) for (String signature : SIGNATURES) {
            if (id != 0) System.out.print(',');
            String bits = sample(seed, mode == 1, signature);
            if (!bits.equals(sample(seed, mode == 1, signature))) throw new IllegalStateException("Native RNG reset mismatch");
            System.out.print("{\"id\":" + id++ + ",\"seed\":" + jsonString(seed) + ",\"textSeed\":" + (mode == 1)
                + ",\"signature\":" + jsonString(signature) + ",\"bits\":" + jsonString(bits) + "}");
        }
        System.out.println("]}");
    }
}
