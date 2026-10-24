import com.google.gson.JsonObject;
import org.junit.runner.JUnitCore;
import org.junit.runner.Request;
import java.nio.file.Files;
import java.nio.file.Path;

/** Runs exactly the unchanged upstream checksum assertion; no alternate expectation. */
public final class NativeNoiseChecksumCheck {
    public static void main(String[] args) throws Exception {
        var result=new JUnitCore().run(Request.method(
                art.arcane.iris.generation.noise.NoiseSeedCohesionTest.class,
                "allStylesRetainPinnedSamples"));
        var report=new JsonObject();report.addProperty("successful",result.wasSuccessful());
        report.addProperty("runCount",result.getRunCount());report.addProperty("failureCount",result.getFailureCount());
        var failures=new com.google.gson.JsonArray();
        for(var failure:result.getFailures()){
            var row=new JsonObject();row.addProperty("test",failure.getTestHeader());
            row.addProperty("exception",failure.getException().getClass().getName());
            row.addProperty("message",failure.getMessage());failures.add(row);
        }
        report.add("failures",failures);
        Files.writeString(Path.of(args[0]),report.toString()+"\n");
    }
}
