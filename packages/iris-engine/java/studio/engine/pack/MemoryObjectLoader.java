// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;

import art.arcane.iris.pack.loading.*;
import art.arcane.iris.structure.object.IrisObject;
import java.io.*;
import java.util.*;

/** Native binary parsing and registry resolution; only file access/cache ownership is adapted. */
final class MemoryObjectLoader extends ResourceLoader<IrisObject> {
    private final MemoryPack pack;
    private final IrisData data;
    private final Map<String,IrisObject> cache=new LinkedHashMap<>(16,0.75f,true);
    private int cachedBytes;
    MemoryObjectLoader(MemoryPack pack,IrisData data){super(new File("/iris-memory-pack"),data,"objects","Object",IrisObject.class,Options.datapackCompiler());this.pack=pack;this.data=data;}
    @Override public IrisObject load(String name){return load(name,true);}
    @Override public IrisObject load(String name,boolean warn){
        if(name==null||name.isBlank()||(warn&&name.equals("null")))return null;
        if(name.contains(":"))return null;
        IrisObject existing=cache.get(name);if(existing!=null)return existing;
        byte[] bytes=pack.objectBytes(name);if(bytes==null)return null;
        IrisObject object=new IrisObject(0,0,0);object.setLoader(data);object.setLoadKey(name);File file=new MemoryObjectFile(pack,name);object.setLoadFile(file);
        try{object.read(file);}catch(IOException failure){throw new IllegalArgumentException("Cannot decode native object: "+name,failure);}
        cache.put(name,object);cachedBytes+=bytes.length;
        while(cache.size()>8||cachedBytes>16*1024*1024){String oldest=cache.keySet().iterator().next();cache.remove(oldest);cachedBytes-=pack.objectBytes(oldest).length;}
        return object;
    }
    @Override public File findFile(String name){if(name==null||name.isBlank()||name.equals("null")||name.contains(":"))return null;return pack.objectBytes(name)==null?null:new MemoryObjectFile(pack,name);}
    @Override public boolean supportsSchemas(){return false;}
    @Override public IrisData getManager(){return data;}
    @Override public String getFolderName(){return "objects";}
    @Override public String getResourceTypeName(){return "Object";}
    @Override public String getCname(){return IrisObject.class.getCanonicalName();}
    @Override public File getRoot(){return new File("/iris-memory-pack");}
    @Override public Options getOptions(){return Options.datapackCompiler();}
    @Override public Class<? extends IrisObject> getObjectClass(){return IrisObject.class;}
    @Override public String[] getPossibleKeys(){return pack.objectKeys();}
    @Override public long count(){return cache.size();}
    @Override public void clearCache(){cache.clear();cachedBytes=0;}
    @Override public void unload(String name){if(cache.remove(name)!=null)cachedBytes-=pack.objectBytes(name).length;}
    @Override public boolean isLoaded(String name){return cache.containsKey(name);}
}
