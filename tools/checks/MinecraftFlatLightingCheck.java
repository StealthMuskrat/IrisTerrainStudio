// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import com.mojang.blaze3d.vertex.QuadInstance;
import java.lang.reflect.*;import java.nio.file.*;import java.util.*;import java.util.jar.*;
import net.minecraft.client.renderer.block.*;import net.minecraft.client.resources.model.geometry.BakedQuad;
import net.minecraft.core.*;import net.minecraft.world.level.*;import net.minecraft.world.level.biome.*;
import org.objectweb.asm.*;import org.objectweb.asm.commons.*;
/** Original flat model colors, and original ClientLevel box averaging with explicit biome/color hosts. */
public final class MinecraftFlatLightingCheck {
 public static final class MinecraftHost {public final OptionsHost options=new OptionsHost();static final MinecraftHost INSTANCE=new MinecraftHost();public static MinecraftHost getInstance(){return INSTANCE;}}
 public static final class OptionsHost {public OptionHost biomeBlendRadius(){return new OptionHost();}}
 public static final class OptionHost {public Object get(){return radius;}}
 static int radius;static Biome biome;static final List<BlockPos> positions=new ArrayList<>();
 public static Holder<Biome> getBiome(Object ignored,BlockPos pos){positions.add(pos.immutable());return Holder.direct(biome);}
 static final class Host extends ClassLoader {
  final JarFile jar;Host(Path file)throws Exception{super(MinecraftFlatLightingCheck.class.getClassLoader());jar=new JarFile(file.toFile());}
  @Override protected Class<?> findClass(String name)throws ClassNotFoundException{if(!name.equals("BlendProbe"))throw new ClassNotFoundException(name);
   try(var stream=jar.getInputStream(jar.getJarEntry("net/minecraft/client/multiplayer/ClientLevel.class"))){var writer=new ClassWriter(0);var remapper=new Remapper(){@Override public String map(String name){return switch(name){case "net/minecraft/client/Minecraft"->"MinecraftFlatLightingCheck$MinecraftHost";case "net/minecraft/client/Options"->"MinecraftFlatLightingCheck$OptionsHost";case "net/minecraft/client/OptionInstance"->"MinecraftFlatLightingCheck$OptionHost";case "net/minecraft/client/multiplayer/ClientLevel"->"BlendProbe";default->name;};}};
    var visitor=new ClassVisitor(Opcodes.ASM9,new ClassRemapper(writer,remapper)){
     @Override public void visit(int version,int access,String n,String signature,String parent,String[] interfaces){super.visit(version,Opcodes.ACC_PUBLIC,n,null,"java/lang/Object",null);}
     @Override public void visitNestHost(String host){}@Override public void visitNestMember(String member){}@Override public void visitInnerClass(String a,String b,String c,int d){}
     @Override public FieldVisitor visitField(int a,String n,String d,String s,Object v){return null;}
     @Override public MethodVisitor visitMethod(int access,String method,String descriptor,String signature,String[] exceptions){if(!method.equals("calculateBlockTint"))return null;return new MethodVisitor(Opcodes.ASM9,super.visitMethod(Opcodes.ACC_PUBLIC,method,descriptor,null,exceptions)){
      @Override public void visitMethodInsn(int opcode,String owner,String name,String desc,boolean itf){if(name.equals("getBiome")&&desc.equals("(Lnet/minecraft/core/BlockPos;)Lnet/minecraft/core/Holder;"))super.visitMethodInsn(Opcodes.INVOKESTATIC,"MinecraftFlatLightingCheck","getBiome","(Ljava/lang/Object;Lnet/minecraft/core/BlockPos;)Lnet/minecraft/core/Holder;",false);else super.visitMethodInsn(opcode,owner,name,desc,itf);}
     };}
    };new ClassReader(stream).accept(visitor,0);var bytes=writer.toByteArray();return defineClass(name,bytes,0,bytes.length);
   }catch(Exception e){throw new ClassNotFoundException(name,e);}
  }
 }
 static Object allocate(Class<?> type)throws Exception{var f=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return((sun.misc.Unsafe)f.get(null)).allocateInstance(type);}
 public static void main(String[] args)throws Exception{
  net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();var result=new JsonObject();var colors=new JsonArray();var lighter=new BlockModelLighter();
  for(String profile:List.of("default","nether"))for(Direction face:Direction.values())for(int tint:new int[]{-1,0x7fa96d33}){
   var lighting=profile.equals("nether")?CardinalLighting.NETHER:CardinalLighting.DEFAULT;
   var level=(BlockAndTintGetter)Proxy.newProxyInstance(MinecraftFlatLightingCheck.class.getClassLoader(),new Class<?>[]{BlockAndTintGetter.class},(proxy,method,values)->{if(method.getName().equals("cardinalLighting"))return lighting;throw new UnsupportedOperationException(method.toString());});
   for(Direction override:new Direction[]{null,Direction.UP}){if(override!=null&&face!=Direction.DOWN)continue;var material=new BakedQuad.MaterialInfo(null,null,null,null,null,0,override,0);var quad=new BakedQuad(null,null,null,null,0,0,0,0,face,material);var output=new QuadInstance();lighter.prepareQuadFlat(level,null,BlockPos.ZERO,0,quad,output);output.multiplyColor(tint);var row=new JsonObject();row.addProperty("profile",profile);row.addProperty("face",face.getName());if(override!=null)row.addProperty("override",override.getName());row.addProperty("tint",Integer.toUnsignedLong(tint));row.addProperty("color",Integer.toUnsignedLong(output.getColor(0)));colors.add(row);}
  }result.add("models",colors);
  var facing=Class.forName("net.minecraft.client.resources.model.cuboid.FaceBakery").getDeclaredMethod("findClosestDirection",org.joml.Vector3f.class);facing.setAccessible(true);var normals=new JsonArray();for(float[] n:new float[][]{{1,1,0},{0,-1,-1},{-1,0,1},{.2F,.7F,-.8F}}){var row=new JsonObject();row.add("normal",new Gson().toJsonTree(n));row.addProperty("direction",((Direction)facing.invoke(null,new org.joml.Vector3f(n))).getName());normals.add(row);}result.add("normals",normals);
  var host=new Host(Path.of(args[0]));var type=host.loadClass("BlendProbe");var probe=allocate(type);biome=(Biome)allocate(Biome.class);var method=type.getMethod("calculateBlockTint",BlockPos.class,ColorResolver.class);var blends=new JsonArray();ColorResolver resolver=(ignored,x,z)->0x7f000000|((int)x&255)<<16|((int)z&255)<<8|((int)(x*13+z*7)&255);
  for(int r:new int[]{0,1,2}){radius=r;positions.clear();int color=(Integer)method.invoke(probe,new BlockPos(-3,64,5),resolver);var row=new JsonObject();row.addProperty("radius",r);row.addProperty("color",Integer.toUnsignedLong(color));row.add("positions",new Gson().toJsonTree(positions.stream().map(p->new int[]{p.getX(),p.getY(),p.getZ()}).toList()));blends.add(row);}result.add("blends",blends);host.jar.close();Files.writeString(Path.of(args[1]),new Gson().toJson(result)+"\n");
 }
}
