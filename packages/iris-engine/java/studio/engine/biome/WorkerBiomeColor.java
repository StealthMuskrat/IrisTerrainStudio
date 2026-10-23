// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.biome;

/** Integer-only Color.decode/getRGB boundary; original native parsing/fallback code remains. */
public final class WorkerBiomeColor {
    private final int rgb;
    private WorkerBiomeColor(int rgb){this.rgb=rgb;}
    public static WorkerBiomeColor decode(String value){return new WorkerBiomeColor(Integer.decode(value));}
    public int getRGB(){return 0xff000000|(rgb&0xffffff);}
}
