// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.noise;
import java.io.*;
public final class MemoryNoiseOutput extends OutputStream {
    private final MemoryNoiseFile file;private final int expected;private final ByteArrayOutputStream bytes;private boolean closed;
    public MemoryNoiseOutput(File file)throws IOException{this.file=MemoryNoiseIO.owned(file);expected=this.file.store.expectedLength(this.file.relative());bytes=new ByteArrayOutputStream(expected);}
    private void room(int count)throws IOException{file.store.live();if(closed||count<0||count>expected-bytes.size())throw MemoryNoiseIO.ioFailure("Native noise codec exceeded its admitted output size");}
    @Override public void write(int value)throws IOException{room(1);bytes.write(value);}
    @Override public void write(byte[] value,int offset,int length)throws IOException{room(length);bytes.write(value,offset,length);}
    @Override public void close()throws IOException{if(closed)return;closed=true;if(bytes.size()!=expected)throw MemoryNoiseIO.ioFailure("Native noise codec produced an incomplete tile");file.store.write(file.relative(),bytes.toByteArray());}
}
