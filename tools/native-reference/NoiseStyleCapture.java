package studio.reference;

import art.arcane.iris.generation.noise.NoiseSeedCohesionTest;
import art.arcane.iris.generation.noise.NoiseStyle;
import art.arcane.volmlib.util.math.RNG;
import art.arcane.volmlib.util.noise.CNG;
import art.arcane.volmlib.util.noise.FractalBillowSimplexNoise;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.io.PrintWriter;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Development diagnostic. Calls the unchanged upstream fixture's own sampler. */
public final class NoiseStyleCapture {
    public static void main(String[] args) throws Exception {
        Field seedsField = NoiseSeedCohesionTest.class.getDeclaredField("SEEDS");
        seedsField.setAccessible(true);
        long[] seeds = (long[]) seedsField.get(null);
        Method sampler = NoiseSeedCohesionTest.class.getDeclaredMethod("samples", CNG.class, boolean.class);
        sampler.setAccessible(true);
        Path output = Path.of(args[0]);
        Files.createDirectories(output.getParent());
        String classHash;
        try (var bytes = CNG.class.getResourceAsStream("CNG.class")) {
            classHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.readAllBytes()));
        }
        long aggregate = 0xcbf29ce484222325L;
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(output))) {
            out.println("{\"formatVersion\":1,\"scope\":\"native-cng-isolation-diagnostic\",\"styles\":[");
            boolean first = true;
            for (NoiseStyle style : NoiseStyle.values()) {
                for (long seed : seeds) {
                    if (!first) out.println(",");
                    first = false;
                    out.print("{\"style\":\"" + style.name() + "\",\"seed\":\"" + seed + "\",\"bits\":[");
                    double[] samples = (double[]) sampler.invoke(null, style.create(new RNG(seed)), false);
                    for (int i = 0; i < samples.length; i++) {
                        long bits = Double.doubleToLongBits(samples[i]);
                        aggregate = (aggregate ^ bits) * 0x100000001b3L;
                        if (i > 0) out.print(',');
                        out.print('"' + String.format("%016x", bits) + '"');
                    }
                    out.print("]}");
                }
            }
            out.println("],\"cngClassSha256\":\"" + classHash + "\",\"aggregate\":\"" + aggregate + "\"}");
            if (out.checkError()) throw new java.io.IOException("Capture write failed");
        }
        // Preserve and execute the original assertion; a diagnostic match is not release qualification.
        try {
            new NoiseSeedCohesionTest().allStylesRetainPinnedSamples();
            System.out.println("Original upstream checksum assertion: PASS");
        } catch (AssertionError failure) {
            System.out.println("Original upstream checksum assertion: FAIL: " + failure.getMessage());
        }
        System.out.println("Captured aggregate: " + aggregate);
        System.out.println("Native billow backend: " + FractalBillowSimplexNoise.nativeBackendStatus());
        System.out.println("JVM mode: " + System.getProperty("java.vm.info"));
    }
}
