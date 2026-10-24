// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
/** Owned raw PNG bands. Native IrisImage retains coordinate checks, scaling and color-mode decisions. */
public final class WorkerImagePixels {
    private final int width,height,channels,depth,bytesPerSample;private final byte[] samples,palette;
    public WorkerImagePixels(int width,int height,int channels,int depth,byte[] samples){this(width,height,channels,depth,samples,null);}
    public WorkerImagePixels(int width,int height,int channels,int depth,byte[] samples,byte[] palette){
        boolean indexed=palette!=null;
        if(width<1||height<1||width>16384||height>16384||(long)width*height>4194304||!(indexed?channels==1&&(depth==1||depth==2||depth==4||depth==8)&&palette.length==4*(1<<depth):channels>=1&&channels<=4&&(depth==8||depth==16))||(long)width*height*channels*Math.max(1,depth/8)!=samples.length)throw new IllegalArgumentException("Invalid owned native image bands");
        if(indexed)for(byte value:samples)if((value&255)>=(1<<depth))throw new IllegalArgumentException("Indexed image sample exceeds its bit depth");
        this.width=width;this.height=height;this.channels=channels;this.depth=depth;this.bytesPerSample=Math.max(1,depth/8);this.samples=samples.clone();this.palette=palette==null?null:palette.clone();
    }
    public WorkerImagePixels(int width,int height,int type){this(width,height,3,8,defaults(width,height,type));}
    private static byte[] defaults(int w,int h,int type){if(w!=4||h!=4||type!=1)throw studio.engine.UnsupportedPlatform.unavailable("Unconnected BufferedImage constructor");return new byte[48];}
    public int getWidth(){return width;}public int getHeight(){return height;}
    public Raster getRaster(){return new Raster();}public ColorModel getColorModel(){return palette==null?new ColorModel(channels):new IndexedColorModel(palette);}
    public int getRGB(int x,int y){
        if(palette!=null){int at=(samples[y*width+x]&255)*4;return ((palette[at+3]&255)<<24)|((palette[at]&255)<<16)|((palette[at+1]&255)<<8)|(palette[at+2]&255);}
        if(channels<=2||depth!=8)throw studio.engine.UnsupportedPlatform.unavailable("Grayscale or high-depth AWT preview color conversion");int at=(y*width+x)*channels;return ((channels==4?samples[at+3]&255:255)<<24)|((samples[at]&255)<<16)|((samples[at+1]&255)<<8)|(samples[at+2]&255);
    }
    public final class Raster {
        public int getNumBands(){return channels;}public SampleModel getSampleModel(){return new SampleModel(channels,depth);}
        public int getSample(int x,int y,int band){if(x<0||y<0||x>=width||y>=height||band<0||band>=channels)throw new IndexOutOfBoundsException("Image band coordinate");int at=((y*width+x)*channels+band)*bytesPerSample;return depth<=8?samples[at]&255:((samples[at]&255)<<8)|(samples[at+1]&255);}
    }
    public static class ColorModel {private final int channels;ColorModel(int channels){this.channels=channels;}public int getNumColorComponents(){return channels<=2?1:3;}public boolean hasAlpha(){return channels==2||channels==4;}}
    public static final class IndexedColorModel extends ColorModel {private final boolean alpha;IndexedColorModel(byte[] palette){super(1);boolean found=false;for(int i=3;i<palette.length;i+=4)found|=(palette[i]&255)!=255;alpha=found;}@Override public int getNumColorComponents(){return 3;}@Override public boolean hasAlpha(){return alpha;}}
    public static final class SampleModel {private final int channels,depth;SampleModel(int channels,int depth){this.channels=channels;this.depth=depth;}public int getSampleSize(int band){return depth;}public int[] getSampleSize(){int[] sizes=new int[channels];java.util.Arrays.fill(sizes,depth);return sizes;}}
}
