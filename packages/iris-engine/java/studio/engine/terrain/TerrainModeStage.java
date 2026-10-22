// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.context.IrisContext;
import art.arcane.iris.generation.mode.*;
import art.arcane.iris.generation.runtime.EngineMode;
import art.arcane.iris.generation.runtime.GenerationSessionException;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.*;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import java.io.IOException;

/** Runs the original registered prefix or mode generation entry for the three configured simple modes and their native dimension-stack stages. */
public final class TerrainModeStage {
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException {return paint(engine,x,z,false);}
    public static String generate(BrowserTerrainEngine engine,int x,int z)throws IOException {return paint(engine,x,z,true);}
    private static String paint(BrowserTerrainEngine engine,int x,int z,boolean generate)throws IOException {
        int height=engine.getHeight();
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984||height<1||height>4096)throw new IllegalArgumentException("Native mode stage exceeds worker chunk bounds");
        EngineMode mode=switch(engine.getDimension().getMode().getType()){
            case SUPERFLAT->new ModeSuperFlat(engine);
            case ENCLOSURE->new ModeEnclosure(engine);
            case ISLANDS->new ModeIslands(engine);
            default->throw studio.engine.UnsupportedPlatform.unavailable("Overworld mode requires the unfinished full Mantle/content lifecycle; choose a connected stage preview");
        };
        boolean stacked=engine.getDimensionStackContext()!=null,storage=false;
        int expectedTerrain=stacked?2:1,expectedContent=stacked?1:0;
        RegisteredModeObserver observer=null;
        try {
            engine.registerLayerStages(mode);
            if(mode.getTerrainStages().size()!=expectedTerrain||mode.getStages().size()!=expectedContent)throw new IllegalStateException("Pinned simple-mode stage registration changed");
            if(stacked){WorkerCaveStorage.begin(height,x>>4,z>>4);storage=true;}
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());
            ArrayHunk<NativeBiome> biomes=new ArrayHunk<>(16,height,16);
            long sessionId=engine.getGenerationSessionId();
            IrisContext previous=IrisContext.get();
            try {
                if(generate){
                    try(var lease=engine.acquireGenerationLease("browser_mode_generate")){
                        sessionId=lease.sessionId();observer=new RegisteredModeObserver(mode,engine,sessionId);
                        mode.generate(x,z,blocks,biomes,false,sessionId);observer.verify(expectedTerrain,expectedContent);
                    }catch(GenerationSessionException failure){throw new IOException("Native mode generation session failed",failure);}
                }else{
                    ChunkContext context=engine.chunkContext(x,z);
                    try(var scope=IrisContext.open(engine,sessionId,context)){mode.generateTerrain(x,z,blocks,biomes,false,context);}
                }
            }finally{if(IrisContext.get()!=previous)throw new IllegalStateException("Native mode did not restore its execution scope");}
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,generate?"native-mode-generation-development":"native-terrain-mode-stage-development",biomes);
            return result.substring(0,result.length()-1)+",\"mode\":\""+engine.getDimension().getMode().getType().name()+"\",\"registeredTerrainStages\":"+mode.getTerrainStages().size()+",\"registeredContentStages\":"+mode.getStages().size()+",\"modeGeneration\":"+generate+",\"nativeContentPhase\":"+generate+",\"scopeRestored\":true,\"generationSessionId\":\""+sessionId+"\",\"activeLeasesAfter\":"+engine.getGenerationSessions().activeLeases()+"}";
        } finally {try{if(observer!=null)observer.close();mode.close();}finally{if(storage)WorkerCaveStorage.clear();}}
    }
}
