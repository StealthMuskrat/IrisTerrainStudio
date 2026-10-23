// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import org.objectweb.asm.*;
import org.objectweb.asm.commons.*;

/** Executes original mip/solidify bytecode with only NativeImage memory IO replaced. No GPU/native allocation. */
public final class MinecraftMipmapCheck {
    public static final class Image {
        final int width,height;final int[] pixels;
        public Image(int width,int height,boolean clear){this.width=width;this.height=height;pixels=new int[width*height];}
        public int getWidth(){return width;}public int getHeight(){return height;}
        public int getPixel(int x,int y){return pixels[x+y*width];}public void setPixel(int x,int y,int value){pixels[x+y*width]=value;}
    }
    static final class HostLoader extends ClassLoader {
        final JarFile jar;HostLoader(Path path)throws Exception{super(MinecraftMipmapCheck.class.getClassLoader());jar=new JarFile(path.toFile());}
        @Override protected Class<?> loadClass(String name,boolean resolve)throws ClassNotFoundException{
            if(!name.equals("net.minecraft.client.renderer.texture.MipmapGenerator")&&!name.equals("com.mojang.blaze3d.platform.TextureUtil"))return super.loadClass(name,resolve);
            var type=findLoadedClass(name);if(type==null)try(var stream=jar.getInputStream(jar.getJarEntry(name.replace('.','/')+".class"))){
                var writer=new ClassWriter(0);var remapper=new Remapper(){@Override public String map(String value){return value.equals("com/mojang/blaze3d/platform/NativeImage")?"MinecraftMipmapCheck$Image":value;}};
                var filter=new ClassVisitor(Opcodes.ASM9,new ClassRemapper(writer,remapper)){
                    @Override public MethodVisitor visitMethod(int a,String method,String descriptor,String signature,String[] exceptions){
                        if(name.endsWith("TextureUtil")&&!Set.of("<clinit>","solidify","fillEmptyAreasWithDarkColor","pack","x","y").contains(method))return null;
                        return super.visitMethod(a,method,descriptor,signature,exceptions);
                    }
                };new ClassReader(stream).accept(filter,0);var bytes=writer.toByteArray();type=defineClass(name,bytes,0,bytes.length);
            }catch(Exception e){throw new ClassNotFoundException(name,e);}if(resolve)resolveClass(type);return type;
        }
    }
    public static void main(String[] args)throws Exception{
        var request=JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonObject();var out=new JsonObject();var tables=new JsonObject();
        for(String field:new String[]{"SRGB_TO_LINEAR","LINEAR_TO_SRGB"}){var f=net.minecraft.util.ARGB.class.getDeclaredField(field);f.setAccessible(true);Object values=f.get(null);var row=new JsonArray();for(int i=0;i<java.lang.reflect.Array.getLength(values);i++)row.add(((Number)java.lang.reflect.Array.get(values,i)).intValue()&(field.equals("LINEAR_TO_SRGB")?255:65535));tables.add(field,row);}out.add("tables",tables);
        var loader=new HostLoader(Path.of(args[0]));var method=loader.loadClass("net.minecraft.client.renderer.texture.MipmapGenerator").getMethod("generateMipLevels",net.minecraft.resources.Identifier.class,Image[].class,int.class,net.minecraft.client.renderer.texture.MipmapStrategy.class,float.class,com.mojang.blaze3d.platform.Transparency.class);
        var results=new JsonArray();for(var value:request.getAsJsonArray("images")){var row=value.getAsJsonObject();var image=new Image(row.get("width").getAsInt(),row.get("height").getAsInt(),false);var rgba=row.getAsJsonArray("pixels");boolean transparent=false,translucent=false;
            for(int i=0;i<image.pixels.length;i++){int at=i*4,r=rgba.get(at).getAsInt(),g=rgba.get(at+1).getAsInt(),b=rgba.get(at+2).getAsInt(),a=rgba.get(at+3).getAsInt();image.pixels[i]=a<<24|r<<16|g<<8|b;transparent|=a==0;translucent|=a>0&&a<255;}
            var levels=(Image[])method.invoke(null,net.minecraft.resources.Identifier.parse(row.get("name").getAsString()),new Image[]{image},row.get("levels").getAsInt(),net.minecraft.client.renderer.texture.MipmapStrategy.valueOf(row.get("strategy").getAsString().toUpperCase(Locale.ROOT)),row.get("bias").getAsFloat(),com.mojang.blaze3d.platform.Transparency.of(transparent,translucent));var result=new JsonArray();
            for(var mip:levels){var record=new JsonObject();record.addProperty("width",mip.width);record.addProperty("height",mip.height);var pixels=new JsonArray();for(int p:mip.pixels){pixels.add(p>>16&255);pixels.add(p>>8&255);pixels.add(p&255);pixels.add(p>>>24);}record.add("pixels",pixels);result.add(record);}results.add(result);
        }out.add("images",results);var metadata=new JsonArray();for(var value:request.getAsJsonArray("metadata")){var row=new JsonObject();try{var parsed=net.minecraft.client.resources.metadata.texture.TextureMetadataSection.CODEC.parse(com.mojang.serialization.JsonOps.INSTANCE,value).getOrThrow();row.addProperty("accepted",true);row.addProperty("strategy",parsed.mipmapStrategy().getSerializedName());row.addProperty("bias",parsed.alphaCutoffBias());row.addProperty("blur",parsed.blur());row.addProperty("clamp",parsed.clamp());}catch(Exception e){row.addProperty("accepted",false);}metadata.add(row);}out.add("metadata",metadata);
        Files.writeString(Path.of(args[2]),new Gson().toJson(out)+"\n");loader.jar.close();
    }
}
