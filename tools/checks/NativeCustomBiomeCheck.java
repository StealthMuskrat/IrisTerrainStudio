// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.iris.generation.runtime.Engine;
import art.arcane.iris.world.history.GenerationRegistryContractFactory;
import art.arcane.iris.pack.datapack.v263.DataFixerV263;
import com.google.gson.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.biome.*;
import com.mojang.serialization.JsonOps;

/** Original identity/definition methods and original Minecraft effects codec/color operations. */
public final class NativeCustomBiomeCheck {
    private static int[] map(int salt){int[] colors=new int[65536];for(int i=0;i<colors.length;i++)colors[i]=0xff000000|((i&255)<<16)|((i>>8)<<8)|((i*salt)&255);return colors;}
    public static JsonArray inspect(Engine engine){
        GrassColor.init(map(17));FoliageColor.init(map(29));DryFoliageColor.init(map(41));
        JsonArray result=new JsonArray();for(var biome:engine.getDimension().getReachableBiomes(engine::getData)){
            if(!biome.isCustom())continue;for(var custom:biome.getCustomDerivitives()){
                String key=GenerationRegistryContractFactory.customBiomeResourceKey(engine.getDimension().getLoadKey(),custom,engine.getData().getContentGate());
                String text=custom.generateJson(new DataFixerV263(),engine.getData().getContentGate());JsonObject json=JsonParser.parseString(text).getAsJsonObject();
                var nativeBiome=new Biome.BiomeBuilder().temperature(json.get("temperature").getAsFloat()).downfall(json.get("downfall").getAsFloat()).specialEffects(BiomeSpecialEffects.CODEC.parse(JsonOps.INSTANCE,json.get("effects")).getOrThrow()).generationSettings(BiomeGenerationSettings.EMPTY).build();
                var row=new JsonObject();row.addProperty("key",key);row.addProperty("id",custom.getId());row.addProperty("definitionJson",text);var colors=new JsonObject();colors.addProperty("grass",Integer.toUnsignedLong(nativeBiome.getGrassColor(0,0)));colors.addProperty("foliage",Integer.toUnsignedLong(nativeBiome.getFoliageColor()));colors.addProperty("dry_foliage",Integer.toUnsignedLong(nativeBiome.getDryFoliageColor()));colors.addProperty("water",Integer.toUnsignedLong(nativeBiome.getWaterColor()));row.add("colors",colors);result.add(row);
            }
        }return result;
    }
}
