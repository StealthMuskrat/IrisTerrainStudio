// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;
import org.teavm.jso.JSExport;
import studio.engine.matter.WorkerContinuationStore;
import java.util.*;
import java.io.*;

/** A few real native plan/cache/Matter operations. No registry, terrain sweep or replacement plan ABI. */
public final class NativeObjectSessionProbe {
    private static void require(boolean value,String label){if(!value)throw new AssertionError(label);}
    private static ObjectDestinationTransaction.SetMutation marker(int x,String value){return new ObjectDestinationTransaction.SetMutation(new ObjectDestinationTransaction.DataKey(x,5,1,String.class),value);}
    @JSExport public static String run()throws IOException{
        Object owner=new Object();var session=new WorkerObjectSession(owner);
        ObjectSourcePlan plan=new ObjectSourcePlan(List.of(marker(15,"crossing"),marker(16,"crossing")),List.of(new ObjectDestinationTransaction.PlacementRange(0,2)));
        require(plan.destinationCount()==2,"native compressed destinations");
        try(var pass=session.begin(owner)){require(session.acquire(owner,0,0,0,0,1,()->plan)==plan,"first destination");pass.commit();}
        try(var pass=session.begin(owner)){require(session.acquire(owner,0,0,1,0,1,()->{throw new AssertionError("retained native plan rebuilt");})==plan,"retained destination");pass.commit();}
        String reused=session.statistics(owner);require(reused.contains("\"builds\":1,")&&reused.contains("\"drained\":1,"),"native cache reused/drained");
        byte[] payload=ObjectSourcePlan.encode(List.of(marker(16,"crossing")),64);
        var key=new ObjectContinuationBundle.PlacementKey(ObjectContinuationBundle.Kind.BIOME,0,0,0);
        var fragment=new ObjectContinuationBundle.Fragment(key,new ObjectContinuationBundle.Bounds(15,1,16,1),List.of(new ObjectContinuationBundle.ChunkPosition(0,0),new ObjectContinuationBundle.ChunkPosition(1,0)),payload);
        var bundle=new ObjectContinuationBundle(List.of(fragment));var store=session.continuations(owner);store.put(owner,1,0,bundle);
        byte[] copy=fragment.payload();copy[0]^=1;var restored=store.get(owner,1,0);var decoded=restored.fragments().getFirst().decode();require("crossing".equals(decoded.getSlice(String.class).get(0,5,1)),"native continuation value");require(decoded.getSlice(String.class).get(1,5,1)==null,"native continuation bounds");
        ByteArrayOutputStream output=new ByteArrayOutputStream();bundle.write(new DataOutputStream(output));byte[] wire=output.toByteArray();var reread=ObjectContinuationBundle.read(new DataInputStream(new ByteArrayInputStream(wire)));output.reset();reread.write(new DataOutputStream(output));require(Arrays.equals(wire,output.toByteArray()),"native bundle round trip");
        boolean foreign=false;try{session.begin(new Object());}catch(IllegalArgumentException expected){foreign=true;}require(foreign,"foreign context refused");
        boolean outside=false;try{session.acquire(owner,0,0,0,0,1,()->plan);}catch(IllegalStateException expected){outside=true;}require(outside,"cache outside pass refused");
        boolean nested=false;try(var pass=session.begin(owner)){try{session.begin(owner);}catch(IllegalStateException expected){nested=true;}pass.commit();}require(nested,"nested pass refused");
        try(var pass=session.begin(owner)){require(session.acquire(owner,2,0,2,0,1,()->new ObjectSourcePlan(List.of()))==null,"empty source");}
        String aborted=session.statistics(owner);require(aborted.contains("\"retained\":0,")&&store.chunkCount(owner)==0&&store.retainedBytes(owner)==0,"aborted pass released owned state");
        boolean oversized=false;try(var small=new WorkerContinuationStore(owner,32,1)){try{small.put(owner,1,0,bundle);}catch(UnsupportedOperationException expected){oversized=expected.getCause() instanceof Error;}require(small.chunkCount(owner)==0,"oversized admission was atomic");}require(oversized,"oversized bundle refused");
        boolean capacity=false;try(var one=new WorkerContinuationStore(owner,1024*1024,1)){one.put(owner,1,0,bundle);try{one.put(owner,2,0,bundle);}catch(UnsupportedOperationException expected){capacity=true;}require(one.chunkCount(owner)==1&&one.get(owner,1,0)!=null,"chunk admission was atomic");}require(capacity,"chunk budget refused");
        boolean trailing=false;byte[] bad=Arrays.copyOf(payload,payload.length+1);try{new ObjectContinuationBundle.Fragment(key,fragment.bounds(),fragment.touchedChunks(),bad).decode();}catch(IOException expected){trailing=true;}require(trailing,"trailing native payload refused");
        session.close();session.close();boolean closed=false;try{session.begin(owner);}catch(IllegalStateException expected){closed=true;}require(closed,"released context refused");
        return "{\"reused\":"+reused+",\"aborted\":"+aborted+",\"destinations\":"+plan.destinationCount()+",\"continuationValue\":\"crossing\",\"bundleBytes\":"+wire.length+",\"foreign\":"+foreign+",\"outside\":"+outside+",\"nested\":"+nested+",\"oversized\":"+oversized+",\"capacity\":"+capacity+",\"trailing\":"+trailing+",\"closed\":"+closed+"}";
    }
    public static void main(String[] args){}
}
