// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.matter;
import art.arcane.iris.generation.mantle.ObjectContinuationBundle;
import java.util.*;
import java.io.*;

/** Owned, bounded native bundle bytes for one preview context. No disk/world persistence or silent eviction. */
public final class WorkerContinuationStore implements AutoCloseable {
    private final Object owner;private final int byteBudget,chunkBudget;private final Map<Long,byte[]> chunks=new LinkedHashMap<>();private int retained;private boolean closed;
    public WorkerContinuationStore(Object owner,int byteBudget,int chunkBudget){this.owner=Objects.requireNonNull(owner);if(byteBudget<1||chunkBudget<1)throw new IllegalArgumentException("Positive continuation budgets required");this.byteBudget=byteBudget;this.chunkBudget=chunkBudget;}
    private void require(Object token){if(closed)throw new IllegalStateException("Continuation store is closed");if(owner!=token)throw new IllegalArgumentException("Continuation store belongs to another context");}
    private static long key(int x,int z){return ((long)x<<32)|(z&0xffffffffL);}
    public void put(Object token,int x,int z,ObjectContinuationBundle bundle)throws IOException{
        require(token);Objects.requireNonNull(bundle);long bound=4;for(var fragment:bundle.fragments()){bound+=64L+8L*fragment.touchedChunks().size()+fragment.encodedSize();if(bound>byteBudget)throw studio.engine.UnsupportedPlatform.unavailable("Worker continuation bundle exceeds its byte budget");}ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(DataOutputStream output=new DataOutputStream(bytes)){bundle.write(output);}byte[] encoded=bytes.toByteArray();long key=key(x,z);byte[] previous=chunks.get(key);long weight=(long)retained-(previous==null?0:previous.length)+encoded.length;
        if(weight>byteBudget||(previous==null&&chunks.size()>=chunkBudget))throw studio.engine.UnsupportedPlatform.unavailable("Worker continuation storage budget exceeded");chunks.put(key,encoded);retained=(int)weight;
    }
    public ObjectContinuationBundle get(Object token,int x,int z)throws IOException{
        require(token);byte[] bytes=chunks.get(key(x,z));if(bytes==null)return null;try(DataInputStream input=new DataInputStream(new ByteArrayInputStream(bytes))){var result=ObjectContinuationBundle.read(input);if(input.read()!=-1)throw new IOException("Trailing native continuation bundle bytes");return result;}
    }
    public Set<Long> keys(Object token){require(token);return Set.copyOf(chunks.keySet());}
    public int retainedBytes(Object token){require(token);return retained;}public int chunkCount(Object token){require(token);return chunks.size();}
    public void clear(Object token){require(token);chunks.clear();retained=0;}
    @Override public void close(){chunks.clear();retained=0;closed=true;}
}
