/*
 * Copyright (c) 2013, 2025, Oracle and/or its affiliates. All rights reserved.
 * SPDX-License-Identifier: GPL-2.0-only WITH Classpath-exception-2.0
 *
 * Restricted browser adapter derived from the pinned Temurin 25.0.4.1+1
 * java.util.SplittableRandom, java.util.random.RandomGenerator, and
 * jdk.internal.util.random.RandomSupport sources. Only the seeded constructor,
 * nextLong and nextDouble overloads used by the five pinned pattern-noise
 * classes are exposed. See tools/engine-build/JDK-ADAPTER-NOTICE.md.
 */
package studio.engine;

public final class SplittableCompat {
    private long seed;
    public SplittableCompat(long seed) { this.seed = seed; }
    public long nextLong() {
        long z = seed += 0x9e3779b97f4a7c15L;
        z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b9L;
        z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
        return z ^ (z >>> 31);
    }
    public double nextDouble() { return (nextLong() >>> 11) * 0x1.0p-53; }
    public double nextDouble(double bound) {
        if (!(bound > 0.0 && bound < Double.POSITIVE_INFINITY)) throw new IllegalArgumentException("bound must be positive and finite");
        double r = nextDouble();
        r = r * bound;
        if (r >= bound) r = Math.nextDown(bound);
        return r;
    }
    public double nextDouble(double origin, double bound) {
        if (!(origin < bound && origin > Double.NEGATIVE_INFINITY && bound < Double.POSITIVE_INFINITY)) throw new IllegalArgumentException("invalid random range");
        double r = nextDouble();
        if (origin < bound) {
            if (bound - origin < Double.POSITIVE_INFINITY) {
                r = r * (bound - origin) + origin;
            } else {
                double halfOrigin = 0.5 * origin;
                r = (r * (0.5 * bound - halfOrigin) + halfOrigin) * 2.0;
            }
            if (r >= bound) r = Math.nextDown(bound);
        }
        return r;
    }
}
