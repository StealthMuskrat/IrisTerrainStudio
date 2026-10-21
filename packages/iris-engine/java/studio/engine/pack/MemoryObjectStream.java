// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;
import java.io.*;

/** Replacement for native object FileInputStream calls; accepts only owned memory handles. */
public final class MemoryObjectStream extends ByteArrayInputStream {
    private static byte[] content(File file)throws IOException{if(file instanceof MemoryObjectFile owned)return owned.content();throw new IOException("Object stream requires an owned snapshot handle");}
    public MemoryObjectStream(File file)throws IOException{super(content(file));}
}
