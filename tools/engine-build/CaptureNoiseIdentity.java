package studio.build;
import art.arcane.iris.world.history.GenerationKernelRegistry;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
/** Capture the actual native cache namespace; this is not release qualification. */
public final class CaptureNoiseIdentity {
    public static void main(String[] args)throws Exception{
        var registry=GenerationKernelRegistry.standard();var version=registry.current();String fingerprint=registry.requireSupported(version).implementationFingerprint();
        String resource="/META-INF/iris/generation-kernels/abi-"+version.generatorAbi()+".revision";byte[] bytes;
        try(var input=GenerationKernelRegistry.class.getResourceAsStream(resource)){if(input==null)throw new IllegalStateException("Missing native kernel revision");bytes=input.readAllBytes();}
        String digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));if(!digest.equals(fingerprint))throw new IllegalStateException("Native cache fingerprint/resource mismatch");
        Files.writeString(Path.of(args[0]),new com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(Map.of("generatorAbi",version.generatorAbi(),"rngVersion",version.rngVersion(),"seedDerivationVersion",version.seedDerivationVersion(),"implementationFingerprint",fingerprint,"revisionResource",resource,"revisionResourceSha256",digest,"releaseMatchVerified",false))+"\n");
    }
}
