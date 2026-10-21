// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.noise;
import art.arcane.iris.pack.loading.IrisData;
import studio.engine.pack.MemoryPack;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.ConcurrentHashMap;

/** Filesystem/metadata services only; original CNG fill, codec and sampling execute unchanged. */
public final class MemoryNoiseIO {
    static IllegalArgumentException failure(String reason){return new IllegalArgumentException(reason,new Error("Browser noise-cache bound"));}
    static IOException ioFailure(String reason){return new IOException(reason,new Error("Browser noise-cache IO boundary"));}
    static MemoryNoiseFile owned(File file)throws IOException{if(!(file instanceof MemoryNoiseFile owned))throw MemoryNoiseIO.ioFailure("Noise IO requires an owned snapshot handle");owned.store.live();return owned;}
    public static File root(IrisData data){if(data==null)throw MemoryNoiseIO.failure("Float-cached styles require an owned pack snapshot");return MemoryPack.owner(data).noiseCache().root();}
    public static ConcurrentHashMap<String,String> activeKeys(IrisData data){return MemoryPack.owner(data).noiseCache().keys();}
    public static void admit(int size,String key,File root){if(size<=0)return;try{owned(root).store.admit(size,key);}catch(IOException failure){throw new IllegalArgumentException(failure);}}
    public static File path(File file)throws IOException{owned(file);return file;}
    public static File move(File source,File target,CopyOption[] options)throws IOException{
        MemoryNoiseFile from=owned(source),to=owned(target);if(from.store!=to.store||options.length!=2||options[0]!=StandardCopyOption.REPLACE_EXISTING||options[1]!=StandardCopyOption.ATOMIC_MOVE)throw MemoryNoiseIO.ioFailure("Noise tile move requires same-owner atomic replacement");from.store.move(from.relative(),to.relative());return target;
    }
    public static boolean deleteIfExists(File file)throws IOException{MemoryNoiseFile owned=owned(file);return owned.store.delete(owned.relative());}
}
