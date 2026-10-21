// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;

import art.arcane.iris.pack.loading.*;
import studio.engine.config.NativeConfigReader;
import java.io.*;
import java.util.*;

/** Native ResourceLoader API with browser memory IO and worker-local caching. */
final class MemoryResourceLoader<T extends IrisRegistrant> extends ResourceLoader<T> {
    private final MemoryPack pack;
    private final IrisData data;
    private final String folder,typeName;
    private final Class<T> type;
    private final Map<String,T> cache=new LinkedHashMap<>();
    private final Set<String> loading=new HashSet<>();
    MemoryResourceLoader(MemoryPack pack,IrisData data,String folder,String typeName,Class<T> type){
        // The browser plugin replaces only the original IO/cache constructor.
        super(new File("/iris-memory-pack"),data,folder,typeName,type,Options.datapackCompiler());
        this.pack=pack;this.data=data;this.folder=folder;this.typeName=typeName;this.type=type;
    }
    @Override public T load(String name){return load(name,true);}
    @Override @SuppressWarnings("unchecked") public T load(String name,boolean warn){
        if(name==null||name.trim().isEmpty()||(warn&&name.equals("null")))return null;
        if(cache.containsKey(name))return cache.get(name);
        String path=pack.resolve(folder,name);if(path==null)return null;
        if(loading.size()>=100||!loading.add(name))throw new IllegalArgumentException("Native resource reference cycle or depth exceeded: "+folder+"/"+name);
        try{
            T resource=(T)NativeConfigReader.readRegistrant(type,pack.text(path));
            if(resource==null)throw new IllegalArgumentException("Native resource must contain an object: "+path);
            resource.setLoadKey(name);resource.setLoadFile(new MemoryResourceFile(pack,path));resource.setLoader(data);
            // Native evaluateCompat overrides retain their pool cascades. With
            // the unbound gate this is authoring data, never qualified terrain.
            resource.setCompat(resource.evaluateCompat(pack.contentGate(data)));
            cache.put(name,resource);return resource;
        }catch(IOException failure){throw new IllegalArgumentException("Cannot decode native resource: "+path,failure);}finally{loading.remove(name);}
    }
    @Override public IrisData getManager(){return data;}
    @Override public String getFolderName(){return folder;}
    @Override public String getResourceTypeName(){return typeName;}
    @Override public String getCname(){return type.getCanonicalName();}
    @Override public File getRoot(){return new File("/iris-memory-pack");}
    @Override public Options getOptions(){return Options.datapackCompiler();}
    @Override public Class<? extends T> getObjectClass(){return type;}
    @Override public String[] getPossibleKeys(){return pack.keys(folder);}
    @Override public long count(){return cache.size();}
    @Override public void clearCache(){cache.clear();loading.clear();}
    @Override public void unload(String name){cache.remove(name);}
    @Override public boolean isLoaded(String name){return cache.containsKey(name);}
}
