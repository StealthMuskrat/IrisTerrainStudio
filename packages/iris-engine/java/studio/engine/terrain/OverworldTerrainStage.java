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
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException{
        int height=engine.getHeight();
        if(!engine.getDimension().getMode().getType().name().equals("OVERWORLD"))throw studio.engine.UnsupportedPlatform.unavailable("Overworld terrain registration requires an Overworld dimension");
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999936||Math.abs((long)z)>29999936||height<16||height>4096||(height&15)!=0||(long)height*256*49>8388608)throw new IllegalArgumentException("Native Overworld terrain window exceeds worker bounds");
        WorkerProceduralMap.begin();int cx=x>>4,cz=z>>4;boolean runtimeBound=false,matterBound=false;
        ModeOverworld mode=null;IrisEngineMantle host=null;IrisContext previous=IrisContext.get();
        try{
            WorkerMatterRuntime.begin(engine);runtimeBound=true;
            // Native radius planning may bake procedural variants; retain existing admission limits.
            ProceduralSourcePreview.validate(engine);
            if(!engine.getDimension().getStructures().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported structures in native terrain planning");
            for(var region:engine.getDimension().getAllRegions(engine::getData))if(!region.getStructures().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported region structures in native terrain planning");
            for(var biome:engine.getDimension().getReachableBiomes(engine::getData))if(!biome.getStructures().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Imported biome structures in native terrain planning");
            host=new IrisEngineMantle(engine,(java.nio.file.Path)null);engine.bindNativeMatter(host);matterBound=true;
            var passes=host.getComponents();for(var pass:passes)if(pass.passChunkRadius()>3)throw studio.engine.UnsupportedPlatform.unavailable("Native terrain pass exceeds its bounded prepared window");
            WorkerCaveStorage.begin(height,cx,cz,49);for(int dx=-3;dx<=3;dx++)for(int dz=-3;dz<=3;dz++)WorkerCaveStorage.select(cx+dx,cz+dz);WorkerCaveStorage.select(cx,cz);
            mode=new ModeOverworld(engine);if(mode.getTerrainStages().size()!=4||mode.getStages().size()!=9)throw new IllegalStateException("Pinned Overworld stage registration changed");
            var blocks=new ArrayHunk<NativeBlockState>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());var biomes=new ArrayHunk<NativeBiome>(16,height,16);
            try(var lease=engine.acquireGenerationLease("browser_overworld_terrain")){
                var context=new ChunkContext(x,z,engine.getComplex(),lease.sessionId(),true,ChunkContext.PrefillPlan.NO_CAVE,engine.getMetrics());
                try(var scope=IrisContext.open(engine,lease.sessionId(),context)){mode.generateTerrain(x,z,blocks,biomes,false,context);if(!context.isNaturalTerrain())throw new IllegalStateException("Overworld terrain prefix entered content phase");}
            }catch(GenerationSessionException failure){throw new IOException("Native terrain-matter session failed",failure);}
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,"native-overworld-registered-terrain-development",biomes);
            return result.substring(0,result.length()-1)+",\"registeredTerrainStages\":4,\"registeredContentStages\":9,\"maximumWriterAccess\":"+WorkerMatterRuntime.maximumAccess()+",\"matterWindow\":"+WorkerCaveStorage.flagWindow()+",\"activeLeasesAfter\":"+engine.getGenerationSessions().activeLeases()+"}";
        }finally{try{if(mode!=null)mode.close();}finally{if(matterBound)engine.unbindNativeMatter(host);art.arcane.iris.generation.biome.FloatingIslandSample.clearThreadCaches();WorkerCaveStorage.clear();if(runtimeBound)WorkerMatterRuntime.end();WorkerProceduralMap.end();if(IrisContext.get()!=previous)throw new IllegalStateException("Overworld terrain prefix did not restore its execution scope");}}
    }
}
