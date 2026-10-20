// SPDX-License-Identifier: GPL-3.0-or-later
package studio.build;

import art.arcane.iris.pack.schema.annotation.*;
import art.arcane.volmlib.util.documentation.Description;
import com.google.gson.*;
import java.lang.annotation.Annotation;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/** Build-time field metadata, not a replacement for the native SchemaBuilder. */
public final class ConfigInventory {
    private static final Map<String,String> ROOTS = Map.ofEntries(
            Map.entry("dimensions","art.arcane.iris.generation.terrain.IrisDimension"),
            Map.entry("regions","art.arcane.iris.generation.terrain.IrisRegion"),
            Map.entry("biomes","art.arcane.iris.generation.biome.IrisBiome"),
            Map.entry("generators","art.arcane.iris.generation.noise.IrisGenerator"),
            Map.entry("style","art.arcane.iris.generation.noise.IrisGeneratorStyle"),
            Map.entry("generator","art.arcane.iris.generation.noise.IrisNoiseGenerator"),
            Map.entry("expressions","art.arcane.iris.generation.noise.IrisExpression"),
            Map.entry("imagemaps","art.arcane.iris.generation.image.IrisImageMap"));
    private static final ArrayDeque<Class<?>> queue = new ArrayDeque<>();
    private static final TreeMap<String,JsonObject> definitions = new TreeMap<>();
    private static JsonObject type(Type type) {
        JsonObject result = new JsonObject();
        if(type instanceof ParameterizedType parameterized) {
            Class<?> raw = (Class<?>)parameterized.getRawType();
            result.addProperty("javaType",raw.getName());
            if(Collection.class.isAssignableFrom(raw)) { result.addProperty("kind","array");result.add("items",type(parameterized.getActualTypeArguments()[0])); }
            else if(Map.class.isAssignableFrom(raw)) { result.addProperty("kind","map");result.add("values",type(parameterized.getActualTypeArguments()[1])); }
            else result.addProperty("kind","unsupported-generic");
            return result;
        }
        if(!(type instanceof Class<?> cls)) { result.addProperty("kind","unresolved-type");return result; }
        result.addProperty("javaType",cls.getName());
        if(cls==String.class||cls==char.class||cls==Character.class)result.addProperty("kind","string");
        else if(cls==boolean.class||cls==Boolean.class)result.addProperty("kind","boolean");
        else if(cls.isPrimitive()||Number.class.isAssignableFrom(cls))result.addProperty("kind",cls==float.class||cls==double.class||cls==Double.class||cls==Float.class?"number":"integer");
        else if(cls.isArray()){result.addProperty("kind","array");result.add("items",type(cls.componentType()));}
        else if(cls.isEnum()) { result.addProperty("kind","string");JsonArray values=new JsonArray();for(Object constant:cls.getEnumConstants())values.add(((Enum<?>)constant).name());result.add("enum",values); }
        else if(cls.getName().startsWith("art.arcane.iris.")) { result.addProperty("kind","object");result.addProperty("definition",cls.getName());if(!definitions.containsKey(cls.getName()))queue.add(cls); }
        else result.addProperty("kind","platform-or-library-type");
        return result;
    }
    private static void describe(Class<?> cls) {
        if(definitions.containsKey(cls.getName()))return;
        JsonObject description=new JsonObject();definitions.put(cls.getName(),description);
        description.addProperty("javaType",cls.getName());Snippet snippet=cls.getAnnotation(Snippet.class);if(snippet!=null)description.addProperty("snippet",snippet.value());Description text=cls.getAnnotation(Description.class);if(text!=null)description.addProperty("description",text.value());
        JsonObject fields=new JsonObject();description.add("properties",fields);
        List<Class<?>> hierarchy=new ArrayList<>();for(Class<?> current=cls;current!=null&&current!=Object.class;current=current.getSuperclass())hierarchy.addFirst(current);
        for(Class<?> current:hierarchy)for(Field field:current.getDeclaredFields()) {
            int modifiers=field.getModifiers();if(Modifier.isStatic(modifiers)||Modifier.isFinal(modifiers)||Modifier.isTransient(modifiers)||field.isSynthetic())continue;
            JsonObject metadata=type(field.getGenericType());metadata.addProperty("declaredBy",current.getName());
            text=field.getAnnotation(Description.class);if(text!=null)metadata.addProperty("description",text.value());
            if(field.isAnnotationPresent(Required.class))metadata.addProperty("required",true);
            MinNumber minimum=field.getAnnotation(MinNumber.class);if(minimum!=null)metadata.addProperty("minimum",minimum.value());
            MaxNumber maximum=field.getAnnotation(MaxNumber.class);if(maximum!=null)metadata.addProperty("maximum",maximum.value());
            ArrayType array=field.getAnnotation(ArrayType.class);if(array!=null){metadata.add("items",type(array.type()));metadata.addProperty("minItems",array.min());}
            JsonArray annotations=new JsonArray();for(Annotation annotation:field.getAnnotations())annotations.add(annotation.annotationType().getName());metadata.add("annotations",annotations);
            fields.add(field.getName(),metadata);
        }
    }
    public static void main(String[] args) throws Exception {
        ClassLoader loader=ConfigInventory.class.getClassLoader();JsonObject roots=new JsonObject();
        for(var entry:new TreeMap<>(ROOTS).entrySet()){Class<?> cls=Class.forName(entry.getValue(),false,loader);queue.add(cls);roots.addProperty(entry.getKey(),cls.getName());}
        while(!queue.isEmpty()){if(definitions.size()>2048)throw new IllegalStateException("Configuration type graph exceeds inventory budget");describe(queue.remove());}
        JsonObject result=new JsonObject();result.addProperty("formatVersion",1);result.addProperty("scope","pinned-native-field-inventory");result.addProperty("irisCommit","c3a9449a026078c44a87c9776766f54a67779392");result.addProperty("completeNativeSchema",false);result.add("roots",roots);JsonObject types=new JsonObject();definitions.forEach(types::add);result.add("definitions",types);
        Path output=Path.of(args[0]);Files.createDirectories(output.getParent());Files.writeString(output,new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create().toJson(result)+"\n");System.out.println("Exported native field metadata for "+definitions.size()+" types.");
    }
}
