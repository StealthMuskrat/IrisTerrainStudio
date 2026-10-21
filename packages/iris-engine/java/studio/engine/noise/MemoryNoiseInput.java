// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.noise;
import java.io.*;
public final class MemoryNoiseInput extends ByteArrayInputStream {
    public MemoryNoiseInput(File file)throws IOException{super(MemoryNoiseIO.owned(file).store.read(MemoryNoiseIO.owned(file).relative()));}
}
