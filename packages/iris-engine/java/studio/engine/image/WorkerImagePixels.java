// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
/** Owned raw PNG bands. Native IrisImage retains coordinate checks, scaling and color-mode decisions. */
public final class WorkerImagePixels {
    private final int width,height,channels,depth;private final byte[] samples;
    public WorkerImagePixels(int width,int height,int channels,int depth,byte[] samples){
        if(width<1||height<1||width>16384||height>16384||(long)width*height>4194304||!((channels==1&&(depth==8||depth==16))||((channels==3||channels==4)&&depth==8))||(long)width*height*channels*(depth/8)!=samples.length)throw new IllegalArgumentException("Invalid owned native image bands");
        this.width=width;this.height=height;this.channels=channels;this.depth=depth;this.samples=samples.clone();
    }
    public WorkerImagePixels(int width,int height,int type){this(width,height,3,8,defaults(width,height,type));}
    private static byte[] defaults(int w,int h,int type){if(w!=4||h!=4||type!=1)throw studio.engine.UnsupportedPlatform.unavailable("Unconnected BufferedImage constructor");return new byte[48];}
    public int getWidth(){return width;}public int getHeight(){return height;}
    public Raster getRaster(){return new Raster();}public ColorModel getColorModel(){return new ColorModel(channels);}
    public int getRGB(int x,int y){if(channels==1)throw studio.engine.UnsupportedPlatform.unavailable("Grayscale AWT preview color conversion");int at=(y*width+x)*channels;return ((channels==4?samples[at+3]&255:255)<<24)|((samples[at]&255)<<16)|((samples[at+1]&255)<<8)|(samples[at+2]&255);}
    public final class Raster {
        public int getNumBands(){return channels;}public SampleModel getSampleModel(){return new SampleModel(channels,depth);}
        public int getSample(int x,int y,int band){if(x<0||y<0||x>=width||y>=height||band<0||band>=channels)throw new IndexOutOfBoundsException("Image band coordinate");int at=((y*width+x)*channels+band)*(depth/8);return depth==8?samples[at]&255:((samples[at]&255)<<8)|(samples[at+1]&255);}
    }
    public static class ColorModel {private final int channels;ColorModel(int channels){this.channels=channels;}public int getNumColorComponents(){return channels==4?3:channels;}public boolean hasAlpha(){return channels==4;}}
    public static final class IndexedColorModel extends ColorModel {public IndexedColorModel(){super(1);}}
    public static final class SampleModel {private final int channels,depth;SampleModel(int channels,int depth){this.channels=channels;this.depth=depth;}public int getSampleSize(int band){return depth;}public int[] getSampleSize(){int[] sizes=new int[channels];java.util.Arrays.fill(sizes,depth);return sizes;}}
}
