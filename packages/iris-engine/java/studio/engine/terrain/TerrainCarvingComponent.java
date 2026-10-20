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
        return paint(engine,x,z,false);
    }
    public static String paint(BrowserTerrainEngine engine,int x,int z,boolean post)throws IOException {
        return paint(engine,x,z,post,false);
    }
    public static String paint(BrowserTerrainEngine engine,int x,int z,boolean post,boolean floating)throws IOException {
        if(floating&&!post)throw new IllegalArgumentException("Floating solids require the native post-stage prefix");
        if(post&&!engine.getDimension().getMode().getType().name().equals("OVERWORLD"))throw studio.engine.UnsupportedPlatform.unavailable("Post-stage preview outside the native Overworld mode");
        int height=engine.getHeight();if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999968||Math.abs((long)z)>29999968||height<16||height>4096||(height&15)!=0)throw new IllegalArgumentException("Carving component window exceeds worker bounds");
        WorkerCaveStorage.requireNoSubterrain(null,x>>4,z>>4,engine.getComplex());
        int cx=x>>4,cz=z>>4;WorkerCaveStorage.begin(height,cx,cz);
        try {
            MantleCarvingComponent carving=new MantleCarvingComponent(engine.getMantle());
            for(int[] offset:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}){int chunkX=cx+offset[0],chunkZ=cz+offset[1];WorkerCaveStorage.select(chunkX,chunkZ);carving.generateLayer(null,chunkX,chunkZ,new ChunkContext(chunkX<<4,chunkZ<<4,engine.getComplex(),false));}
            WorkerCaveStorage.select(cx,cz);
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
            new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
            new IrisCarveModifier(engine).onModify(cx,cz,blocks,false,context);
            if(post)new art.arcane.iris.generation.stage.IrisPostModifier(engine).onModify(x,z,blocks,false,context);
            if(floating)new art.arcane.iris.generation.stage.IrisFloatingChildBiomeModifier(engine).onModify(x,z,blocks,false,context);
            return TerrainPaintStage.serialize(engine,x,z,blocks,floating?"native-overworld-floating-material-stage-development":post?"native-overworld-post-material-stage-development":"native-carving-component-material-stage-development");
        } finally {if(floating)art.arcane.iris.generation.biome.FloatingIslandSample.clearThreadCaches();WorkerCaveStorage.clear();}
    }
}
