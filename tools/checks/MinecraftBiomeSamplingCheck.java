// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;import java.nio.file.*;import net.minecraft.world.level.biome.BiomeManager;
/** Original seed hash and eight-corner selector. The native resolver records only the selected coordinate. */
public final class MinecraftBiomeSamplingCheck {
 public static void main(String[] args)throws Exception{
  var input=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray();var rows=new JsonArray();
  for(var value:input){var request=value.getAsJsonObject();long seed=Long.parseLong(request.get("seed").getAsString()),hash=BiomeManager.obfuscateSeed(seed);var samples=new JsonArray();
   for(var p:request.getAsJsonArray("positions")){var at=p.getAsJsonArray();var result=new JsonArray();var manager=new BiomeManager((x,y,z)->{result.add(x);result.add(y);result.add(z);return null;},hash);manager.getBiome(at.get(0).getAsInt(),at.get(1).getAsInt(),at.get(2).getAsInt());samples.add(result);}
   var row=new JsonObject();row.addProperty("seed",Long.toString(seed));row.addProperty("seedHash",Long.toString(hash));row.add("quarts",samples);rows.add(row);
  }Files.writeString(Path.of(args[1]),new Gson().toJson(rows)+"\n");
 }
}
