// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.mantle.IrisCaveCarver3D;
import art.arcane.iris.generation.context.ChunkContext;
import art.arcane.iris.generation.stage.IrisCarveModifier;
import art.arcane.iris.generation.stage.IrisTerrainNormalActuator;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.hunk.storage.ArrayHunk;
import java.io.IOException;

/** Native paint and carve-modifier stages with a dimension-profile-only marker window. */
public final class TerrainCaveMaterials {
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException {
        int height=engine.getHeight();if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999968||Math.abs((long)z)>29999968||height<16||height>4096||(height&15)!=0)throw new IllegalArgumentException("Cave material window exceeds worker bounds");
        var profile=engine.getDimension().getCaveProfile();if(profile==null||!profile.isEnabled())throw new IllegalArgumentException("The dimension cave profile is disabled");
        if(!engine.getComplex().getSubterrainPlanner().isEmpty())throw studio.engine.UnsupportedPlatform.unavailable("Subterrain material generation in the dimension cave stage");
        int cx=x>>4,cz=z>>4;WorkerCaveStorage.begin(height,cx,cz);
        try {
            IrisCaveCarver3D carver=new IrisCaveCarver3D(engine,profile);
            for(int[] offset:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}){
                int chunkX=cx+offset[0],chunkZ=cz+offset[1],bx=chunkX<<4,bz=chunkZ<<4;WorkerCaveStorage.select(chunkX,chunkZ);
                int[] surface=new int[256];for(int lx=0;lx<16;lx++)for(int lz=0;lz<16;lz++)surface[(lx<<4)|lz]=engine.getComplex().naturalTrueHeight(bx+lx,bz+lz);
                carver.carve(null,chunkX,chunkZ,null,0D,0D,null,surface);
            }
            WorkerCaveStorage.select(cx,cz);
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());
            ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
            var biomes=TerrainBiomeStage.paint(engine,x,z,context);
            new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
            new IrisCarveModifier(engine).onModify(cx,cz,blocks,false,context);
            return TerrainPaintStage.serialize(engine,x,z,blocks,"native-dimension-cave-material-stage-development",biomes);
        } finally {WorkerCaveStorage.clear();}
    }
}
