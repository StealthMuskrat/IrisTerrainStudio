// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.context.IrisContext;
import art.arcane.iris.generation.mode.*;
import art.arcane.iris.generation.runtime.EngineMode;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.*;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import java.io.IOException;

/** Runs the original registered terrain stages for the three terrain/biome-only modes. */
public final class TerrainModeStage {
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException {
        int height=engine.getHeight();
        if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999984||Math.abs((long)z)>29999984||height<1||height>4096)throw new IllegalArgumentException("Native mode stage exceeds worker chunk bounds");
        EngineMode mode=switch(engine.getDimension().getMode().getType()){
            case SUPERFLAT->new ModeSuperFlat(engine);
            case ENCLOSURE->new ModeEnclosure(engine);
            case ISLANDS->new ModeIslands(engine);
            default->throw studio.engine.UnsupportedPlatform.unavailable("Overworld mode requires the unfinished full Mantle/content lifecycle; choose a connected stage preview");
        };
        try {
            if(!mode.getStages().isEmpty())throw new IllegalStateException("Pinned terrain-only mode acquired content stages");
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());
            ArrayHunk<NativeBiome> biomes=new ArrayHunk<>(16,height,16);
            ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
            try(var scope=IrisContext.open(engine,engine.getGenerationSessionId(),context)){
                mode.generateTerrain(x,z,blocks,biomes,false,context);
            }
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,"native-terrain-mode-stage-development",biomes);
            return result.substring(0,result.length()-1)+",\"mode\":\""+engine.getDimension().getMode().getType().name()+"\",\"registeredTerrainStages\":"+mode.getTerrainStages().size()+",\"registeredContentStages\":"+mode.getStages().size()+"}";
        } finally {mode.close();}
    }
}
