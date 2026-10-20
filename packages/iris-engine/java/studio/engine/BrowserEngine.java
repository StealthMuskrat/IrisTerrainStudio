// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;

import studio.engine.config.NativeConfigReader;
import art.arcane.iris.generation.noise.NoiseStyle;
import art.arcane.iris.generation.noise.IrisNoiseGenerator;
import art.arcane.iris.generation.noise.IrisGenerator;
import art.arcane.iris.generation.noise.IrisInterpolator;
import art.arcane.iris.generation.terrain.IrisDimension;
import art.arcane.iris.generation.terrain.ContinentGenerator;
import art.arcane.volmlib.util.stream.ProceduralStream;
import art.arcane.volmlib.util.interpolation.InterpolationMethod;
import art.arcane.volmlib.util.collection.KList;
import art.arcane.iris.generation.noise.IrisGeneratorStyle;
import art.arcane.iris.generation.runtime.SeedManager;
import art.arcane.volmlib.util.math.RNG;
import art.arcane.volmlib.util.noise.CNG;
import org.teavm.jso.JSExport;
import java.util.LinkedHashMap;
import java.util.Map;
import studio.engine.pack.MemoryPack;
import art.arcane.iris.pack.loading.IrisRegistrant;
import com.google.gson.stream.JsonWriter;
import java.io.StringWriter;
import studio.engine.registry.BrowserRegistries;
import studio.engine.config.NativeConfigWriter;
import art.arcane.iris.generation.terrain.RegionSelection;
import art.arcane.iris.generation.terrain.IrisRegion;

/** Browser entry points into the actual pinned Iris classes. No terrain replacement algorithms. */
public final class BrowserEngine {
    private record Definition(String style, double zoom, double exponent, double frequency,
                              double cellularZoom, String fracture, double multiplier, int octaves) {}
    private static final Map<String, Definition> definitions = new LinkedHashMap<>();
    private static final Map<String, IrisDimension> dimensions = new LinkedHashMap<>();
    private static final Map<String, ProceduralStream<Double>> controls = new LinkedHashMap<>();
    private static final Map<String, IrisGeneratorStyle> loadedStyles = new LinkedHashMap<>();
    private static final Map<String, IrisNoiseGenerator> layers = new LinkedHashMap<>();
    private static final Map<String, IrisGenerator> composites = new LinkedHashMap<>();
    private static final Map<String, CNG> generators = new LinkedHashMap<>();
    private static MemoryPack pack=new MemoryPack();
    private static BrowserRegistries registry;
    private static ProceduralStream<IrisRegion> selectedRegions;
    private static studio.engine.terrain.BrowserTerrainEngine terrain;
    @JSExport public static String prepareTerrain(String key,String seed){terrain=null;pack.open();pack.requireGenerationReady();IrisRegistrant resource=pack.load("dimensions",key);if(!(resource instanceof IrisDimension dimension)||dimension.isCompatExcluded())throw new IllegalArgumentException("Native dimension unavailable or excluded");terrain=new studio.engine.terrain.BrowserTerrainEngine(dimension,pack.open(),Long.parseLong(seed),registry);return "{\"minHeight\":"+terrain.getMinHeight()+",\"maxHeight\":"+terrain.getMaxHeight()+",\"terrainParityVerified\":false}";}
    @JSExport public static String sampleTerrainHeight(double x,double z){if(terrain==null)throw new IllegalStateException("Prepare native terrain first");if(!Double.isFinite(x)||!Double.isFinite(z))throw new IllegalArgumentException("Coordinates must be finite");return bits(terrain.getComplex().getHeightStream().getDouble(x,z));}
    @JSExport public static String sampleTerrainBiome(double x,double z){if(terrain==null)throw new IllegalStateException("Prepare native terrain first");if(!Double.isFinite(x)||!Double.isFinite(z))throw new IllegalArgumentException("Coordinates must be finite");var biome=terrain.getComplex().getTrueBiomeStream().get(x,z);if(biome==null)throw new IllegalStateException("Native biome pool returned no biome");return biome.getLoadKey();}

    @JSExport public static String paintTerrainChunk(int x,int z)throws java.io.IOException{if(terrain==null)throw new IllegalStateException("Prepare native terrain first");return studio.engine.terrain.TerrainPaintStage.paint(terrain,x,z);}
    @JSExport public static String carveDimensionChunk(int x,int z)throws java.io.IOException{if(terrain==null)throw new IllegalStateException("Prepare native terrain first");return studio.engine.terrain.TerrainCaveStage.carve(terrain,x,z);}
    @JSExport public static String paintDimensionCaveChunk(int x,int z)throws java.io.IOException{if(terrain==null)throw new IllegalStateException("Prepare native terrain first");return studio.engine.terrain.TerrainCaveMaterials.paint(terrain,x,z);}
    @JSExport public static String paintCaveComponentChunk(int x,int z)throws java.io.IOException{if(terrain==null)throw new IllegalStateException("Prepare native terrain first");return studio.engine.terrain.TerrainCarvingComponent.paint(terrain,x,z);}
    @JSExport public static String paintPostChunk(int x,int z)throws java.io.IOException{if(terrain==null)throw new IllegalStateException("Prepare native terrain first");return studio.engine.terrain.TerrainCarvingComponent.paint(terrain,x,z,true);}
    @JSExport public static String paintFloatingChunk(int x,int z)throws java.io.IOException{if(terrain==null)throw new IllegalStateException("Prepare native terrain first");return studio.engine.terrain.TerrainCarvingComponent.paint(terrain,x,z,true,true);}
    @JSExport public static String sampleTerrainColumn(int x,int z)throws java.io.IOException{
        if(terrain==null)throw new IllegalStateException("Prepare native terrain first");var column=terrain.getComplex().naturalTerrainColumn(x,z);if(column==null)return "null";
        StringWriter output=new StringWriter();try(JsonWriter writer=new JsonWriter(output)){writer.beginObject();writer.name("baseHeight").value(bits(column.baseHeight()));writer.name("minY").value(column.minY());writer.name("topY").value(column.topY());writer.name("shaped").value(column.shaped());writer.name("spans").beginArray();for(int i=0;i<column.spanCount();i++){writer.beginArray();writer.value(column.ceiling(i));writer.value(column.floor(i));writer.endArray();}writer.endArray();writer.name("occupancy");StringBuilder occupancy=new StringBuilder();for(int y=0;y<terrain.getHeight();y++)occupancy.append(column.isSolid(y)?'1':'0');writer.value(occupancy.toString());writer.endObject();}return output.toString();
    }
    /** Categorical native column state: unshaped, empty, or solid; never a replacement block palette. */
    @JSExport public static int sampleTerrainOccupancy(double x,double worldY,double z){
        if(terrain==null)throw new IllegalStateException("Prepare native terrain first");if(!Double.isFinite(x)||!Double.isFinite(worldY)||!Double.isFinite(z)||Math.abs(x)>30000000||Math.abs(z)>30000000||Math.abs(worldY)>30000000)throw new IllegalArgumentException("Coordinates exceed native inspection bounds");
        var column=terrain.getComplex().naturalTerrainColumn((int)Math.floor(x),(int)Math.floor(z));return column==null?0:column.isSolid((int)Math.floor(worldY)-terrain.getMinHeight())?2:1;
    }

    @JSExport public static void prepareRegionSelection(String dimensionKey,String decimalWorldSeed,boolean buffet){
        pack.open();pack.requireGenerationReady();IrisRegistrant resource=pack.load("dimensions",dimensionKey);if(!(resource instanceof IrisDimension dimension))throw new IllegalArgumentException("The selected native dimension could not be loaded");if(dimension.isCompatExcluded())throw new IllegalArgumentException("The native compatibility gate excluded this dimension: "+String.join("; ",pack.open().getCompatReport().detailLines()));
        supportedStyle(dimension.getRegionStyle(),0);long complexSeed=new SeedManager(Long.parseLong(decimalWorldSeed)).getComplex();selectedRegions=RegionSelection.restore(new RegionSelection.Snapshot(dimension,pack.open(),complexSeed,buffet));
    }
    @JSExport public static String biomeVariant(String key,String inferredType)throws java.io.IOException{
        pack.open();IrisRegistrant resource=pack.load("biomes",key);if(!(resource instanceof art.arcane.iris.generation.biome.IrisBiome biome))throw new IllegalArgumentException("Missing biome resource");var variant=biome.withInferredType(art.arcane.iris.generation.terrain.InferredType.valueOf(inferredType));java.io.StringWriter output=new java.io.StringWriter();try(JsonWriter writer=new JsonWriter(output)){writer.beginObject();writer.name("type").value(variant.getInferredType().name());writer.name("key").value(variant.getLoadKey());writer.name("config").jsonValue(NativeConfigWriter.toJson(variant));writer.endObject();}return output.toString();
    }
    @JSExport public static String roundTripNativeConfig(String type,String text)throws java.io.IOException{return NativeConfigWriter.toJson(NativeConfigReader.readConfig(type,text));}
    @JSExport public static String sampleRegion(double x,double z){if(selectedRegions==null)throw new IllegalStateException("Prepare the native region selection first");if(!Double.isFinite(x)||!Double.isFinite(z))throw new IllegalArgumentException("Region coordinates must be finite");IrisRegion region=selectedRegions.get(x,z);if(region==null)throw new IllegalStateException("The native region pool returned no region");return region.getLoadKey();}

    @JSExport public static String installRegistry(String text)throws java.io.IOException{
        if(pack.resourceCount()!=0)throw new IllegalStateException("Install the native registry before adding pack resources");
        BrowserRegistries installed=BrowserRegistries.read(text);pack.release();registry=installed;pack=new MemoryPack(registry);return "{\"blocks\":"+registry.typeCount()+",\"states\":"+registry.stateCount()+"}";
    }
    @JSExport public static String registryState(String text,boolean strict)throws java.io.IOException{if(registry==null)throw new IllegalStateException("Native registry is not installed");return registry.describe(text,strict);}
    @JSExport public static String registryRenderingState(String key)throws java.io.IOException{if(registry==null)throw new IllegalStateException("Native registry is not installed");return registry.describeRendering(key);}
    @JSExport public static boolean registryMatches(String first,String other){if(registry==null)throw new IllegalStateException("Native registry is not installed");return registry.decodeBlockState(first).matches(registry.decodeBlockState(other));}

    @JSExport public static void registerPackResource(String path,String text){pack.register(path,text);}
    @JSExport public static String openPack(){pack.open();return "{\"resources\":"+pack.resourceCount()+",\"compatibilityReady\":"+pack.compatibilityReady()+"}";}
    /** Authoring graph inspection; not a terrain preview or compatibility success claim. */
    @JSExport public static String inspectPackResource(String folder,String name)throws java.io.IOException{
        pack.open();IrisRegistrant resource=pack.load(folder,name);StringWriter output=new StringWriter();
        try(JsonWriter json=new JsonWriter(output)){json.beginObject();json.name("found").value(resource!=null);json.name("compatibilityReady").value(pack.compatibilityReady());if(resource!=null){json.name("key").value(resource.getLoadKey());json.name("type").value(resource.getTypeName());json.name("folder").value(resource.getFolderName());json.name("excluded").value(resource.isCompatExcluded());}json.name("findings").beginArray();for(String line:pack.open().getCompatReport().detailLines())json.value(line);json.endArray();json.endObject();}return output.toString();
    }

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
    public static void loadDimensionJson(String id, String text) throws java.io.IOException {
        if (dimensions.size() >= 16 && !dimensions.containsKey(id)) throw new IllegalArgumentException("Too many dimensions");
        IrisDimension dimension = NativeConfigReader.readIrisDimension(text);
        if (dimension == null) throw new IllegalArgumentException("Invalid dimension resource");
        supportedStyle(dimension.getContinentalStyle(), 0); supportedStyle(dimension.getRegionStyle(), 0);
        dimension.setLoadKey(id); dimensions.put(id, dimension); controls.clear();
    }
    @JSExport
    public static String sampleDimensionControl(String id, String decimalWorldSeed, String field, double x, double z) {
        IrisDimension dimension = dimensions.get(id); if (dimension == null) throw new IllegalArgumentException("Missing dimension");
        String key = id + ":" + decimalWorldSeed + ":" + field;
        ProceduralStream<Double> stream = controls.get(key);
        if (stream == null) {
            if (controls.size() >= 32) controls.remove(controls.keySet().iterator().next());
            SeedManager seeds = new SeedManager(Long.parseLong(decimalWorldSeed)); RNG complex = new RNG(seeds.getComplex());
            stream = switch (field) {
                case "iris-continent" -> ContinentGenerator.create(dimension, complex, null).stream();
                case "iris-region-control" -> dimension.getRegionStyle().create(complex.nextParallelRNG(883), null).stream().zoom(dimension.getRegionZoom());
                default -> throw new IllegalArgumentException("Unsupported dimension control field");
            };
            controls.put(key, stream);
        }
        return bits(stream.getDouble(x,z));
    }

    @JSExport
    public static void registerSnippet(String path, String text) { NativeConfigReader.register(path, text); }

    private static void supportedStyle(IrisGeneratorStyle style, int depth) {
        if (depth > 32) throw new IllegalArgumentException("Style fracture exceeds the supported loading budget");
        if (style == null) return;
        if (style.getExpression() != null || style.getImageMap() != null || style.getCacheSize() != 0)
            throw UnsupportedPlatform.unavailable("Resource expressions, image maps and persistent float caches");
        supportedStyle(style.getFracture(), depth + 1);
    }
    private static void supportedLayer(IrisNoiseGenerator layer, int depth) {
        if (layer == null || depth > 32) throw new IllegalArgumentException("Invalid or excessively nested noise layer");
        supportedStyle(layer.getStyle(), 0);
        if (layer.getFracture() == null) throw new IllegalArgumentException("Layer fracture must be an array");
        for (IrisNoiseGenerator child : layer.getFracture()) supportedLayer(child, depth + 1);
    }
    @JSExport
    public static void loadGeneratorJson(String id, String text) throws java.io.IOException {
        if (composites.size() >= 64 && !composites.containsKey(id)) throw new IllegalArgumentException("Too many generators");
        IrisGenerator generator = NativeConfigReader.readIrisGenerator(text);
        if (generator == null || generator.getComposite() == null) throw new IllegalArgumentException("Invalid generator resource");
        for (IrisNoiseGenerator layer : generator.getComposite()) supportedLayer(layer, 0);
        supportedLayer(generator.getCliffHeightGenerator(), 0);
        generator.setLoadKey(id); composites.put(id, generator);
    }
    @JSExport
    public static void loadStyleJson(String id, String text) throws java.io.IOException {
        if (loadedStyles.size() >= 256 && !loadedStyles.containsKey(id)) throw new IllegalArgumentException("Too many styles");
        IrisGeneratorStyle style = NativeConfigReader.readIrisGeneratorStyle(text);
        if (style == null) throw new IllegalArgumentException("Invalid style or missing snippet");
        supportedStyle(style, 0); loadedStyles.put(id, style); generators.clear();
    }
    @JSExport
    public static String sampleLoadedStyle(String id, String decimalSeed, double x, double y, double z, int dimensions) {
        IrisGeneratorStyle style = loadedStyles.get(id); if (style == null) throw new IllegalArgumentException("Missing loaded style");
        long seed = Long.parseLong(decimalSeed);
        return bits(sample(cached("loaded:" + id + ":" + decimalSeed, () -> style.createForLayer(new RNG(seed), null, 1)), x, y, z, dimensions));
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
    public static void clear() {terrain=null; selectedRegions=null;pack.release();pack=new MemoryPack(registry);definitions.clear(); generators.clear(); layers.clear(); composites.clear(); loadedStyles.clear(); dimensions.clear(); controls.clear(); NativeConfigReader.clear(); }
    public static void main(String[] args) { }
}
