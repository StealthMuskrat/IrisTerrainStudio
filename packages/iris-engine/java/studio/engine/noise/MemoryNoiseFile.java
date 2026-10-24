// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.noise;
import java.io.*;

/** Native File-shaped capability, limited to one live snapshot cache directory. */
public final class MemoryNoiseFile extends File {
    final MemoryNoiseStore store;
    private final String relative;
    MemoryNoiseFile(MemoryNoiseStore store,String relative){super(store.rootPath()+(relative.isEmpty()?"":"/"+relative));this.store=store;this.relative=relative;}
    public MemoryNoiseFile(File parent,String child){this(parentStore(parent),childPath(parent,child));}
    private static MemoryNoiseStore parentStore(File parent){if(!(parent instanceof MemoryNoiseFile owned))throw MemoryNoiseIO.failure("Noise cache requires an owned snapshot root");owned.store.live();return owned.store;}
    private static String childPath(File parent,String child){
        MemoryNoiseFile owned=(MemoryNoiseFile)parent;if(child==null||child.isEmpty()||child.contains("/")||child.contains("\\")||child.contains(":")||child.equals(".")||child.equals("..")||child.chars().anyMatch(c->c<32))throw MemoryNoiseIO.failure("Invalid owned noise cache child");
        if(owned.relative.isEmpty()&&!child.equals(".cache")||!owned.relative.isEmpty()&&!owned.relative.equals(".cache"))throw MemoryNoiseIO.failure("Noise cache path escapes its directory");return owned.relative.isEmpty()?child:owned.relative+"/"+child;
    }
    String relative(){return relative;}
    @Override public boolean exists(){return store.exists(relative);}
    @Override public boolean isDirectory(){store.live();return relative.isEmpty()||relative.equals(".cache");}
    @Override public boolean isFile(){return !isDirectory()&&exists();}
    @Override public boolean mkdirs(){store.live();if(!isDirectory())throw MemoryNoiseIO.failure("Noise cache mkdir outside its directory");return true;}
    @Override public File getParentFile(){store.live();int slash=relative.lastIndexOf('/');return relative.isEmpty()?null:new MemoryNoiseFile(store,slash<0?"":relative.substring(0,slash));}
    @Override public String getAbsolutePath(){return getPath();}
    @Override public File[] listFiles(FilenameFilter filter){return store.list(this,filter);}
    @Override public boolean delete(){return store.delete(relative);}
}
