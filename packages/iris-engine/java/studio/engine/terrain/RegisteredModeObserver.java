// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.context.*;
import art.arcane.iris.generation.runtime.*;
import java.util.*;

/** Non-writing observation; original stage objects are restored before native mode close. */
public final class RegisteredModeObserver implements AutoCloseable {
    private final EngineMode mode;private final Engine engine;private final long session;
    private final List<EngineStage> terrain,content;private ChunkContext context;
    private int terrainCount,contentCount;
    public RegisteredModeObserver(EngineMode mode,Engine engine,long session){
        this.mode=mode;this.engine=engine;this.session=session;
        terrain=new ArrayList<>(mode.getTerrainStages());content=new ArrayList<>(mode.getStages());
        for(int i=0;i<terrain.size();i++)mode.getTerrainStages().set(i,observe(terrain.get(i),i,true));
        for(int i=0;i<content.size();i++)mode.getStages().set(i,observe(content.get(i),i,false));
    }
    private EngineStage observe(EngineStage original,int index,boolean natural){return (x,z,blocks,biomes,multicore,ctx)->{
        if(ctx.getGenerationSessionId()!=session||ctx.isNaturalTerrain()!=natural||IrisContext.require().getEngine()!=engine||IrisContext.require().getChunkContext()!=ctx||context!=null&&context!=ctx)throw new IllegalStateException("Native registered mode lost its phase, session or scoped context");
        context=ctx;if(natural){if(terrainCount++!=index)throw new IllegalStateException("Native terrain stage ordering changed");}else if(contentCount++!=index)throw new IllegalStateException("Native content stage ordering changed");
        original.generate(x,z,blocks,biomes,multicore,ctx);
    };}
    public void verify(int expectedTerrain,int expectedContent){if(terrainCount!=expectedTerrain||contentCount!=expectedContent||context==null||context.isNaturalTerrain())throw new IllegalStateException("Native mode did not finish registered content");}
    @Override public void close(){for(int i=0;i<terrain.size();i++)mode.getTerrainStages().set(i,terrain.get(i));for(int i=0;i<content.size();i++)mode.getStages().set(i,content.get(i));}
}
