// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.noise;

import studio.engine.pack.MemoryPack;
import java.io.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Snapshot-owned IO for native CNM float tiles, never pack/world files. */
public final class MemoryNoiseStore {
    public static final int MAX_SIZE=1024,MAX_FILES=64,MAX_PREFIXES=128;
    public static final long BYTE_LIMIT=8L*1024*1024,WORK_LIMIT=64L*1024*1024;
    private final java.util.function.BooleanSupplier current;
    private final String root;
    private final Map<String,byte[]> files=new LinkedHashMap<>();
    private final Map<String,Integer> lengths=new HashMap<>();
    private long bytes,work,reads,writes,moves,deletes,restored;
    private final ConcurrentHashMap<String,String> keys=new ConcurrentHashMap<>(){
        @Override public String put(String key,String value){live();if(!containsKey(key)&&size()>=MAX_PREFIXES)throw MemoryNoiseIO.failure("Noise cache exceeds its snapshot prefix budget");return super.put(key,value);}
    };
    public MemoryNoiseStore(MemoryPack owner,String root){this(owner::isOpen,root);}
    MemoryNoiseStore(java.util.function.BooleanSupplier current,String root){this.current=current;this.root=root;}
    void live(){if(!current.getAsBoolean())throw new IllegalStateException("Noise cache handle is outside its open snapshot",new Error("Expired browser noise-cache owner"));}
    public File root(){live();return new MemoryNoiseFile(this,"");}
    String rootPath(){return root;}
    ConcurrentHashMap<String,String> keys(){live();return keys;}
    void admit(int size,String key){
        live();if(size<=0)return;if(size>MAX_SIZE)throw MemoryNoiseIO.failure("Noise cache tile exceeds 1024 by 1024");
        if(key==null||key.isEmpty()||key.length()>512||key.contains("/")||key.contains("\\")||key.contains(":"))throw MemoryNoiseIO.failure("Invalid native noise cache key");
        long charge=4096L+16L*size*size;if(charge>WORK_LIMIT-work)throw MemoryNoiseIO.failure("Noise cache exceeds its snapshot allocation-work budget");
        if(!lengths.containsKey(key)&&lengths.size()>=MAX_PREFIXES)throw MemoryNoiseIO.failure("Noise cache exceeds its snapshot tile budget");
        work+=charge;lengths.put(key,8+4*size*size);
    }
    int expectedLength(String path)throws IOException{
        live();String name=path.substring(path.lastIndexOf('/')+1);int end=name.indexOf(".cnm");if(end<0)throw MemoryNoiseIO.ioFailure("Noise cache output lacks a native tile key");Integer length=lengths.get(name.substring(0,end));if(length==null)throw MemoryNoiseIO.ioFailure("Noise cache output has no allocation admission");return length;
    }
    boolean exists(String path){live();return path.isEmpty()||path.equals(".cache")||files.containsKey(path);}
    byte[] read(String path)throws IOException{live();byte[] value=files.get(path);if(value==null)throw new FileNotFoundException("Missing owned noise tile");Integer admitted=lengths.get(path.substring(7,path.length()-4));if(admitted==null||admitted!=value.length)throw new IOException("Owned noise tile dimensions differ from native allocation admission");reads++;return value;}
    void write(String path,byte[] value)throws IOException{
        live();if(!path.startsWith(".cache/")||!path.endsWith(".tmp"))throw MemoryNoiseIO.ioFailure("Noise cache writes require an owned temporary tile");
        byte[] previous=files.get(path);long total=bytes+value.length-(previous==null?0:previous.length);
        if(total>BYTE_LIMIT||(!files.containsKey(path)&&files.size()>=MAX_FILES))throw MemoryNoiseIO.ioFailure("Noise cache exceeds its snapshot stored-byte/file budget");files.put(path,value);bytes=total;writes++;
    }
    void move(String from,String to)throws IOException{
        live();if(!from.endsWith(".tmp")||!to.endsWith(".cnm")||!from.startsWith(to+"."))throw MemoryNoiseIO.ioFailure("Invalid owned noise tile rename");byte[] value=files.get(from);if(value==null)throw new FileNotFoundException("Missing temporary noise tile");
        byte[] previous=files.get(to);files.remove(from);files.put(to,value);if(previous!=null)bytes-=previous.length;moves++;
    }
    boolean delete(String path){live();byte[] previous=files.remove(path);if(previous==null)return false;bytes-=previous.length;deletes++;return true;}
    File[] list(MemoryNoiseFile directory,FilenameFilter filter){live();if(!directory.relative().equals(".cache"))return null;List<File> result=new ArrayList<>();for(String path:files.keySet()){String name=path.substring(7);if(filter==null||filter.accept(directory,name))result.add(new MemoryNoiseFile(this,path));}return result.toArray(File[]::new);}
    private String tilePath(String name)throws IOException{
        live();if(name==null||!name.matches("[A-Za-z0-9._-]{1,512}\\.cnm")||name.startsWith("."))throw new IOException("Invalid persisted native noise tile name");return ".cache/"+name;
    }
    /** Transport only: original FloatCache still decodes all admitted source floats on use. */
    public void restoreTile(String name,String payload)throws IOException{
        String path=tilePath(name);if(work!=0||!lengths.isEmpty()||!keys.isEmpty())throw new IOException("Noise tiles must restore before native style construction");
        if(payload==null||payload.length()<12||payload.length()>8+4*MAX_SIZE*MAX_SIZE)throw new IOException("Invalid persisted native noise tile length");
        if(files.containsKey(path)||files.size()>=MAX_FILES||bytes+payload.length()>BYTE_LIMIT)throw new IOException("Persisted noise tiles exceed their snapshot byte/file budget");
        byte[] value=new byte[payload.length()];for(int i=0;i<value.length;i++){char b=payload.charAt(i);if(b>255)throw new IOException("Invalid persisted native noise tile byte");value[i]=(byte)b;}
        var input=new DataInputStream(new ByteArrayInputStream(value));int width=input.readInt(),height=input.readInt();
        if(width<1||width>MAX_SIZE||height!=width||value.length!=8+4L*width*height)throw new IOException("Invalid persisted native noise tile dimensions");
        files.put(path,value);bytes+=value.length;restored++;
    }
    public String exportTile(String name)throws IOException{
        byte[] value=files.get(tilePath(name));if(value==null)throw new FileNotFoundException("Missing owned native noise tile");StringBuilder output=new StringBuilder(value.length);for(byte b:value)output.append((char)(b&255));return output.toString();
    }
    public void discardRestoredTiles()throws IOException{
        live();if(work!=0||!lengths.isEmpty()||!keys.isEmpty())throw new IOException("Cannot discard tiles after native style construction");files.clear();bytes=0;restored=0;
    }
    public String inspect()throws IOException{
        live();var output=new StringWriter();try(var writer=new com.google.gson.stream.JsonWriter(output)){writer.beginArray();for(var entry:files.entrySet()){if(!entry.getKey().endsWith(".cnm"))continue;var digest=studio.engine.image.WorkerImageDigest.getInstance("SHA-256");digest.update(entry.getValue());writer.beginObject();writer.name("name").value(entry.getKey().substring(7));writer.name("bytes").value(entry.getValue().length);writer.name("sha256").value(studio.engine.image.WorkerImageHex.of().formatHex(digest.digest()));writer.endObject();}writer.endArray();}return output.toString();
    }
    public String statistics(){live();return "{\"scope\":\"worker-pack-snapshot\",\"files\":"+files.size()+",\"bytes\":"+bytes+",\"byteLimit\":"+BYTE_LIMIT+",\"allocationWorkCharged\":"+work+",\"workLimit\":"+WORK_LIMIT+",\"reads\":"+reads+",\"writes\":"+writes+",\"atomicMoves\":"+moves+",\"deletes\":"+deletes+",\"prefixes\":"+keys.size()+",\"maxTileSize\":"+MAX_SIZE+",\"restoredFiles\":"+restored+",\"durablePersistence\":false}";}
    public void release(){files.clear();lengths.clear();keys.clear();bytes=0;work=0;reads=0;writes=0;moves=0;deletes=0;restored=0;}
}
