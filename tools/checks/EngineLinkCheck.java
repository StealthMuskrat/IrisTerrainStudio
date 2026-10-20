// SPDX-License-Identifier: GPL-3.0-or-later
import studio.engine.BrowserEngine;
import studio.engine.SplittableCompat;
import java.util.SplittableRandom;

public final class EngineLinkCheck {
    public static void main(String[] args) {
        for (long seed : new long[]{0,1,-1,813753,Long.MIN_VALUE,Long.MAX_VALUE}) {
            SplittableRandom nativeRandom=new SplittableRandom(seed);
            SplittableCompat browserRandom=new SplittableCompat(seed);
            for(int i=0;i<64;i++) {
                if(nativeRandom.nextLong()!=browserRandom.nextLong())throw new AssertionError("nextLong");
                if(Double.doubleToRawLongBits(nativeRandom.nextDouble(Math.PI*2))!=Double.doubleToRawLongBits(browserRandom.nextDouble(Math.PI*2)))throw new AssertionError("bounded nextDouble");
                if(Double.doubleToRawLongBits(nativeRandom.nextDouble(-0.55,0.55))!=Double.doubleToRawLongBits(browserRandom.nextDouble(-0.55,0.55)))throw new AssertionError("ranged nextDouble");
            }
        }
        System.out.println(BrowserEngine.diagnosticRng("813753"));
        System.out.println(BrowserEngine.noiseStyles());
        System.out.println(BrowserEngine.sampleStyle("PERLIN","813753",17.25,64,-3.5,2));
        System.out.println(BrowserEngine.sampleStyle("MARBLE","-1",17.25,64,-3.5,3));
        BrowserEngine.defineStyle("probe","PERLIN",3,1.25,0,1,"",1,2);
        System.out.println(BrowserEngine.sampleConfigured("probe","813753",17.25,64,-3.5,2));
        System.out.println(BrowserEngine.seedComponents("813753"));
    }
}
