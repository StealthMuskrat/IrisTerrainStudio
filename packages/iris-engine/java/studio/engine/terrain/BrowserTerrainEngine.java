// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.runtime.*;
import art.arcane.iris.generation.terrain.*;
import art.arcane.iris.generation.biome.IrisBiome;
import art.arcane.iris.pack.loading.IrisData;

/** Worker-owned runtime state. Native IrisComplex owns all biome and height algorithms. */
public final class BrowserTerrainEngine extends EngineBoundary {
    private final IrisDimension dimension;
    private final IrisData data;
    private final SeedManager seeds;
    private final EngineMetrics metrics=new EngineMetrics(16);
    private final WorkerCarvingMantle mantle=new WorkerCarvingMantle(this);
    private final art.arcane.iris.world.IrisWorld world;
    private IrisComplex complex;
    private art.arcane.iris.generation.mantle.WorkerObjectSession objectSession;private boolean closed;
    public art.arcane.iris.generation.mantle.WorkerObjectSession objectSession(){if(closed)throw new IllegalStateException("Terrain context is closed");if(objectSession==null)objectSession=new art.arcane.iris.generation.mantle.WorkerObjectSession(this);return objectSession;}
    public void release(){if(closed)return;closed=true;if(objectSession!=null)objectSession.close();}
    public BrowserTerrainEngine(IrisDimension dimension,IrisData data,long seed,art.arcane.iris.spi.PlatformRegistries registry){
        if(dimension.hasUpperDimension()||dimension.hasDimensionStack())throw new UnsupportedOperationException("Upper dimensions and dimension stacks are not connected in the worker terrain runtime");
        this.dimension=dimension;this.data=data;seeds=new SeedManager(seed);
        world=art.arcane.iris.world.IrisWorld.builder().minHeight(dimension.getMinHeight()).maxHeight(dimension.getMaxHeight()).seed(seed).build();
        WorkerTerrainPlatform.install(registry);
        complex=new IrisComplex(this);
    }
    @Override public IrisDimension getDimension(){return dimension;}
    @Override public IrisData getData(){return data;}
    @Override public SeedManager getSeedManager(){return seeds;}
    @Override public IrisComplex getComplex(){return complex;}
    @Override public int getMinHeight(){return dimension.getMinHeight();}
    @Override public int getMaxHeight(){return dimension.getMaxHeight();}
    @Override public int getHeight(){return getMaxHeight()-getMinHeight();}
    @Override public EngineMetrics getMetrics(){return metrics;}
    @Override public art.arcane.iris.generation.mantle.EngineMantle getMantle(){return mantle;}
    @Override public art.arcane.iris.world.IrisWorld getWorld(){return world;}
    @Override public EnginePlatformHooks getPlatformHooks(){return new EnginePlatformHooks(){};}
    @Override public boolean isStudio(){return false;}
    @Override public boolean isClosed(){return closed;}
    @Override public int getCacheID(){return System.identityHashCode(this);}
    @Override public UpperDimensionContext getUpperContext(){return null;}
    @Override public IrisBiome getFocus(){String key=dimension.getFocus();if(key==null||key.trim().isEmpty())return null;IrisBiome biome=data.getBiomeLoader().load(key);return biome==null||biome.isCompatExcluded()?null:biome;}
    @Override public IrisRegion getFocusRegion(){String key=dimension.getFocusRegion();if(key==null||key.trim().isEmpty())return null;IrisRegion region=data.getRegionLoader().load(key);return region==null||region.isCompatExcluded()?null:region;}
}
