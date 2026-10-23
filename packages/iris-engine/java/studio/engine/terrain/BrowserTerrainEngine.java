// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.runtime.*;
import art.arcane.iris.generation.terrain.*;
import art.arcane.iris.generation.biome.IrisBiome;
import art.arcane.iris.pack.loading.IrisData;

/** Worker-owned runtime state. Native IrisComplex owns all biome and height algorithms. */
public final class BrowserTerrainEngine extends EngineBoundary {
    private final IrisDimension dimension;
    private final boolean studioEnabled;
    private final IrisData data;
    private final SeedManager seeds;
    private final GenerationSessionManager sessions=new GenerationSessionManager();
    private final EngineMetrics metrics=new EngineMetrics(16);
    private art.arcane.iris.generation.mantle.EngineMantle nativeMatter;
    private final WorkerCarvingMantle mantle=new WorkerCarvingMantle(this);
    private final art.arcane.iris.world.IrisWorld world;
    private IrisComplex complex;
    private DimensionStackContext stack;
    private UpperDimensionContext upper;
    private art.arcane.iris.generation.mantle.WorkerObjectSession objectSession,nativeObjectSession;private boolean closed;
    public art.arcane.iris.generation.mantle.WorkerObjectSession objectSession(){return objectSession(nativeMatter!=null);}
    public art.arcane.iris.generation.mantle.WorkerObjectSession objectSession(boolean registeredMode){
        if(closed)throw new IllegalStateException("Terrain context is closed");
        if(registeredMode){if(nativeObjectSession==null)nativeObjectSession=new art.arcane.iris.generation.mantle.WorkerObjectSession(this);return nativeObjectSession;}
        if(objectSession==null)objectSession=new art.arcane.iris.generation.mantle.WorkerObjectSession(this);return objectSession;
    }
    public void release(){
        if(closed)return;closed=true;
        try{sessions.sealAndAwait("browser snapshot release",0,true);}
        catch(GenerationSessionException failure){throw new IllegalStateException("Worker generation leases did not drain",failure);}
        finally{
            try{if(complex!=null)complex.close();}
            finally{
                complex=null;stack=null;upper=null;nativeMatter=null;
                try{data.unregisterEngine(this);}
                finally{try{if(objectSession!=null)objectSession.close();}finally{objectSession=null;try{if(nativeObjectSession!=null)nativeObjectSession.close();}finally{nativeObjectSession=null;studio.engine.biome.WorkerCustomBiomes.clear();}}}
            }
        }
    }
    public BrowserTerrainEngine(IrisDimension dimension,IrisData data,long seed,art.arcane.iris.spi.PlatformRegistries registry){this(dimension,data,seed,registry,false);}
    public BrowserTerrainEngine(IrisDimension dimension,IrisData data,long seed,art.arcane.iris.spi.PlatformRegistries registry,boolean studioLayout){
        this.studioEnabled=studioLayout;this.dimension=dimension;this.data=data;seeds=new SeedManager(seed);
        admitHeight(dimension);
        if(studioLayout&&dimension.getStudioMode()==null)throw new IllegalArgumentException("Studio layout requires a native studio mode");
        if(studioLayout&&(dimension.hasDimensionStack()||dimension.hasUpperDimension()))throw studio.engine.UnsupportedPlatform.unavailable("Studio layout with upper/stack dimensions");
        if(studioLayout&&dimension.getStudioMode()==art.arcane.iris.studio.StudioMode.OBJECT_BUFFET)throw studio.engine.UnsupportedPlatform.unavailable("Object studio layout; select a native biome buffet or normal mode");
        if(dimension.hasDimensionStack()&&(dimension.getDimensionStack().getDimensions()==null||dimension.getDimensionStack().getDimensions().size()>16))throw new IllegalArgumentException("Dimension stack exceeds its sixteen-layer worker budget");
        world=art.arcane.iris.world.IrisWorld.builder().minHeight(dimension.getMinHeight()).maxHeight(dimension.getMaxHeight()).seed(seed).build();
        WorkerTerrainPlatform.install(registry);
        if(!(registry instanceof studio.engine.registry.BrowserRegistries owned))throw new IllegalArgumentException("Terrain requires an owned browser registry");
        studio.engine.biome.WorkerCustomBiomes.begin(owned,data);
        try{
            studio.engine.biome.WorkerCustomBiomes.prepare(dimension);
            if(dimension.hasDimensionStack())for(String key:dimension.getDimensionStack().getDimensions())if(key!=null&&!key.isBlank()){
                IrisDimension layer=key.equals(dimension.getLoadKey())?dimension:data.getDimensionLoader().load(key);if(layer!=null){admitHeight(layer);studio.engine.biome.WorkerCustomBiomes.prepare(layer);}
            }
            if(dimension.hasUpperDimension()&&!dimension.getUpperDimension().equals(dimension.getLoadKey())){
                IrisDimension layer=data.getDimensionLoader().load(dimension.getUpperDimension(),false);if(layer!=null){admitHeight(layer);studio.engine.biome.WorkerCustomBiomes.prepare(layer);}
            }
            complex=new IrisComplex(this);
            // Same native assembly order as EngineRuntimeBuilder. Only the concrete host type differs.
            var kernel=new NativeLayerKernel();stack=kernel.createDimensionStackContext(this);upper=kernel.createUpperContext(this);
            data.registerEngine(this);
        }
        catch(RuntimeException|Error failure){try{release();}catch(RuntimeException|Error cleanup){failure.addSuppressed(cleanup);}throw failure;}
    }
    public void bindNativeMatter(art.arcane.iris.generation.mantle.EngineMantle host){if(nativeMatter!=null||host.getEngine()!=this||closed)throw new IllegalStateException("Native matter host ownership mismatch");nativeMatter=host;}
    public void unbindNativeMatter(art.arcane.iris.generation.mantle.EngineMantle host){if(nativeMatter!=host)throw new IllegalStateException("Native matter host ownership mismatch");nativeMatter=null;}
    @Override public GenerationSessionManager getGenerationSessions(){return sessions;}
    @Override public IrisDimension getDimension(){return dimension;}
    @Override public IrisData getData(){return data;}
    @Override public SeedManager getSeedManager(){return seeds;}
    @Override public IrisComplex getComplex(){if(closed)throw new IllegalStateException("Terrain context is closed");return complex;}
    @Override public int getMinHeight(){return dimension.getMinHeight();}
    @Override public int getMaxHeight(){return dimension.getMaxHeight();}
    @Override public int getHeight(){return getMaxHeight()-getMinHeight();}
    @Override public EngineMetrics getMetrics(){return metrics;}
    @Override public art.arcane.iris.generation.mantle.EngineMantle getMantle(){return nativeMatter==null?mantle:nativeMatter;}
    @Override public art.arcane.iris.world.IrisWorld getWorld(){return world;}
    @Override public EnginePlatformHooks getPlatformHooks(){return new EnginePlatformHooks(){};}
    @Override public boolean isStudio(){return studioEnabled;}
    @Override public boolean isClosed(){return closed;}
    @Override public int getCacheID(){return System.identityHashCode(this);}
    @Override public UpperDimensionContext getUpperContext(){return upper;}
    @Override public DimensionStackContext getDimensionStackContext(){return stack;}
    public boolean layered(){return upper!=null||stack!=null;}
    private static void admitHeight(IrisDimension dimension){long height=(long)dimension.getMaxHeight()-dimension.getMinHeight();if(height<1||height>4096)throw new IllegalArgumentException("Dimension height exceeds the worker's 1–4096 block budget");}
    public void registerLayerStages(EngineMode mode){new NativeLayerKernel().registerDimensionStack(this,mode,stack);}
    public art.arcane.iris.generation.context.ChunkContext chunkContext(int x,int z){return new art.arcane.iris.generation.context.ChunkContext(x,z,getComplex(),getGenerationSessionId(),false,art.arcane.iris.generation.context.ChunkContext.PrefillPlan.NO_CAVE,metrics,stack);}
    @Override public IrisBiome getFocus(){String key=dimension.getFocus();if(key==null||key.trim().isEmpty())return null;IrisBiome biome=data.getBiomeLoader().load(key);return biome==null||biome.isCompatExcluded()?null:biome;}
    @Override public IrisRegion getFocusRegion(){String key=dimension.getFocusRegion();if(key==null||key.trim().isEmpty())return null;IrisRegion region=data.getRegionLoader().load(key);return region==null||region.isCompatExcluded()?null:region;}
}
