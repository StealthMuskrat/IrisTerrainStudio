// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;

import art.arcane.iris.generation.image.CompiledIrisImageMap;
import art.arcane.iris.generation.image.IrisImageMapType;
import com.google.gson.stream.JsonWriter;
import java.io.IOException;
import java.io.StringWriter;

/** Authoring diagnostics only; all decoding, coordinate and sampling decisions remain native. */
public final class ImageMapInspection {
    private ImageMapInspection() {}
    public static void describe(CompiledIrisImageMap map,JsonWriter json)throws IOException {
        var definition=map.getDefinition();var source=map.getSourceMetadata();
        json.name("mapType").value(map.getType().name());
        json.name("sampling").value(definition.getSampling().name());
        json.name("outOfBounds").value(definition.getOutOfBounds().name());
        json.name("alphaPolicy").value(definition.getAlpha().name());
        json.name("sourceColorMode").value(source.colorMode().name());
        json.name("sourceBitDepth").value(source.bitDepth());
        json.name("sourceChannels").value(source.channels());
        json.name("minimumAlpha").value(source.minimumAlpha());json.name("maximumAlpha").value(source.maximumAlpha());
        json.name("clippedPixelCount").value(map.getClippedPixelCount());
        json.name("unknownColorPixelCount").value(map.getUnknownColorPixelCount());
    }
    public static String sample(CompiledIrisImageMap map,double x,double z)throws IOException {
        if(!Double.isFinite(x)||!Double.isFinite(z))throw new IllegalArgumentException("Image-map coordinates must be finite");
        StringWriter output=new StringWriter();try(JsonWriter json=new JsonWriter(output)){
            json.beginObject();json.name("x").value(x);json.name("z").value(z);
            json.name("type").value(map.getType().name());
            json.name("insideSource").value(map.containsWorld(x,z));
            json.name("samplingKernelInsideSource").value(map.containsWorldForSampling(x,z));
            if(map.getType()==IrisImageMapType.COLOR_MAP)json.name("target").value(map.sampleTarget(x,z));
            else{json.name("normalized").value(map.sampleNormalized(x,z));
                if(map.getType()==IrisImageMapType.GRAYSCALE_HEIGHT||map.getType()==IrisImageMapType.RGB_HEIGHT)json.name("worldHeight").value(map.sampleHeight(x,z));}
            json.endObject();
        }return output.toString();
    }
}
