// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.config;
import com.google.gson.stream.*;
import java.io.*;
import java.util.*;

/** Browser-local pack resource access used by generated native-field readers. */
public class ConfigReaderSupport {
    @FunctionalInterface protected interface Decoder<T>{T read(JsonReader reader)throws IOException;}
    private static final Map<String,String> resources=new LinkedHashMap<>();
    private static final Set<String> loading=new HashSet<>();
    private static int depth,nodes,bytes;
    private static java.util.function.Function<String,String> provider;
    protected static void enter(){if(++depth>100||++nodes>4096)throw new IllegalArgumentException("Configuration exceeds the native reader budget");}
    protected static void leave(){depth--;}
    public static void clear(){resources.clear();loading.clear();depth=nodes=bytes=0;provider=null;}
    public static void bindResourceProvider(java.util.function.Function<String,String> source){provider=source;}
    public static void register(String path,String text){
        if(path==null||!path.startsWith("snippet/")||!path.endsWith(".json")||path.length()>1024||path.contains("\\")||path.contains(":")||Arrays.stream(path.split("/",-1)).anyMatch(part->part.isEmpty()||part.equals(".")||part.equals("..")))throw new IllegalArgumentException("Invalid snippet resource path");
        String prior=resources.get(path);int total=bytes+(text.length()-(prior==null?0:prior.length()))*2;
        if(resources.size()>=512&&!resources.containsKey(path)||text.length()>4*1024*1024||total>32*1024*1024)throw new IllegalArgumentException("Snippet resources exceed the reader memory budget");
        resources.put(path,text);bytes=total;
    }
    protected static <T>T snippet(String reference,String type,Decoder<T> decoder)throws IOException{
        if(!reference.startsWith("snippet/"))return null;
        String prefix="snippet/"+type+"/",path=(reference.startsWith(prefix)?reference:prefix+reference.substring(8))+".json";
        if(Arrays.stream(path.split("/",-1)).anyMatch(part->part.isEmpty()||part.equals(".")||part.equals("..")))throw new IllegalArgumentException("Snippet reference escapes its pack resource boundary");
        String text=resources.get(path);if(text==null&&provider!=null){text=provider.apply(path);if(text!=null)register(path,text);}if(text==null)throw new IllegalArgumentException("Missing snippet resource: "+path);
        if(!loading.add(path))throw new IllegalArgumentException("Snippet reference cycle: "+path);
        try(JsonReader reader=new JsonReader(new StringReader(text))){T value=decoder.read(reader);if(reader.peek()!=JsonToken.END_DOCUMENT)throw new IllegalArgumentException("Trailing snippet content: "+path);return value;}finally{loading.remove(path);}
    }
    protected static Object any(JsonReader reader)throws IOException{
        return switch(reader.peek()){
            case NULL->{reader.nextNull();yield null;}
            case STRING->reader.nextString();case BOOLEAN->reader.nextBoolean();case NUMBER->reader.nextDouble();
            case BEGIN_ARRAY->{enter();try{var list=new ArrayList<Object>();reader.beginArray();while(reader.hasNext())list.add(any(reader));reader.endArray();yield list;}finally{leave();}}
            case BEGIN_OBJECT->{enter();try{var map=new LinkedHashMap<String,Object>();reader.beginObject();while(reader.hasNext()){String name=reader.nextName();map.put(name,any(reader));}reader.endObject();yield map;}finally{leave();}}
            default->throw new IllegalArgumentException("Expected a native JSON value");
        };
    }
    protected static String string(JsonReader reader)throws IOException{if(reader.peek()==JsonToken.NULL){reader.nextNull();return null;}return reader.peek()==JsonToken.BOOLEAN?Boolean.toString(reader.nextBoolean()):reader.nextString();}
    protected static boolean bool(JsonReader reader)throws IOException{return reader.peek()==JsonToken.STRING?Boolean.parseBoolean(reader.nextString()):reader.nextBoolean();}
    protected static <T>T document(String text,Decoder<T> decoder)throws IOException{
        if(text.length()>4*1024*1024)throw new IllegalArgumentException("Resource exceeds the native reader text budget");
        depth=nodes=0;try(JsonReader reader=new JsonReader(new StringReader(text))){T value=decoder.read(reader);if(reader.peek()!=JsonToken.END_DOCUMENT)throw new IllegalArgumentException("Trailing resource content");return value;}
    }
}
