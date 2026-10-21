// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.context.IrisContext;
import art.arcane.iris.generation.mode.*;
import art.arcane.iris.generation.runtime.EngineMode;
import art.arcane.iris.generation.runtime.EngineStage;
import art.arcane.iris.generation.runtime.GenerationSessionException;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.*;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import java.io.IOException;

/** Runs the original registered prefix or mode generation entry for the three terrain/biome-only modes. */
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
        EngineStage registeredTerrainStage=null;
        try {
            if(!mode.getStages().isEmpty())throw new IllegalStateException("Pinned terrain-only mode acquired content stages");
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());
            ArrayHunk<NativeBiome> biomes=new ArrayHunk<>(16,height,16);
            long sessionId=engine.getGenerationSessionId();
            IrisContext previous=IrisContext.get();ChunkContext[] observed={null};
            try {
                if(generate){
                    if(mode.getTerrainStages().size()!=1)throw new IllegalStateException("Pinned simple-mode stage registration changed");
                    // Observe the native context without changing stage inputs, writes or registration order.
                    EngineStage original=mode.getTerrainStages().get(0);registeredTerrainStage=original;
                    mode.getTerrainStages().set(0,(bx,bz,b,p,m,c)->{
                        if(observed[0]!=null||!c.isNaturalTerrain()||IrisContext.require().getChunkContext()!=c)throw new IllegalStateException("Native mode context is not in its scoped terrain phase");
                        observed[0]=c;original.generate(bx,bz,b,p,m,c);
                    });
                    try(var lease=engine.acquireGenerationLease("browser_mode_generate")){
                        sessionId=lease.sessionId();mode.generate(x,z,blocks,biomes,false,sessionId);
                        if(observed[0]==null||observed[0].isNaturalTerrain()||observed[0].getGenerationSessionId()!=sessionId)throw new IllegalStateException("Native mode did not finish its content phase");
                    }catch(GenerationSessionException failure){throw new IOException("Native mode generation session failed",failure);}
                }else{
                    ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
                    try(var scope=IrisContext.open(engine,sessionId,context)){mode.generateTerrain(x,z,blocks,biomes,false,context);}
                }
            }finally{if(IrisContext.get()!=previous)throw new IllegalStateException("Native mode did not restore its execution scope");}
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,generate?"native-mode-generation-development":"native-terrain-mode-stage-development",biomes);
            return result.substring(0,result.length()-1)+",\"mode\":\""+engine.getDimension().getMode().getType().name()+"\",\"registeredTerrainStages\":"+mode.getTerrainStages().size()+",\"registeredContentStages\":"+mode.getStages().size()+",\"modeGeneration\":"+generate+",\"nativeContentPhase\":"+generate+",\"scopeRestored\":true,\"generationSessionId\":\""+sessionId+"\",\"activeLeasesAfter\":"+engine.getGenerationSessions().activeLeases()+"}";
        } finally {if(registeredTerrainStage!=null)mode.getTerrainStages().set(0,registeredTerrainStage);mode.close();}
    }
}
