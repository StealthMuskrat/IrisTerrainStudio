// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;
import art.arcane.iris.generation.image.*;
import com.google.gson.*;
import javax.imageio.ImageIO;
import java.awt.image.*;
import java.nio.file.*;

/** Five tiny PNGs, three maps and twelve points: authoring boundaries, not terrain parity. */
public final class NativeImageAuthoringFixtures {
    public static void main(String[] args)throws Exception {
        Path output=Path.of(args[0]);Files.createDirectories(output);JsonObject result=new JsonObject();JsonArray images=new JsonArray();
        for(int depth:new int[]{1,2,4}){
            int count=1<<depth;byte[] gray=new byte[count];for(int i=0;i<count;i++)gray[i]=(byte)(i*255/(count-1));
            var model=new IndexColorModel(depth,count,gray,gray,gray);var raster=Raster.createPackedRaster(DataBuffer.TYPE_BYTE,5,2,1,depth,null);
            for(int y=0;y<2;y++)for(int x=0;x<5;x++)raster.setSample(x,y,0,(x+y)%count);
            images.add(NativePngModesFixtures.write(output,depth==2?"packed-key-zero-2":"packed-key-"+depth,new BufferedImage(model,raster,false,null),true,1));
        }
        var rgb=new BufferedImage(2,2,BufferedImage.TYPE_3BYTE_BGR);int[] colors={0xff0000,0x00ff00,0x0000ff,0xffffff};for(int i=0;i<4;i++)rgb.setRGB(i%2,i/2,colors[i]);
        var gray=new BufferedImage(2,2,BufferedImage.TYPE_BYTE_GRAY);for(int i=0;i<4;i++)gray.getRaster().setSample(i%2,i/2,0,i*85);
        images.add(NativePngModesFixtures.write(output,"author-rgb",rgb,false,0));images.add(NativePngModesFixtures.write(output,"author-gray",gray,false,0));
        String[] configs={"{\"source\":\"author-gray\",\"type\":\"GRAYSCALE_HEIGHT\",\"sampling\":\"BILINEAR\",\"outOfBounds\":\"CLAMP\",\"minimumHeight\":8,\"maximumHeight\":48,\"verticalOffset\":10}","{\"source\":\"author-rgb\",\"type\":\"COLOR_MAP\",\"colors\":{\"#FF0000\":\"minecraft:stone\"},\"unknownColor\":\"FALLBACK\",\"fallbackTarget\":\"minecraft:dirt\"}","{\"source\":\"author-rgb\",\"type\":\"RGB_HEIGHT\",\"sampling\":\"BICUBIC\",\"outOfBounds\":\"ERROR\"}"};
        double[][] points={{0,0},{.5,.5},{1,1},{-1,0}};JsonArray maps=new JsonArray();
        for(int i=0;i<configs.length;i++){
            var config=JsonParser.parseString(configs[i]).getAsJsonObject();var definition=new Gson().fromJson(config,IrisImageMap.class);var map=CompiledIrisImageMap.compile(definition,new IrisImage(ImageIO.read(output.resolve(definition.getSource()+".png").toFile())));JsonObject row=new JsonObject();row.addProperty("key","author-"+i);row.add("config",config);row.addProperty("contentHash",map.getContentHash());row.addProperty("clippedPixelCount",map.getClippedPixelCount());row.addProperty("unknownColorPixelCount",map.getUnknownColorPixelCount());JsonArray samples=new JsonArray();
            for(var point:points){var sample=new JsonObject();sample.addProperty("x",point[0]);sample.addProperty("z",point[1]);try{sample.addProperty("type",map.getType().name());sample.addProperty("insideSource",map.containsWorld(point[0],point[1]));sample.addProperty("samplingKernelInsideSource",map.containsWorldForSampling(point[0],point[1]));if(map.getType()==IrisImageMapType.COLOR_MAP)sample.addProperty("target",map.sampleTarget(point[0],point[1]));else{sample.addProperty("normalized",map.sampleNormalized(point[0],point[1]));sample.addProperty("worldHeight",map.sampleHeight(point[0],point[1]));}}catch(Exception error){sample=new JsonObject();sample.addProperty("x",point[0]);sample.addProperty("z",point[1]);sample.addProperty("error",error.getMessage());}samples.add(sample);}
            row.add("samples",samples);maps.add(row);
        }
        result.add("images",images);result.add("maps",maps);Files.writeString(output.resolve("authoring.json"),new GsonBuilder().setPrettyPrinting().serializeNulls().create().toJson(result));
    }
}
