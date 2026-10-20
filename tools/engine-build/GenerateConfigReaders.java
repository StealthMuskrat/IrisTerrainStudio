// SPDX-License-Identifier: GPL-3.0-or-later
package studio.build;

import art.arcane.iris.pack.schema.annotation.Snippet;
import com.google.gson.annotations.SerializedName;
import com.google.gson.*;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.FieldVisitor;
import org.objectweb.asm.Opcodes;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;

/** Generate direct field readers from the pinned compiled classes, preserving constructor defaults. */
public final class GenerateConfigReaders {
    private static final String BASE="art.arcane.iris.generation.noise.";
    private static final Map<String,Class<?>> TYPES=new TreeMap<>();
    private static final Map<String,ParameterizedType> CONTAINERS=new LinkedHashMap<>();
    private static final Set<Class<?>> ENUMS=new LinkedHashSet<>();
    private static final StringBuilder source=new StringBuilder();
    private static String quote(String text){return new com.google.gson.Gson().toJson(text);}
    private static String javaName(Class<?> cls){return cls.getCanonicalName();}
    private static String scalar(Class<?> cls){
        if(cls==String.class)return"string(reader)";
        if(cls==boolean.class||cls==Boolean.class)return"bool(reader)";
        if(cls==long.class||cls==Long.class)return"reader.nextLong()";
        if(cls==int.class||cls==Integer.class)return"reader.nextInt()";
        if(cls==double.class||cls==Double.class)return"reader.nextDouble()";
        if(cls==float.class||cls==Float.class)return"(float)reader.nextDouble()";
        if(cls.isEnum()){ENUMS.add(cls);return"enum"+cls.getName().replace('.','_').replace('$','_')+"(reader)";}
        if(cls==Object.class)return "any(reader)";
        if(cls.getName().equals("art.arcane.volmlib.util.mantle.flag.MantleFlag"))return "new art.arcane.volmlib.util.mantle.flag.MantleFlagAdapter().read(reader)";
        if(TYPES.containsKey(cls.getName()))return"read"+cls.getSimpleName()+"(reader)";
        throw new IllegalStateException("No native reader for "+cls.getName());
    }
    private static String expression(Type type){
        if(type instanceof Class<?> cls)return scalar(cls);
        if(type instanceof ParameterizedType parameterized){String name=type.getTypeName();if(!CONTAINERS.containsKey(name))CONTAINERS.put(name,parameterized);return "container"+new ArrayList<>(CONTAINERS.keySet()).indexOf(name)+"(reader)";}
        throw new IllegalStateException("Unresolved native configuration type: "+type);
    }
    private static List<Field> fields(Class<?> cls){
        List<Class<?>> hierarchy=new ArrayList<>();for(Class<?> current=cls;current!=null&&current!=Object.class;current=current.getSuperclass())hierarchy.addFirst(current);
        Map<String,Field> fields=new LinkedHashMap<>();for(Class<?> current:hierarchy)for(Field field:current.getDeclaredFields())if(serializable(field)){if(fields.put(field.getName(),field)!=null)throw new IllegalStateException("Duplicate native JSON field: "+field);}
        return new ArrayList<>(fields.values());
    }
    private static void overrideClass(Class<?> cls,JarOutputStream jar,Set<String> emitted)throws Exception{
        if(!emitted.add(cls.getName()))return;
        String classFile=cls.getName().replace('.','/')+".class";byte[] original;
        try(var input=cls.getClassLoader().getResourceAsStream(classFile)){original=Objects.requireNonNull(input).readAllBytes();}
        ClassReader reader=new ClassReader(original);ClassWriter writer=new ClassWriter(reader,0);
        reader.accept(new ClassVisitor(Opcodes.ASM9,writer){@Override public FieldVisitor visitField(int access,String fieldName,String descriptor,String signature,Object value){if((access&(Opcodes.ACC_STATIC|Opcodes.ACC_FINAL|Opcodes.ACC_TRANSIENT))==0)access=(access&~(Opcodes.ACC_PRIVATE|Opcodes.ACC_PROTECTED))|Opcodes.ACC_PUBLIC;return super.visitField(access,fieldName,descriptor,signature,value);}},0);
        jar.putNextEntry(new JarEntry(classFile));jar.write(writer.toByteArray());jar.closeEntry();
    }
    private static boolean serializable(Field field){int modifiers=field.getModifiers();return !Modifier.isStatic(modifiers)&&!Modifier.isFinal(modifiers)&&!Modifier.isTransient(modifiers)&&!field.isSynthetic();}
    public static void main(String[] args)throws Exception{
        Path directory=Path.of(args[0]),overrides=Path.of(args[1]);Files.createDirectories(directory);Files.createDirectories(overrides.getParent());
        source.append("// Generated from pinned native fields; do not hand-edit.\npackage studio.engine.config;\nimport com.google.gson.stream.*;import java.io.*;import art.arcane.volmlib.util.collection.KList;\npublic final class NativeConfigReader extends ConfigReaderSupport {\n");
        JsonObject inventory=JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonObject();
        for(String name:inventory.getAsJsonObject("definitions").keySet())TYPES.put(name,Class.forName(name));
        Set<String> emitted=new HashSet<>();
        try(JarOutputStream jar=new JarOutputStream(Files.newOutputStream(overrides))){
            for(Class<?> cls:TYPES.values()){
                String name=cls.getSimpleName(),type=javaName(cls);
                if(!java.lang.reflect.Modifier.isPublic(cls.getModifiers())||java.lang.reflect.Modifier.isAbstract(cls.getModifiers()))throw new IllegalStateException("Native data class is not directly constructible: "+cls);
                cls.getConstructor();Snippet snippet=cls.getAnnotation(Snippet.class);
                source.append("public static ").append(type).append(" read").append(name).append("(String text)throws IOException{return document(text,NativeConfigReader::read").append(name).append(");}\n");
                source.append("public static ").append(type).append(" read").append(name).append("(JsonReader reader)throws IOException{\n");
                source.append("if(reader.peek()==JsonToken.NULL){reader.nextNull();return null;}\n");
                if(snippet!=null)source.append("if(reader.peek()==JsonToken.STRING){return snippet(reader.nextString(),").append(quote(snippet.value())).append(",NativeConfigReader::object").append(name).append(");}\n");
                source.append("return object").append(name).append("(reader);}\n");
                source.append("private static ").append(type).append(" object").append(name).append("(JsonReader reader)throws IOException{\nenter();try{var result=new ").append(type).append("();reader.beginObject();while(reader.hasNext()){switch(reader.nextName()){\n");
                for(Field field:fields(cls)){
                    source.append("case ").append(quote(field.getName())).append(":{");
                    if(field.getType().isPrimitive())source.append("if(reader.peek()==JsonToken.NULL){reader.nextNull();}else{");
                    else source.append("if(reader.peek()==JsonToken.NULL){reader.nextNull();result.").append(field.getName()).append("=null;}else{");
                    source.append("result.").append(field.getName()).append('=').append(expression(field.getGenericType())).append(';');
                    source.append("}break;}\n");
                }
                source.append("default:reader.skipValue();}}reader.endObject();return result;}finally{leave();}}\n");
                // Only field access changes. Constructors, methods, caches and all
                // numerical algorithms retain the original compiled bytecode.
                overrideClass(cls,jar,emitted);for(Field field:fields(cls))overrideClass(field.getDeclaringClass(),jar,emitted);
            }
        }
        for(int index=0;index<CONTAINERS.size();index++){
            ParameterizedType container=new ArrayList<>(CONTAINERS.values()).get(index);Class<?> raw=(Class<?>)container.getRawType();Type[] parameters=container.getActualTypeArguments();String type=container.getTypeName().replace('$','.');
            source.append("private static ").append(type).append(" container").append(index).append("(JsonReader reader)throws IOException{if(reader.peek()==JsonToken.NULL){reader.nextNull();return null;}enter();try{");
            if(Collection.class.isAssignableFrom(raw))source.append("var value=new KList<").append(parameters[0].getTypeName().replace('$','.')).append(">();reader.beginArray();while(reader.hasNext())value.add(").append(expression(parameters[0])).append(");reader.endArray();return value;");
            else if(Map.class.isAssignableFrom(raw)){
                if(parameters[0]!=String.class)throw new IllegalStateException("Native map key requires its own adapter: "+container);
                source.append("var value=new art.arcane.volmlib.util.collection.KMap<String,").append(parameters[1].getTypeName().replace('$','.')).append(">();reader.beginObject();while(reader.hasNext()){String key=reader.nextName();value.put(key,").append(expression(parameters[1])).append(");}reader.endObject();return value;");
            }else throw new IllegalStateException("Unsupported native container: "+container);
            source.append("}finally{leave();}}\n");
        }
        for(Class<?> cls:ENUMS){
            source.append("private static ").append(javaName(cls)).append(" enum").append(cls.getName().replace('.','_').replace('$','_')).append("(JsonReader reader)throws IOException{if(reader.peek()==JsonToken.NULL){reader.nextNull();return null;}String value=reader.nextString();return switch(value){\n");
            Map<String,String> names=new LinkedHashMap<>();for(Object value:cls.getEnumConstants()){Enum<?> constant=(Enum<?>)value;Field field=cls.getField(constant.name());SerializedName serialized=field.getAnnotation(SerializedName.class);if(serialized==null)names.put(constant.name(),constant.name());else{names.put(serialized.value(),constant.name());for(String alias:serialized.alternate())names.put(alias,constant.name());}}
            for(var entry:names.entrySet())source.append("case ").append(quote(entry.getKey())).append("->").append(javaName(cls)).append('.').append(entry.getValue()).append(';');
            source.append("default->null;};}\n");
        }
        source.append("}\n");Path target=directory.resolve("studio/engine/config/NativeConfigReader.java");Files.createDirectories(target.getParent());Files.writeString(target,source,StandardCharsets.UTF_8);
        System.out.println("Generated field readers for "+TYPES.size()+" native types; numerical bytecode is unchanged.");
    }
}
