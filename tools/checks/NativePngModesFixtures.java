// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.generation.image.*;
import com.google.gson.*;
import javax.imageio.*;
import javax.imageio.metadata.*;
import javax.imageio.stream.*;
import java.awt.Transparency;
import java.awt.color.ColorSpace;
import java.awt.image.*;
import java.nio.file.*;

/** Tiny independent JDK raster/PNG sources; native IrisImage and compiler define the expected behavior. */
public final class NativePngModesFixtures {
    public static void main(String[] args)throws Exception{
        Path output=Path.of(args[0]);Files.createDirectories(output);JsonArray rows=new JsonArray();
        byte[] gray={0,85,(byte)170,(byte)255};var grayModel=new IndexColorModel(2,4,gray,gray,gray);var grayRaster=Raster.createPackedRaster(DataBuffer.TYPE_BYTE,5,2,1,2,null);
        for(int y=0;y<2;y++)for(int x=0;x<5;x++)grayRaster.setSample(x,y,0,(x+y)%4);
        rows.add(write(output,"packed-gray",new BufferedImage(grayModel,grayRaster,false,null),true,0));
        var colors=new IndexColorModel(2,4,new byte[]{11,44,77,99},new byte[]{22,55,88,66},new byte[]{33,66,99,44},new byte[]{0,127,(byte)255,(byte)255});var indices=Raster.createPackedRaster(DataBuffer.TYPE_BYTE,5,2,1,2,null);
        for(int y=0;y<2;y++)for(int x=0;x<5;x++)indices.setSample(x,y,0,(x+y)%4);
        rows.add(write(output,"indexed-alpha",new BufferedImage(colors,indices,false,null),true,0));
        for(int depth:new int[]{8,16})rows.add(write(output,"gray-alpha-"+depth,components(3,2,2,depth),true,0));
        rows.add(write(output,"rgb-16",components(2,2,3,16),false,0));
        rows.add(write(output,"rgba-16",components(2,2,4,16),true,0));
        var keyed=new BufferedImage(3,2,BufferedImage.TYPE_USHORT_GRAY);for(int y=0;y<2;y++)for(int x=0;x<3;x++)keyed.getRaster().setSample(x,y,0,x==0?12345:(x*12347+y*6007)&65535);
        rows.add(write(output,"gray-key-16",keyed,true,1));
        var legacy=new BufferedImage(2,1,BufferedImage.TYPE_3BYTE_BGR);legacy.getRaster().setPixel(0,0,new int[]{11,22,33});legacy.getRaster().setPixel(1,0,new int[]{44,55,66});rows.add(write(output,"rgb-key-8",legacy,false,2));
        Files.writeString(output.resolve("fixtures.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));
    }
    private static BufferedImage components(int width,int height,int channels,int depth){
        int dataType=depth==8?DataBuffer.TYPE_BYTE:DataBuffer.TYPE_USHORT;boolean alpha=channels==2||channels==4;int[] sizes=new int[channels];java.util.Arrays.fill(sizes,depth);
        var model=new ComponentColorModel(ColorSpace.getInstance(channels==2?ColorSpace.CS_GRAY:ColorSpace.CS_sRGB),sizes,alpha,false,alpha?Transparency.TRANSLUCENT:Transparency.OPAQUE,dataType);
        var raster=Raster.createInterleavedRaster(dataType,width,height,channels,null);int max=(1<<depth)-1;
        for(int y=0;y<height;y++)for(int x=0;x<width;x++)for(int b=0;b<channels;b++)raster.setSample(x,y,b,alpha&&b==channels-1?(x+y)%3*(max/2):(x*11003+y*7001+b*13003)&max);
        return new BufferedImage(model,raster,false,null);
    }
    private static JsonObject write(Path output,String name,BufferedImage source,boolean interlace,int key)throws Exception{
        ImageWriter writer=ImageIO.getImageWritersByFormatName("png").next();var param=writer.getDefaultWriteParam();param.setProgressiveMode(interlace?ImageWriteParam.MODE_DEFAULT:ImageWriteParam.MODE_DISABLED);var metadata=writer.getDefaultImageMetadata(ImageTypeSpecifier.createFromRenderedImage(source),param);
        if(key!=0){var root=new IIOMetadataNode("javax_imageio_png_1.0");var trns=new IIOMetadataNode("tRNS");var value=new IIOMetadataNode(key==1?"tRNS_Grayscale":"tRNS_RGB");if(key==1)value.setAttribute("gray","12345");else{value.setAttribute("red","11");value.setAttribute("green","22");value.setAttribute("blue","33");}trns.appendChild(value);root.appendChild(trns);metadata.mergeTree("javax_imageio_png_1.0",root);}
        Path file=output.resolve(name+".png");try(ImageOutputStream stream=ImageIO.createImageOutputStream(file.toFile())){writer.setOutput(stream);writer.write(null,new IIOImage(source,null,metadata),param);}finally{writer.dispose();}
        var image=new IrisImage(ImageIO.read(file.toFile()));var row=new JsonObject();row.addProperty("name",name);row.addProperty("width",image.getWidth());row.addProperty("height",image.getHeight());row.addProperty("channels",image.getChannelCount());row.addProperty("bitDepth",image.getBitDepth());row.addProperty("colorMode",image.getColorMode().name());row.addProperty("hasAlpha",image.hasAlpha());
        JsonArray bands=new JsonArray(),sampleBands=new JsonArray();for(int y=0;y<image.getHeight();y++)for(int x=0;x<image.getWidth();x++){var pixel=new JsonArray();pixel.add(x);pixel.add(y);for(int b=0;b<image.getChannelCount();b++){int value=image.getBandSample(x,y,b);bands.add(value);pixel.add(value);}if(x<4&&y<2)sampleBands.add(pixel);}row.add("bands",bands);row.add("sampleBands",sampleBands);
        var definition=new IrisImageMap();definition.setSource(name);definition.setType(image.getColorMode()==IrisImageColorMode.INDEXED?IrisImageMapType.COLOR_MAP:image.getChannelCount()<=2?IrisImageMapType.GRAYSCALE_HEIGHT:IrisImageMapType.ALPHA_MASK);
        row.addProperty("mapType",definition.getType().name());try{var map=CompiledIrisImageMap.compile(definition,image);row.addProperty("contentHash",map.getContentHash());row.addProperty("sourceHash",map.getSourceMetadata().decodedContentHash());var values=new JsonArray();for(int x=0;x<2;x++)values.add(String.format("%016x",Double.doubleToRawLongBits(map.sampleNormalized(x,0))));row.add("normalized",values);}catch(IrisImageMapValidationException failure){row.addProperty("validationError",failure.getMessage());}
        return row;
    }
}
