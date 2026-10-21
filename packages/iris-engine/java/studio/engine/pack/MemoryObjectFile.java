// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;
import java.io.*;

/** Immutable native File handle backed by one open snapshot, without filesystem access. */
final class MemoryObjectFile extends File {
    private final MemoryPack pack;
    private final byte[] bytes;
    MemoryObjectFile(MemoryPack pack,String name){super(pack.objectFilePath(name));this.pack=pack;this.bytes=pack.objectBytes(name);}
    byte[] content()throws IOException{if(!isFile())throw new IOException("Object handle is outside its open snapshot");return bytes;}
    @Override public boolean isFile(){return pack.isOpen()&&bytes!=null;}
    @Override public boolean exists(){return isFile();}
    @Override public boolean isDirectory(){return false;}
    @Override public long length(){return isFile()?bytes.length:0;}
    @Override public long lastModified(){return 0;} // Snapshot paths are unique and contents are sealed.
}
