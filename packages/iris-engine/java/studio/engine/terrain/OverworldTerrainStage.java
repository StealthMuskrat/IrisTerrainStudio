// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.runtime.*;
import art.arcane.iris.generation.context.*;
import art.arcane.iris.generation.mode.ModeOverworld;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.*;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import java.io.IOException;

/** Original Overworld terrain registration and native terrain-matter phase in bounded owned storage. */
public final class OverworldTerrainStage {
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException{return execute(engine,x,z,false);}
    public static String generate(BrowserTerrainEngine engine,int x,int z)throws IOException{return execute(engine,x,z,true);}
    private static String execute(BrowserTerrainEngine engine,int x,int z,boolean generate)throws IOException{
        int height=engine.getHeight();
        if(!engine.getDimension().getMode().getType().name().equals("OVERWORLD"))throw studio.engine.UnsupportedPlatform.unavailable("Overworld terrain registration requires an Overworld dimension");
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999936||Math.abs((long)z)>29999936||height<16||height>4096||(height&15)!=0||(long)height*256*49>8388608)throw new IllegalArgumentException("Native Overworld terrain window exceeds worker bounds");
        WorkerProceduralMap.begin();int cx=x>>4,cz=z>>4;boolean runtimeBound=false,matterBound=false;
        ModeOverworld mode=null;IrisEngineMantle host=null;IrisContext previous=IrisContext.get();
        RegisteredModeObserver observer=null;art.arcane.iris.generation.mantle.WorkerObjectSession.Pass objectPass=null;
        try{
            WorkerMatterRuntime.begin(engine);runtimeBound=true;
            // Native radius planning may bake procedural variants; retain existing admission limits.
            ProceduralSourcePreview.validate(engine);
            if(!engine.getDimension().getStructures().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported structures in native terrain planning");
            for(var region:engine.getDimension().getAllRegions(engine::getData))if(!region.getStructures().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported region structures in native terrain planning");
            for(var biome:engine.getDimension().getReachableBiomes(engine::getData))if(!biome.getStructures().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported biome structures in native terrain planning");
            for(var biome:engine.getDimension().getReachableBiomes(engine::getData))for(var entry:biome.getFloatingChildBiomes()){
                var target=entry.getRealBiome(biome,engine.getData());
                if(target==null||!entry.getFloatingObjects().isEmpty()||!entry.getExtraObjects().isEmpty()||!entry.resolveTopObjects(target).isEmpty()||!entry.resolveBottomObjects(target).isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported floating object placements in native mode generation");
            }
            host=new IrisEngineMantle(engine,(java.nio.file.Path)null);engine.bindNativeMatter(host);matterBound=true;
            var passes=host.getComponents();for(var pass:passes)if(pass.passChunkRadius()>3)throw studio.engine.UnsupportedPlatform.unavailable("Native terrain pass exceeds its bounded prepared window");
            if(generate)objectPass=engine.objectSession().begin(engine);
            WorkerCaveStorage.begin(height,cx,cz,49);for(int dx=-3;dx<=3;dx++)for(int dz=-3;dz<=3;dz++)WorkerCaveStorage.select(cx+dx,cz+dz);WorkerCaveStorage.select(cx,cz);
            mode=new ModeOverworld(engine);if(mode.getTerrainStages().size()!=4||mode.getStages().size()!=9)throw new IllegalStateException("Pinned Overworld stage registration changed");
            var blocks=new ArrayHunk<NativeBlockState>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());var biomes=new ArrayHunk<NativeBiome>(16,height,16);
            try(var lease=engine.acquireGenerationLease("browser_overworld_terrain")){
                if(generate){
                    observer=new RegisteredModeObserver(mode,engine,lease.sessionId());
                    mode.generate(x,z,blocks,biomes,false,lease.sessionId());observer.verify(4,9);
                }else{
                    var context=new ChunkContext(x,z,engine.getComplex(),lease.sessionId(),true,ChunkContext.PrefillPlan.NO_CAVE,engine.getMetrics());
                    try(var scope=IrisContext.open(engine,lease.sessionId(),context)){mode.generateTerrain(x,z,blocks,biomes,false,context);if(!context.isNaturalTerrain())throw new IllegalStateException("Overworld terrain prefix entered content phase");}
                }
            }catch(GenerationSessionException failure){throw new IOException("Native terrain-matter session failed",failure);}
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,generate?"native-overworld-mode-generation-development":"native-overworld-registered-terrain-development",biomes);
            String metadata=",\"registeredTerrainStages\":4,\"registeredContentStages\":9,\"executedTerrainStages\":4,\"executedContentStages\":"+(generate?9:0)+",\"nativeContentPhase\":"+generate+",\"maximumWriterAccess\":"+WorkerMatterRuntime.maximumAccess()+",\"matterWindow\":"+WorkerCaveStorage.flagWindow()+",\"activeLeasesAfter\":"+engine.getGenerationSessions().activeLeases();
            if(generate){
                WorkerCaveStorage.retainContinuations(engine.objectSession().continuations(engine),engine);
                metadata+=",\"componentFlags\":"+WorkerCaveStorage.componentFlags()+",\"journaledCells\":"+WorkerCaveStorage.journalCellCount()+",\"objectTags\":"+WorkerCaveStorage.objectTags()+",\"cache\":"+engine.objectSession().statistics(engine)+",\"caveSearch\":"+WorkerProceduralMap.caveSearchStatistics();
                objectPass.commit();
            }
            return result.substring(0,result.length()-1)+metadata+"}";
        }finally{try{if(observer!=null)observer.close();if(mode!=null)mode.close();}finally{try{if(objectPass!=null)objectPass.close();}finally{if(matterBound)engine.unbindNativeMatter(host);art.arcane.iris.generation.biome.FloatingIslandSample.clearThreadCaches();WorkerCaveStorage.clear();if(runtimeBound)WorkerMatterRuntime.end();WorkerProceduralMap.end();if(IrisContext.get()!=previous)throw new IllegalStateException("Overworld terrain did not restore its execution scope");}}}
    }
}
