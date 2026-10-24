// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.iris.generation.image.*;
import com.google.gson.*;
import javax.imageio.ImageIO;
import java.awt.color.*;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.io.ByteArrayOutputStream;
import java.util.zip.DeflaterOutputStream;

/** Two source pixels, original JDK PNG reader and original Iris map compiler. */
public final class NativePngMetadataCheck {
    public static void main(String[] args)throws Exception{
        Path directory=Path.of(args[1]);Files.createDirectories(directory);
        if(args[0].equals("inputs")){
            var image=new BufferedImage(2,1,BufferedImage.TYPE_4BYTE_ABGR);
            image.getRaster().setPixel(0,0,new int[]{11,22,33,255});image.getRaster().setPixel(1,0,new int[]{44,55,66,127});
            ImageIO.write(image,"png",directory.resolve("base.png").toFile());
            var output=new ByteArrayOutputStream();try(var compressed=new DeflaterOutputStream(output)){compressed.write(ICC_Profile.getInstance(ColorSpace.CS_LINEAR_RGB).getData());}
            Files.write(directory.resolve("linear-rgb.icc.z"),output.toByteArray());return;
        }
        var rows=new JsonArray();
        try(var paths=Files.list(directory)){
            for(Path path:paths.filter(p->p.toString().endsWith(".png")).sorted().toList()){
                var image=new IrisImage(ImageIO.read(path.toFile()));var row=new JsonObject();
                String name=path.getFileName().toString().replaceFirst("\\.png$","");
                row.addProperty("name",name);row.addProperty("width",image.getWidth());row.addProperty("height",image.getHeight());row.addProperty("channels",image.getChannelCount());row.addProperty("bitDepth",image.getBitDepth());row.addProperty("colorMode",image.getColorMode().name());row.addProperty("hasAlpha",image.hasAlpha());
                var bands=new JsonArray();var previews=new JsonArray();
                for(int x=0;x<2;x++){previews.add(image.getPreviewArgb(x,0));for(int b=0;b<image.getChannelCount();b++)bands.add(image.getBandSample(x,0,b));}
                row.add("bands",bands);row.add("previewArgb",previews);
                var definition=new IrisImageMap();definition.setSource(name);definition.setType(IrisImageMapType.ALPHA_MASK);
                var map=CompiledIrisImageMap.compile(definition,image);row.addProperty("contentHash",map.getContentHash());row.addProperty("sourceHash",map.getSourceMetadata().decodedContentHash());
                var samples=new JsonArray();for(int x=0;x<2;x++)samples.add(String.format("%016x",Double.doubleToRawLongBits(map.sampleNormalized(x,0))));row.add("normalized",samples);rows.add(row);
            }
        }
        Files.writeString(directory.resolve("reference.json"),new GsonBuilder().setPrettyPrinting().create().toJson(rows));
    }
}
