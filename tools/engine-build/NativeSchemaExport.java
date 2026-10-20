// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.iris.pack.loading.*;
import art.arcane.iris.pack.schema.SchemaBuilder;
import art.arcane.iris.spi.*;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeRegistryAccess;
import com.google.gson.*;
import net.minecraft.core.registries.Registries;
import net.minecraft.SharedConstants;
import net.minecraft.server.RegistryLayer;
import net.minecraft.server.ReloadableServerRegistries;
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Execute the unchanged native SchemaBuilder against a specific authoring pack and vanilla registries. */
public final class NativeSchemaExport {
    private static final List<String> warnings=new ArrayList<>(),errors=new ArrayList<>();
    @SuppressWarnings("unchecked") private static <T>T proxy(Class<T> type,InvocationHandler handler){return(T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},handler);}
    private static String hash(byte[] bytes)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    private static Object objectMethod(Object proxy,Method method,Object[] args){return switch(method.getName()){case"toString"->"NativeSchemaExport<"+method.getDeclaringClass().getName()+">";case"hashCode"->System.identityHashCode(proxy);case"equals"->proxy==args[0];default->throw new UnsupportedOperationException(method.toString());};}
    public static void main(String[] args)throws Exception{
        Path pack=Path.of(args[0]).toAbsolutePath(),output=Path.of(args[1]).toAbsolutePath(),inventory=Path.of(args[2]);Files.createDirectories(output);Files.deleteIfExists(output.resolve("manifest.json"));
        if(!Files.isDirectory(pack))throw new IllegalArgumentException("The native schema pack folder is missing");
        Map<String,String> packFiles=new TreeMap<>();try(var stream=Files.walk(pack)){for(Path path:stream.toList()){if(Files.isSymbolicLink(path))throw new IllegalArgumentException("Schema pack contains a symbolic link");if(Files.isRegularFile(path))packFiles.put(pack.relativize(path).toString().replace('\\','/'),hash(Files.readAllBytes(path)));}}
        try(HeadlessNativeRegistries loaded=HeadlessNativeRegistries.load(Map.of())){
            net.minecraft.core.HolderLookup.Provider reloadable;
            // Load the actual native reloadable codecs as well as world
            // registries. No server, world or command endpoint is created.
            try(var executor=java.util.concurrent.Executors.newFixedThreadPool(4)){
                var layers=RegistryLayer.createRegistryAccess().replaceFrom(RegistryLayer.STATIC,loaded.registries());
                reloadable=ReloadableServerRegistries.reload(layers,List.of(),loaded.resources(),executor).join().lookupWithUpdatedTags();
            }
            NativeRegistryAccess access=new NativeRegistryAccess(new NativeRegistryAccess.Configuration(loaded::registries,()->reloadable,message->{throw new IllegalStateException("Missing schema registry: "+message);}));
            PlatformRegistries registries=proxy(PlatformRegistries.class,(self,method,values)->{
                if(method.getDeclaringClass()==Object.class)return objectMethod(self,method,values);
                if(method.getName().equals("specialEntityKeys"))return List.of(); // Vanilla export has no content plugins.
                String name=method.getName().equals("blockTypeKeys")?"blockKeys":method.getName();
                try{return NativeRegistryAccess.class.getMethod(name,method.getParameterTypes()).invoke(access,values);}catch(NoSuchMethodException failure){throw new UnsupportedOperationException("Schema export requested an unlinked registry operation: "+name,failure);}
            });
            PlatformStructureHooks structures=proxy(PlatformStructureHooks.class,(self,method,values)->{
                if(method.getDeclaringClass()==Object.class)return objectMethod(self,method,values);
                return switch(method.getName()){
                    case"structureKeys"->access.structureKeys();
                    case"structureSetKeys"->loaded.registries().lookupOrThrow(Registries.STRUCTURE_SET).listElementIds().map(key->key.identifier().toString()).toList();
                    case"templatePoolKeys"->loaded.registries().lookupOrThrow(Registries.TEMPLATE_POOL).listElementIds().map(key->key.identifier().toString()).toList();
                    default->throw new UnsupportedOperationException("Schema export requested structure operation "+method.getName());
                };
            });
            IrisPlatform platform=proxy(IrisPlatform.class,(self,method,values)->{
                if(method.getDeclaringClass()==Object.class)return objectMethod(self,method,values);
                return switch(method.getName()){
                    case"platformName"->"studio-native-schema-export";
                    case"minecraftVersion"->SharedConstants.getCurrentVersion().name();
                    case"registries"->registries;
                    case"pluginJar"->Path.of(args[3]).toFile();
                    case"structureHooks"->structures;
                    case"dataFolder"->{if(values!=null&&values.length>0)yield InvocationHandler.invokeDefault(self,method,values);yield Path.of(System.getProperty("java.io.tmpdir"),"iris-studio-schema-platform").toFile();}
                    case"dataFile"->{File file=new File(((IrisPlatform)self).dataFolder(),String.join(File.separator,(String[])values[0]));Files.createDirectories(file.toPath().getParent());yield file;}
                    case"log"->{if(values[0]==LogLevel.WARN)warnings.add(String.valueOf(values[1]));else if(values[0]==LogLevel.ERROR)errors.add(String.valueOf(values[1]));yield null;}
                    case"reportError"->{errors.add(Arrays.toString(values));yield null;}
                    case"msg"->{warnings.add(Arrays.toString(values));yield null;}
                    default->{if(method.isDefault())yield InvocationHandler.invokeDefault(self,method,values);throw new UnsupportedOperationException("Native schema export requested platform operation "+method.getName());}
                };
            });
            IrisPlatforms.bind(platform);
            try{
                IrisData data=IrisData.openDatapackCompiler(pack.toFile());
                // Reuse native loader construction, including binary-specialized
                // loaders, without runtime preservation services or a game server.
                Method register=IrisData.class.getDeclaredMethod("registerLoader",Class.class,art.arcane.volmlib.util.collection.KMap.class);register.setAccessible(true);
                for(Field field:IrisData.class.getDeclaredFields())if(field.getType()==ResourceLoader.class){Class<?> type=(Class<?>)((ParameterizedType)field.getGenericType()).getActualTypeArguments()[0];Object loader=register.invoke(data,type,data.getLoaders());if(loader==null)throw new IllegalStateException("Cannot construct native schema loader "+field.getName()+": "+String.join("; ",errors));field.setAccessible(true);field.set(data,loader);}
                JsonObject metadata=JsonParser.parseString(Files.readString(inventory)).getAsJsonObject(),roots=metadata.getAsJsonObject("roots"),schemas=new JsonObject();Gson gson=new Gson();
                Map<String,Class<?>> targets=new TreeMap<>();for(var entry:roots.entrySet())if(List.of("dimensions","regions","biomes","generators","blocks","expressions","imagemaps").contains(entry.getKey()))targets.put(entry.getKey(),Class.forName(entry.getValue().getAsString()));
                for(var entry:metadata.getAsJsonObject("definitions").entrySet()){JsonObject definition=entry.getValue().getAsJsonObject();if(definition.has("snippet"))targets.put("snippet/"+definition.get("snippet").getAsString(),Class.forName(entry.getKey()));}
                for(var entry:targets.entrySet()){
                    String filename=entry.getKey()+".schema.json",text=new SchemaBuilder(entry.getValue(),data).construct().toString(2)+"\n";Path target=output.resolve(filename);Files.createDirectories(target.getParent());Files.writeString(target,text);JsonObject record=new JsonObject();record.addProperty("javaType",entry.getValue().getName());record.addProperty("sha256",hash(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));record.addProperty("bytes",Files.size(target));schemas.add(filename,record);
                }
                if(!errors.isEmpty())throw new IllegalStateException("Native SchemaBuilder reported errors: "+String.join("; ",errors));
                Files.writeString(output.resolve("warnings.json"),gson.toJson(warnings)+"\n");JsonObject manifest=new JsonObject();manifest.addProperty("formatVersion",1);manifest.addProperty("scope","native-pack-schema-development-export");manifest.addProperty("irisCommit","c3a9449a026078c44a87c9776766f54a67779392");manifest.addProperty("minecraft",SharedConstants.getCurrentVersion().name());manifest.addProperty("registryScope","vanilla-world-registries");manifest.addProperty("packSpecific",true);manifest.addProperty("releaseMatchVerified",false);manifest.addProperty("schemaParityVerified",false);manifest.add("packFiles",gson.toJsonTree(packFiles));manifest.add("files",schemas);manifest.addProperty("warningCount",warnings.size());manifest.addProperty("limitations","Vanilla registry scope only; mod/plugin/custom biome registry contributions and host fonts are not production-qualified. Import only for the matching pack snapshot.");Files.writeString(output.resolve("manifest.json"),new GsonBuilder().setPrettyPrinting().create().toJson(manifest)+"\n");
            }finally{IrisPlatforms.unbind();}
        }
    }
}
