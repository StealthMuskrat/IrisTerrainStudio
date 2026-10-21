// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
import art.arcane.iris.generation.image.*;
import art.arcane.iris.generation.terrain.IrisDimension;
import art.arcane.iris.pack.loading.IrisData;
import com.google.gson.stream.JsonWriter;
import java.io.IOException;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;

/** Read-only dimension binding inspection. Original runtime/compiler/mask samplers decide all values. */
public final class DimensionImageMaps {
    private record Bound(IrisImageMapBinding definition,CompiledIrisImageMap compiled,IrisImageMapMaskSampler masks){}
    private final IrisDimension dimension;
    private final IrisImageMapRuntime runtime;
    private final List<Bound> bindings;
    public DimensionImageMaps(IrisData data,IrisDimension dimension){
        this.dimension=dimension;
        var definitions=dimension.getImageMaps();
        if(definitions.size()>64)throw new IllegalArgumentException("Dimension image-map inspection exceeds 64 bindings");
        for(var binding:definitions)if(binding!=null&&binding.getMasks()!=null&&binding.getMasks().size()>16)throw new IllegalArgumentException("Dimension image-map inspection exceeds 16 masks per binding");
        runtime=IrisImageMapRuntime.compile(data,dimension,dimension.getMinHeight());
        List<Bound> prepared=new ArrayList<>();
        for(var binding:definitions){
            List<IrisImageMapMaskSampler.Layer> layers=new ArrayList<>();
            if(binding.getMasks()!=null)for(var mask:binding.getMasks())layers.add(IrisImageMapMaskSampler.layer(runtime.getCompiled(mask.getMap().trim()),mask));
            prepared.add(new Bound(binding,runtime.getCompiled(binding.getKey().trim()),new IrisImageMapMaskSampler(layers)));
        }
        bindings=List.copyOf(prepared);
    }
    public String describe()throws IOException{
        StringWriter output=new StringWriter();try(JsonWriter json=new JsonWriter(output)){
            json.beginObject();json.name("dimension").value(dimension.getLoadKey());json.name("minimumWorldY").value(dimension.getMinHeight());json.name("bindings").beginArray();
            for(var bound:bindings){var definition=bound.definition();json.beginObject();json.name("key").value(definition.getKey().trim());json.name("map").value(definition.getMap().trim());json.name("application").value(definition.getApplication().name());json.name("source").value(bound.compiled().getDefinition().getSource());json.name("sourceWidth").value(bound.compiled().getSourceWidth());json.name("sourceHeight").value(bound.compiled().getSourceHeight());ImageMapInspection.describe(bound.compiled(),json);json.name("contentHash").value(bound.compiled().getContentHash());json.name("masks").beginArray();
                if(definition.getMasks()!=null)for(var mask:definition.getMasks()){json.beginObject();json.name("map").value(mask.getMap().trim());json.name("operation").value(mask.getOperation().name());json.name("inverted").value(mask.isInverted());json.name("threshold").value(mask.getThreshold());json.name("falloff").value(mask.getFalloff());json.endObject();}json.endArray();json.endObject();
            }json.endArray();json.endObject();
        }return output.toString();
    }
    public String sample(double x,double z)throws IOException{
        if(!Double.isFinite(x)||!Double.isFinite(z))throw new IllegalArgumentException("Dimension image-map coordinates must be finite");
        var region=runtime.sampleRegion(x,z);var biome=runtime.sampleBiome(x,z);var block=runtime.sampleSurfaceBlock(x,z);
        StringWriter output=new StringWriter();try(JsonWriter json=new JsonWriter(output)){
            json.setSerializeNulls(true);json.beginObject();json.name("x").value(x);json.name("z").value(z);json.name("regionOverride").value(region==null?null:region.getLoadKey());json.name("biomeOverride").value(biome==null?null:biome.getLoadKey());json.name("surfaceBlockOverride").value(block==null?null:block.key());json.name("bindings").beginArray();
            for(var bound:bindings){var map=bound.compiled();var definition=bound.definition();double weight=bound.masks().sample(x,z);json.beginObject();json.name("key").value(definition.getKey().trim());json.name("application").value(definition.getApplication().name());json.name("maskWeight").value(weight);if(definition.getApplication()==IrisImageMapApplication.REGION||definition.getApplication()==IrisImageMapApplication.BIOME||definition.getApplication()==IrisImageMapApplication.SURFACE_BLOCK)json.name("categoricalSelected").value(IrisImageMapRuntime.selectCategorical(weight));json.name("sample").jsonValue(ImageMapInspection.sample(map,x,z));json.endObject();}
            json.endArray();json.endObject();
        }return output.toString();
    }
}
