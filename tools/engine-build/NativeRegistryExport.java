// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeRegistryAccess;
import art.arcane.volmlib.nativelib.terrain.NativeBlockProperty;
import com.google.gson.*;
import net.minecraft.server.RegistryLayer;
import net.minecraft.server.ReloadableServerRegistries;
import java.nio.file.*;
import java.util.*;

/** Native vanilla world registries and native schema descriptors, without starting a server. */
public final class NativeRegistryExport {
    public static void main(String[] args)throws Exception{
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            net.minecraft.core.HolderLookup.Provider reloadable;
            try(var executor=java.util.concurrent.Executors.newFixedThreadPool(4)){
                var layers=RegistryLayer.createRegistryAccess().replaceFrom(RegistryLayer.STATIC,loaded.registries());
                reloadable=ReloadableServerRegistries.reload(layers,List.of(),loaded.resources(),executor).join().lookupWithUpdatedTags();
            }
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->reloadable,message->{throw new IllegalStateException("Native registry unavailable: "+message);}));
            Gson gson=new Gson();JsonObject result=new JsonObject();result.addProperty("formatVersion",1);result.addProperty("scope","pinned-native-platform-registries");result.addProperty("minecraft","26.3");
            JsonObject keys=new JsonObject();keys.add("blocks",gson.toJsonTree(access.blockKeys()));keys.add("biomes",gson.toJsonTree(access.biomeKeys()));keys.add("structures",gson.toJsonTree(access.structureKeys()));keys.add("items",gson.toJsonTree(access.itemKeys()));keys.add("entities",gson.toJsonTree(access.entityKeys()));keys.add("enchantments",gson.toJsonTree(access.enchantmentKeys()));keys.add("potionEffects",gson.toJsonTree(access.potionEffectKeys()));keys.add("lootTables",gson.toJsonTree(access.lootTableKeys()));result.add("keys",keys);
            // Preserve list identity grouping used by the native SchemaBuilder.
            IdentityHashMap<List<NativeBlockProperty>,Integer> identities=new IdentityHashMap<>();JsonArray groups=new JsonArray();JsonObject blocks=new JsonObject();
            for(var entry:access.blockStateProperties().entrySet()){
                List<NativeBlockProperty> group=entry.getValue();Integer id=identities.get(group);if(id==null){id=identities.size();identities.put(group,id);groups.add(gson.toJsonTree(group));}blocks.addProperty(entry.getKey(),id);
            }
            result.add("propertyGroups",groups);result.add("blockPropertyGroups",blocks);result.addProperty("lootTablesExported",true);
            JsonObject categories=new JsonObject();for(String key:access.entityKeys())categories.addProperty(key,access.entity(key).spawnCategory());result.add("entityCategories",categories);
            JsonArray leaves=new JsonArray();for(var block:net.minecraft.core.registries.BuiltInRegistries.BLOCK)if(block instanceof net.minecraft.world.level.block.LeavesBlock)leaves.add(net.minecraft.core.registries.BuiltInRegistries.BLOCK.getKey(block).toString());result.add("leafBlockTypes",leaves);
            Path output=Path.of(args[0]);Files.createDirectories(output.getParent());Files.writeString(output,gson.toJson(result)+"\n");System.out.println("Exported native world registry keys and "+groups.size()+" shared block-property descriptor groups.");
        }
    }
}
