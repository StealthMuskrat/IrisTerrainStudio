// SPDX-License-Identifier: GPL-3.0-or-later
import art.arcane.iris.pack.loading.IrisData;
import art.arcane.iris.generation.noise.IrisGenerator;
import java.nio.file.*;

/** Focused native Gson/snippet reference for the browser field-reader integration. */
public final class NativeJsonLinkCheck {
    public static void main(String[] args)throws Exception{
        Path directory=Path.of(args[0]);IrisData data=IrisData.openDatapackCompiler(directory.toFile());
        String text=Files.readString(directory.resolve("generators/check.json"));
        IrisGenerator generator=data.getGson().fromJson(text,IrisGenerator.class);
        for(double[] point:new double[][]{{17.25,-3.5},{-128.5,64.25},{0,0}}){
            double value=generator.getHeight(point[0],point[1],813753);
            System.out.println(Long.toHexString(Double.doubleToRawLongBits(value)));
        }
    }
}
