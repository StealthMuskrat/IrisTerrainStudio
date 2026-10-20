// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;

import art.arcane.iris.generation.noise.NoiseStyle;
import art.arcane.iris.generation.noise.IrisNoiseGenerator;
import art.arcane.iris.generation.noise.IrisGenerator;
import art.arcane.iris.generation.noise.IrisInterpolator;
import art.arcane.volmlib.util.interpolation.InterpolationMethod;
import art.arcane.volmlib.util.collection.KList;
import art.arcane.iris.generation.noise.IrisGeneratorStyle;
import art.arcane.iris.generation.runtime.SeedManager;
import art.arcane.volmlib.util.math.RNG;
import art.arcane.volmlib.util.noise.CNG;
import org.teavm.jso.JSExport;
import java.util.LinkedHashMap;
import java.util.Map;

/** Browser entry points into the actual pinned Iris classes. No terrain replacement algorithms. */
public final class BrowserEngine {
    private record Definition(String style, double zoom, double exponent, double frequency,
                              double cellularZoom, String fracture, double multiplier, int octaves) {}
    private static final Map<String, Definition> definitions = new LinkedHashMap<>();
    private static final Map<String, IrisNoiseGenerator> layers = new LinkedHashMap<>();
    private static final Map<String, IrisGenerator> composites = new LinkedHashMap<>();
    private static final Map<String, CNG> generators = new LinkedHashMap<>();

    @JSExport
    public static String noiseStyles() {
        StringBuilder out = new StringBuilder("[");
        for (NoiseStyle style : NoiseStyle.values()) {
            if (out.length() > 1) out.append(',');
            out.append('"').append(style.name()).append('"');
        }
        return out.append(']').toString();
    }

    @JSExport
    public static void defineStyle(String id, String style, double zoom, double exponent,
                                   double frequency, double cellularZoom, String fracture,
                                   double multiplier, int octaves) {
        if (id == null || id.isEmpty() || id.length() > 256) throw new IllegalArgumentException("Invalid style identifier");
        NoiseStyle.valueOf(style);
        if (definitions.size() >= 256 && !definitions.containsKey(id)) throw new IllegalArgumentException("Too many style definitions");
        definitions.put(id, new Definition(style, zoom, exponent, frequency, cellularZoom,
                fracture == null || fracture.isEmpty() ? null : fracture, multiplier, octaves));
        generators.clear();
    }

    private static IrisGeneratorStyle configured(String id, String seen, int depth) {
        if (depth > 32 || seen.contains("|" + id + "|")) throw new IllegalArgumentException("Fracture reference cycle");
        Definition source = definitions.get(id);
        if (source == null) throw new IllegalArgumentException("Missing style definition: " + id);
        IrisGeneratorStyle style = new IrisGeneratorStyle(NoiseStyle.valueOf(source.style()))
                .setZoom(source.zoom()).setExponent(source.exponent())
                .setCellularFrequency(source.frequency()).setCellularZoom(source.cellularZoom())
                .setMultiplier(source.multiplier());
        if (source.fracture() != null) style.setFracture(configured(source.fracture(), seen + "|" + id + "|", depth + 1));
        return style;
    }

    private static CNG cached(String key, java.util.function.Supplier<CNG> factory) {
        CNG generator = generators.get(key);
        if (generator == null) {
            if (generators.size() >= 32) generators.remove(generators.keySet().iterator().next());
            generator = factory.get(); generators.put(key, generator);
        }
        return generator;
    }

    @JSExport
    public static String sampleStyle(String style, String decimalSeed, double x, double y, double z, int dimensions) {
        long seed = Long.parseLong(decimalSeed);
        CNG generator = cached("preset:" + style + ":" + decimalSeed,
                () -> NoiseStyle.valueOf(style).create(new RNG(seed)));
        return bits(sample(generator, x, y, z, dimensions));
    }

    @JSExport
    public static String sampleConfigured(String id, String decimalSeed, double x, double y, double z, int dimensions) {
        long seed = Long.parseLong(decimalSeed);
        CNG generator = cached("configured:" + id + ":" + decimalSeed, () -> {
            Definition source = definitions.get(id);
            if (source == null) throw new IllegalArgumentException("Missing style definition: " + id);
            return configured(id, "", 0).createForLayer(new RNG(seed), null, source.octaves());
        });
        return bits(sample(generator, x, y, z, dimensions));
    }

    @JSExport
    public static void defineLayer(String id, String styleId, String decimalSeed, double zoom, double opacity,
                                   double offsetX, double offsetY, double offsetZ, double exponent, boolean negative,
                                   boolean enabled, boolean parametric, boolean bezier, boolean sinCentered,
                                   int octaves, String children) {
        if (layers.size() >= 512 && !layers.containsKey(id)) throw new IllegalArgumentException("Too many noise layers");
        IrisNoiseGenerator layer = new IrisNoiseGenerator().setStyle(configured(styleId, "", 0))
                .setSeed(Long.parseLong(decimalSeed)).setZoom(zoom).setOpacity(opacity)
                .setOffsetX(offsetX).setOffsetY(offsetY).setOffsetZ(offsetZ).setExponent(exponent)
                .setNegative(negative).setEnabled(enabled).setParametric(parametric).setBezier(bezier)
                .setSinCentered(sinCentered).setOctaves(octaves);
        KList<IrisNoiseGenerator> fractures = new KList<>();
        if (!children.isEmpty()) for (String child : children.split(",")) {
            IrisNoiseGenerator fracture = layers.get(child);
            if (fracture == null) throw new IllegalArgumentException("Missing fracture layer: " + child);
            fractures.add(fracture);
        }
        layer.setFracture(fractures); layers.put(id, layer);
    }

    @JSExport
    public static void defineGenerator(String id, String children, String decimalSeed, double zoom, double opacity,
                                       double surfaceDetail, boolean multiplicitive, double offsetX, double offsetZ,
                                       double cellZoom, double cellShuffle, double cellHeight, double cellPercent,
                                       double cliffMin, double cliffMax, String cliffLayer, String interpolation,
                                       double interpolationScale) {
        if (composites.size() >= 64 && !composites.containsKey(id)) throw new IllegalArgumentException("Too many composite generators");
        IrisGenerator generator = new IrisGenerator().setSeed(Long.parseLong(decimalSeed)).setZoom(zoom)
                .setOpacity(opacity).setSurfaceDetail(surfaceDetail).setMultiplicitive(multiplicitive)
                .setOffsetX(offsetX).setOffsetZ(offsetZ).setCellFractureZoom(cellZoom)
                .setCellFractureShuffle(cellShuffle).setCellFractureHeight(cellHeight).setCellPercentSize(cellPercent)
                .setCliffHeightMin(cliffMin).setCliffHeightMax(cliffMax)
                .setInterpolator(new IrisInterpolator().setFunction(InterpolationMethod.valueOf(interpolation))
                        .setHorizontalScale(interpolationScale));
        KList<IrisNoiseGenerator> list = new KList<>();
        if (!children.isEmpty()) for (String child : children.split(",")) {
            IrisNoiseGenerator layer = layers.get(child);
            if (layer == null) throw new IllegalArgumentException("Missing composite layer: " + child);
            list.add(layer);
        }
        generator.setComposite(list);
        if (!cliffLayer.isEmpty()) {
            IrisNoiseGenerator cliff = layers.get(cliffLayer);
            if (cliff == null) throw new IllegalArgumentException("Missing cliff layer");
            generator.setCliffHeightGenerator(cliff);
        }
        composites.put(id, generator);
    }

    @JSExport
    public static String sampleLayer(String id, String decimalSeed, double x, double z) {
        IrisNoiseGenerator layer = layers.get(id);
        if (layer == null) throw new IllegalArgumentException("Missing noise layer");
        return bits(layer.getNoise(Long.parseLong(decimalSeed), x, z, null));
    }

    @JSExport
    public static String sampleGenerator(String id, String decimalSeed, double x, double z) {
        IrisGenerator generator = composites.get(id);
        if (generator == null) throw new IllegalArgumentException("Missing composite generator");
        return bits(generator.getHeight(x, z, Long.parseLong(decimalSeed)));
    }

    private static double sample(CNG generator, double x, double y, double z, int dimensions) {
        if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) throw new IllegalArgumentException("Coordinates must be finite");
        return switch (dimensions) {
            case 1 -> generator.noise(x);
            case 2 -> generator.noise(x, z);
            case 3 -> generator.noise(x, y, z);
            default -> throw new IllegalArgumentException("Noise dimensions must be 1, 2 or 3");
        };
    }

    private static String bits(double value) {
        if (!Double.isFinite(value)) throw new IllegalStateException("The native generator returned a non-finite value");
        String hex = Long.toHexString(Double.doubleToRawLongBits(value));
        return "0000000000000000".substring(hex.length()) + hex;
    }

    @JSExport
    public static String seedComponents(String decimalSeed) {
        SeedManager seeds = new SeedManager(Long.parseLong(decimalSeed));
        return "{\"seed\":\"" + seeds.getSeed() + "\",\"complex\":\"" + seeds.getComplex()
                + "\",\"complexStreams\":\"" + seeds.getComplexStreams() + "\",\"basic\":\"" + seeds.getBasic()
                + "\",\"height\":\"" + seeds.getHeight() + "\",\"component\":\"" + seeds.getComponent()
                + "\",\"script\":\"" + seeds.getScript() + "\",\"mantle\":\"" + seeds.getMantle()
                + "\",\"biome\":\"" + seeds.getBiome() + "\",\"decorator\":\"" + seeds.getDecorator()
                + "\",\"terrain\":\"" + seeds.getTerrain() + "\",\"carve\":\"" + seeds.getCarve()
                + "\",\"deposit\":\"" + seeds.getDeposit() + "\",\"post\":\"" + seeds.getPost()
                + "\",\"bodies\":\"" + seeds.getBodies() + "\",\"mode\":\"" + seeds.getMode()
                + "\",\"fullMixedSeed\":\"" + seeds.getFullMixedSeed() + "\"}";
    }

    @JSExport
    public static String diagnosticRng(String seed) { return studio.probe.RngProbe.sample(seed, false, "0"); }

    @JSExport
    public static void clear() { definitions.clear(); generators.clear(); layers.clear(); composites.clear(); }
    public static void main(String[] args) { }
}
