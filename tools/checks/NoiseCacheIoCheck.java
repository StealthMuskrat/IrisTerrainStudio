// Small host-service check; controlled ownership, original native FloatCache codec, no noise tile fill.
package studio.engine.noise;
import java.io.*;
import java.nio.file.*;
import art.arcane.volmlib.util.cache.FloatCache;

public final class NoiseCacheIoCheck {
    private static int assertions;
    private static void check(boolean value){if(!value)throw new AssertionError();assertions++;}
    private static void refuses(Runnable call){try{call.run();}catch(IllegalArgumentException|IllegalStateException expected){check(art.arcane.iris.generation.runtime.GenerationFailures.isEngineFailure(expected));assertions++;return;}throw new AssertionError("Expected refusal");}
    public static void main(String[] args)throws Exception{
        boolean[] live={true};var store=new MemoryNoiseStore(()->live[0],"/owned-a");File root=store.root();MemoryNoiseIO.admit(2,"tiny",root);
        File folder=new MemoryNoiseFile(root,".cache"),target=new MemoryNoiseFile(folder,"tiny.cnm"),temporary=new MemoryNoiseFile(folder,"tiny.cnm.test.tmp");
        var tile=new FloatCache(2,2);tile.set(0,0.25f);tile.set(1,-0.0f);tile.set(2,Float.intBitsToFloat(0x3f123456));tile.set(3,1f);
        try(var output=new DataOutputStream(new MemoryNoiseOutput(temporary))){tile.writeCache(output);}check(temporary.exists()&&!target.exists());MemoryNoiseIO.move(temporary,target,new CopyOption[]{StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE});check(target.exists()&&!temporary.exists());
        var decoded=new FloatCache(new DataInputStream(new MemoryNoiseInput(target)));check(Float.floatToRawIntBits(decoded.get(1))==0x80000000);check(Float.floatToRawIntBits(decoded.get(2))==0x3f123456);check(folder.listFiles((dir,name)->name.endsWith(".cnm")).length==1);
        File incomplete=new MemoryNoiseFile(folder,"tiny.cnm.bad.tmp");boolean incompleteRefused=false;try(var output=new MemoryNoiseOutput(incomplete)){output.write(1);}catch(IOException expected){check(art.arcane.iris.generation.runtime.GenerationFailures.isEngineFailure(expected));incompleteRefused=true;}check(incompleteRefused&&!incomplete.exists());
        var foreign=new MemoryNoiseStore(()->true,"/owned-b");boolean crossOwnerRefused=false;try{MemoryNoiseIO.move(target,new MemoryNoiseFile(new MemoryNoiseFile(foreign.root(),".cache"),"tiny.cnm"),new CopyOption[]{StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE});}catch(IOException expected){check(art.arcane.iris.generation.runtime.GenerationFailures.isEngineFailure(expected));crossOwnerRefused=true;}check(crossOwnerRefused&&target.exists());
        check(MemoryNoiseIO.deleteIfExists(target));check(!MemoryNoiseIO.deleteIfExists(target));refuses(()->new MemoryNoiseFile(folder,"../escape"));refuses(()->MemoryNoiseIO.admit(1025,"large",root));
        var budget=new MemoryNoiseStore(()->true,"/budget");for(int i=0;i<3;i++)MemoryNoiseIO.admit(1024,"admission-only",budget.root());refuses(()->MemoryNoiseIO.admit(1024,"admission-only",budget.root()));
        live[0]=false;refuses(target::exists);refuses(()->MemoryNoiseIO.admit(2,"stale",root));store.release();
        Files.writeString(Path.of(args[0]),"{\"result\":\"pass\",\"scope\":\"noise-cache-host-io-controlled-owner\",\"assertions\":"+assertions+",\"codecCells\":4,\"nativeEngineFailureClassification\":true,\"largeTileAdmissionsOnly\":true,\"noiseTileFillRun\":false,\"browserVerified\":false}\n");System.out.println("Noise cache IO passed: four codec cells, ownership/atomic IO and admission-only budget checks.");
    }
}
