// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.*;
import java.nio.file.*;
import java.util.*;
public final class MinecraftCullingCapture {
 public static void main(String[] args)throws Exception{
  net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();var owners=new TreeMap<String,List<String>>();int count=0;
  for(var block:BuiltInRegistries.BLOCK){count++;Class<?> owner=block.getClass();while(owner!=null){try{owner.getDeclaredMethod("skipRendering",BlockState.class,BlockState.class,Direction.class);break;}catch(NoSuchMethodException e){owner=owner.getSuperclass();}}if(owner==null)throw new IllegalStateException("No skipRendering owner");owners.computeIfAbsent(owner.getName(),key->new ArrayList<>()).add(BuiltInRegistries.BLOCK.getKey(block).toString());}
  var result=new JsonObject();result.addProperty("clientSha256",args[1]);result.addProperty("classifiedTypes",count);result.addProperty("statePairsEvaluated",0);result.add("owners",new Gson().toJsonTree(owners));Files.writeString(Path.of(args[0]),new Gson().toJson(result)+"\n");
 }
}
