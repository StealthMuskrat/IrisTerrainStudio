// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.generation.image.IrisImage;
import com.google.gson.*;
import javax.imageio.*;
import javax.imageio.metadata.*;
import javax.imageio.stream.*;
import java.awt.image.*;
import java.nio.file.*;

/** Tiny sources produced and decoded by the pinned JDK ImageIO plugin, independently of the JS decoder. */
public final class NativePngInputFixtures {
    public static void main(String[] args)throws Exception {
        Path output=Path.of(args[0]);Files.createDirectories(output);JsonArray result=new JsonArray();
        BufferedImage gray=new BufferedImage(5,5,BufferedImage.TYPE_USHORT_GRAY);
        for(int y=0;y<5;y++)for(int x=0;x<5;x++)gray.getRaster().setSample(x,y,0,(x*8009+y*12347)&65535);
        result.add(write(output,"gray-adam7",gray,true,false));
        BufferedImage rgba=new BufferedImage(3,3,BufferedImage.TYPE_4BYTE_ABGR);
        for(int y=0;y<3;y++)for(int x=0;x<3;x++)for(int b=0;b<4;b++)rgba.getRaster().setSample(x,y,b,b==3?(x+y)%3*127:(x*51+y*73+b*47)&255);
        result.add(write(output,"rgba-adam7",rgba,true,false));
        BufferedImage rgb=new BufferedImage(3,2,BufferedImage.TYPE_3BYTE_BGR);
        for(int y=0;y<2;y++)for(int x=0;x<3;x++)for(int b=0;b<3;b++)rgb.getRaster().setSample(x,y,b,x==0?new int[]{11,22,33}[b]:(x*61+y*89+b*31)&255);
        result.add(write(output,"key-adam7",rgb,true,true));
        result.add(write(output,"key-plain",rgb,false,true));
        Files.writeString(output.resolve("fixtures.json"),new GsonBuilder().setPrettyPrinting().create().toJson(result));
    }
    private static JsonObject write(Path output,String name,BufferedImage image,boolean interlace,boolean transparency)throws Exception {
        ImageWriter writer=ImageIO.getImageWritersByFormatName("png").next();ImageWriteParam param=writer.getDefaultWriteParam();param.setProgressiveMode(interlace?ImageWriteParam.MODE_DEFAULT:ImageWriteParam.MODE_DISABLED);
        IIOMetadata metadata=writer.getDefaultImageMetadata(ImageTypeSpecifier.createFromRenderedImage(image),param);
        if(transparency){
            IIOMetadataNode root=new IIOMetadataNode("javax_imageio_png_1.0"),palette=new IIOMetadataNode("PLTE");
            IIOMetadataNode entry=new IIOMetadataNode("PLTEEntry");entry.setAttribute("index","0");entry.setAttribute("red","11");entry.setAttribute("green","22");entry.setAttribute("blue","33");palette.appendChild(entry);root.appendChild(palette);
            IIOMetadataNode trns=new IIOMetadataNode("tRNS"),key=new IIOMetadataNode("tRNS_RGB");key.setAttribute("red","11");key.setAttribute("green","22");key.setAttribute("blue","33");trns.appendChild(key);root.appendChild(trns);metadata.mergeTree("javax_imageio_png_1.0",root);
        }
        Path file=output.resolve(name+".png");try(ImageOutputStream stream=ImageIO.createImageOutputStream(file.toFile())){writer.setOutput(stream);writer.write(null,new IIOImage(image,null,metadata),param);}finally{writer.dispose();}
        IrisImage decoded=new IrisImage(ImageIO.read(file.toFile()));JsonObject result=new JsonObject();result.addProperty("name",name);result.addProperty("width",decoded.getWidth());result.addProperty("height",decoded.getHeight());result.addProperty("channels",decoded.getChannelCount());result.addProperty("bitDepth",decoded.getBitDepth());result.addProperty("colorMode",decoded.getColorMode().name());result.addProperty("hasAlpha",decoded.hasAlpha());JsonArray bands=new JsonArray();
        for(int y=0;y<decoded.getHeight();y++)for(int x=0;x<decoded.getWidth();x++)for(int b=0;b<decoded.getChannelCount();b++)bands.add(decoded.getBandSample(x,y,b));result.add("bands",bands);return result;
    }
}
