// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.mantle.MantleCarvingComponent;
import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.stage.IrisCarveModifier;
import art.arcane.iris.generation.stage.IrisTerrainNormalActuator;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import java.io.IOException;

/** Original profile blending, configured carving bands, surface-fluid protection and orphan sweep. */
public final class TerrainCarvingComponent {
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException {
        int height=engine.getHeight();if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999968||Math.abs((long)z)>29999968||height<16||height>4096||(height&15)!=0)throw new IllegalArgumentException("Carving component window exceeds worker bounds");
        WorkerCaveStorage.requireNoSubterrain(null,x>>4,z>>4,engine.getComplex());
        int cx=x>>4,cz=z>>4;WorkerCaveStorage.begin(height,cx,cz);
        try {
            MantleCarvingComponent carving=new MantleCarvingComponent(new WorkerCarvingMantle(engine));
            for(int[] offset:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}){int chunkX=cx+offset[0],chunkZ=cz+offset[1];WorkerCaveStorage.select(chunkX,chunkZ);carving.generateLayer(null,chunkX,chunkZ,new ChunkContext(chunkX<<4,chunkZ<<4,engine.getComplex(),false));}
            WorkerCaveStorage.select(cx,cz);
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
            new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
            new IrisCarveModifier(engine).onModify(cx,cz,blocks,false,context);
            return TerrainPaintStage.serialize(engine,x,z,blocks,"native-carving-component-material-stage-development");
        } finally {WorkerCaveStorage.clear();}
    }
}
