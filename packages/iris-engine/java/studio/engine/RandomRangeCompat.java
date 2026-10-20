/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates. All rights reserved.
 * SPDX-License-Identifier: GPL-2.0-only WITH Classpath-exception-2.0
 * Derived from pinned OpenJDK RandomGenerator.nextInt(origin,bound) and
 * RandomSupport.boundedNextInt. See JDK-ADAPTER-NOTICE.md.
 */
package studio.engine;
import java.util.Random;
public final class RandomRangeCompat {
    private RandomRangeCompat() {}
    public static int nextInt(Random rng, int origin, int bound) {
        if (origin >= bound) throw new IllegalArgumentException("bound must exceed origin");
        int r = rng.nextInt();
        if (origin < bound) {
            final int n = bound - origin;
            final int m = n - 1;
            if ((n & m) == 0) {
                r = (r & m) + origin;
            } else if (n > 0) {
                for (int u = r >>> 1; u + m - (r = u % n) < 0; u = rng.nextInt() >>> 1) ;
                r += origin;
            } else {
                while (r < origin || r >= bound) r = rng.nextInt();
            }
        }
        return r;
    }
}
