// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;
import art.arcane.iris.pack.loading.*;
import art.arcane.iris.generation.image.IrisImage;
import studio.engine.image.WorkerImageFactory;
import java.io.File;
import java.util.*;
/** Native image loader surface with immutable decoded bands, owner checks and a bounded local cache. */
final class MemoryImageLoader extends ImageResourceLoader {
    private final MemoryPack pack;private final IrisData data;private final Map<String,IrisImage> cache=new LinkedHashMap<>();
    MemoryImageLoader(MemoryPack pack,IrisData data){super(new File("/iris-memory-pack"),data,"images","Image",Options.datapackCompiler());this.pack=pack;this.data=data;}
    @Override public IrisImage load(String name){return load(name,true);}
    @Override public IrisImage load(String name,boolean warn){
        if(name==null||name.isBlank()||(warn&&name.equals("null"))||name.contains(":"))return null;if(!pack.isOpen())throw new IllegalStateException("Image loader snapshot is closed");
        var pixels=pack.image(name);if(pixels==null)return null;IrisImage prior=cache.get(name);if(prior!=null)return prior;
        IrisImage image=WorkerImageFactory.create(pixels);image.setLoadKey(name);image.setLoader(data);image.setLoadFile(new File("/iris-memory-pack/"+pack.imagePath(name)));
        if(cache.size()>=8)cache.remove(cache.keySet().iterator().next());cache.put(name,image);return image;
    }
    @Override public boolean supportsSchemas(){return false;}
    @Override public IrisData getManager(){return data;}@Override public String getFolderName(){return "images";}@Override public String getResourceTypeName(){return "Image";}
    @Override public String getCname(){return IrisImage.class.getCanonicalName();}@Override public File getRoot(){return new File("/iris-memory-pack");}@Override public Options getOptions(){return Options.datapackCompiler();}
    @Override public Class<? extends IrisImage> getObjectClass(){return IrisImage.class;}@Override public String[] getPossibleKeys(){return pack.imageKeys();}
    @Override public long count(){return cache.size();}@Override public long getSize(){return cache.size();}@Override public long getTotalStorage(){return getSize();}
    @Override public void clearCache(){cache.clear();}@Override public void unload(String name){cache.remove(name);}@Override public boolean isLoaded(String name){return cache.containsKey(name);}
    @Override public File findFile(String name){return name==null||name.isBlank()||name.contains(":")||pack.image(name)==null?null:new File("/iris-memory-pack/"+pack.imagePath(name));}
}
