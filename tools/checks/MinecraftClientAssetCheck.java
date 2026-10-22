// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import com.mojang.serialization.JsonOps;
import net.minecraft.server.packs.*;
import net.minecraft.server.packs.metadata.pack.PackFormat;
import net.minecraft.server.packs.resources.ResourceFilterSection;
import net.minecraft.client.resources.metadata.animation.*;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;

/** Small metadata/state reference from the exact client JAR. No client/GPU/world startup. */
public final class MinecraftClientAssetCheck {
    static Object field(Object value,String name)throws Exception{var f=value.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(value);}
    static Object call(Object value,String name)throws Exception{var m=value.getClass().getDeclaredMethod(name);m.setAccessible(true);return m.invoke(value);}
    public static void main(String[] args)throws Exception{
        var input=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject();var out=new JsonObject();
        var overlays=new JsonArray();for(var entry:input.getAsJsonArray("overlays")){var row=new JsonObject();try{var nativeValue=OverlayMetadataSection.codecForPackType(PackType.CLIENT_RESOURCES).parse(JsonOps.INSTANCE,entry).getOrThrow();row.addProperty("accepted",true);row.add("selected",new Gson().toJsonTree(nativeValue.overlaysForVersion(PackFormat.of(97,1))));}catch(Exception e){row.addProperty("accepted",false);}overlays.add(row);}out.add("overlays",overlays);
        var formats=new JsonArray();for(var entry:input.getAsJsonArray("formats")){var row=new JsonObject();try{var range=PackFormat.packCodec(PackType.CLIENT_RESOURCES).codec().parse(JsonOps.INSTANCE,entry).getOrThrow();row.addProperty("accepted",true);row.add("range",new Gson().toJsonTree(List.of(List.of(range.minInclusive().major(),range.minInclusive().minor()),List.of(range.maxInclusive().major(),range.maxInclusive().minor()))));}catch(Exception e){row.addProperty("accepted",false);}formats.add(row);}out.add("formats",formats);
        var filters=new JsonArray();for(var entry:input.getAsJsonArray("filters")){var request=entry.getAsJsonObject();var filter=ResourceFilterSection.TYPE.codec().parse(JsonOps.INSTANCE,request.get("filter")).getOrThrow();var answers=new JsonArray();for(var location:request.getAsJsonArray("locations")){var pair=location.getAsJsonArray();answers.add(filter.isNamespaceFiltered(pair.get(0).getAsString())&&filter.isPathFiltered(pair.get(1).getAsString()));}filters.add(answers);}out.add("filters",filters);
        if(input.has("resources")){var request=input.getAsJsonObject("resources");var packs=new ArrayList<PackResources>();for(var value:request.getAsJsonArray("packs")){var pack=value.getAsJsonObject();var primary=packResources(pack,"");var layers=new ArrayList<PackResources>();if(pack.getAsJsonObject("metadata").has("overlays")){var selected=OverlayMetadataSection.codecForPackType(PackType.CLIENT_RESOURCES).parse(JsonOps.INSTANCE,pack.getAsJsonObject("metadata").get("overlays")).getOrThrow().overlaysForVersion(PackFormat.of(97,1));for(var directory:selected)layers.add(packResources(pack,directory+"/"));}packs.add(new OverlayedPackResources(primary,layers));}var answers=new JsonArray();try(var manager=new net.minecraft.server.packs.resources.MultiPackResourceManager(PackType.CLIENT_RESOURCES,packs)){for(var query:request.getAsJsonArray("queries")){var resource=manager.getResource(net.minecraft.resources.Identifier.parse(query.getAsString()));var answer=new JsonObject();answer.addProperty("present",resource.isPresent());if(resource.isPresent()){try(var stream=resource.get().open()){answer.addProperty("text",new String(stream.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));}var animation=resource.get().metadata().getSection(AnimationMetadataSection.TYPE);answer.addProperty("frametime",animation.map(AnimationMetadataSection::defaultFrameTime).orElse(null));}answers.add(answer);}}out.add("resources",answers);}
        // Allocate only the metadata/state host. Native image allocation, upload and renderer startup are never invoked.
        var unsafeField=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");unsafeField.setAccessible(true);var unsafe=(sun.misc.Unsafe)unsafeField.get(null);
        var spriteType=Class.forName("net.minecraft.client.renderer.texture.SpriteContents");var sprite=unsafe.allocateInstance(spriteType);
        var create=spriteType.getDeclaredMethod("createAnimatedTexture",FrameSize.class,int.class,int.class,AnimationMetadataSection.class);create.setAccessible(true);
        var animations=new JsonArray();for(var entry:input.getAsJsonArray("animations")){var request=entry.getAsJsonObject();var meta=AnimationMetadataSection.CODEC.parse(JsonOps.INSTANCE,request.get("animation")).getOrThrow();int width=request.get("width").getAsInt(),height=request.get("height").getAsInt();var size=meta.calculateFrameSize(width,height);var row=new JsonObject();row.addProperty("width",size.width());row.addProperty("height",size.height());var animated=create.invoke(sprite,size,width,height,meta);var states=new JsonArray();
            Object state=null;Method tick=null;if(animated!=null){var type=Class.forName("net.minecraft.client.renderer.texture.SpriteContents$AnimationState");state=unsafe.allocateInstance(type);var f=type.getDeclaredField("animationInfo");f.setAccessible(true);f.set(state,animated);tick=type.getDeclaredMethod("tick");tick.setAccessible(true);}
            int elapsed=0;for(var value:request.getAsJsonArray("ticks")){int target=value.getAsInt();while(elapsed<target){if(state!=null)tick.invoke(state);elapsed++;}var sample=new JsonObject();int frame=state==null?0:(int)field(state,"frame"),sub=state==null?0:(int)field(state,"subFrame"),index=0,next=0,progress=0;if(animated!=null){var frames=(List<?>)field(animated,"frames");index=(int)call(frames.get(frame),"index");next=(int)call(frames.get((frame+1)%frames.size()),"index");int duration=(int)call(frames.get(frame),"time");if(meta.interpolatedFrames())progress=(int)(((float)sub/duration)*1000.0F);}sample.addProperty("frame",frame);sample.addProperty("index",index);sample.addProperty("next",next);sample.addProperty("progress",progress);states.add(sample);}row.add("states",states);animations.add(row);
        }out.add("animations",animations);Files.writeString(Path.of(args[1]),new GsonBuilder().serializeNulls().setPrettyPrinting().create().toJson(out));
    }
    static PackResources packResources(JsonObject pack,String prefix){
        var files=pack.getAsJsonObject("files");var metadata=pack.getAsJsonObject("metadata");
        return (PackResources)Proxy.newProxyInstance(MinecraftClientAssetCheck.class.getClassLoader(),new Class<?>[]{PackResources.class},(self,method,args)->switch(method.getName()){
            case "packId"->pack.get("name").getAsString();case "close"->null;
            case "location"->new PackLocationInfo(pack.get("name").getAsString(),net.minecraft.network.chat.Component.literal(pack.get("name").getAsString()),net.minecraft.server.packs.repository.PackSource.DEFAULT,Optional.empty());
            case "getNamespaces"->{var namespaces=new HashSet<String>();for(var name:files.keySet())if(name.startsWith(prefix+"assets/")){var rest=name.substring((prefix+"assets/").length());int slash=rest.indexOf('/');if(slash>=0)namespaces.add(rest.substring(0,slash));}yield namespaces;}
            case "getResource"->{var id=(net.minecraft.resources.Identifier)args[1];String path=prefix+"assets/"+id.getNamespace()+"/"+id.getPath();yield files.has(path)?(net.minecraft.server.packs.resources.IoSupplier<java.io.InputStream>)()->new java.io.ByteArrayInputStream(files.get(path).getAsString().getBytes(java.nio.charset.StandardCharsets.UTF_8)):null;}
            case "getMetadataSection"->{var type=(net.minecraft.server.packs.metadata.MetadataSectionType<?>)args[0];yield metadata.has(type.name())?type.codec().parse(JsonOps.INSTANCE,metadata.get(type.name())).getOrThrow():null;}
            default->throw new UnsupportedOperationException(method.toString());
        });
    }

}
