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
    public enum Stage {
        CARVING("native-carving-component-material-stage-development"),
        POST("native-overworld-post-material-stage-development"),
        FLOATING("native-overworld-floating-material-stage-development"),
        CAVE_DECORATION("native-overworld-cave-decoration-stage-development"),
        DEPOSITS("native-overworld-deposit-material-stage-development"),
        MATERIAL_FINISH("native-overworld-material-finish-development");
        final String scope;Stage(String scope){this.scope=scope;}
    }
    public static String paint(BrowserTerrainEngine engine,int x,int z)throws IOException{return paint(engine,x,z,Stage.CARVING);}
    public static String paint(BrowserTerrainEngine engine,int x,int z,boolean post)throws IOException{return paint(engine,x,z,post?Stage.POST:Stage.CARVING);}
    public static String paint(BrowserTerrainEngine engine,int x,int z,boolean post,boolean floating)throws IOException{return paint(engine,x,z,post,floating,false);}
    public static String paint(BrowserTerrainEngine engine,int x,int z,boolean post,boolean floating,boolean decorate)throws IOException{
        if(decorate&&!floating||floating&&!post)throw new IllegalArgumentException("Native material stages require their preceding stages");
        return paint(engine,x,z,decorate?Stage.CAVE_DECORATION:floating?Stage.FLOATING:post?Stage.POST:Stage.CARVING);
    }
    public record Placement(art.arcane.iris.structure.object.IrisObject object,art.arcane.iris.structure.object.IrisObjectPlacement config,art.arcane.volmlib.util.math.RNG rng,boolean plausible){}
    public static String place(BrowserTerrainEngine engine,int x,int z,Placement placement)throws IOException{return paint(engine,x,z,Stage.MATERIAL_FINISH,placement);}
    public static String paint(BrowserTerrainEngine engine,int x,int z,Stage stage)throws IOException{return paint(engine,x,z,stage,null);}
    private static String paint(BrowserTerrainEngine engine,int x,int z,Stage stage,Placement placement)throws IOException {
        boolean post=stage.ordinal()>=Stage.POST.ordinal(),floating=stage.ordinal()>=Stage.FLOATING.ordinal(),decorate=stage.ordinal()>=Stage.CAVE_DECORATION.ordinal();
        if(post&&!engine.getDimension().getMode().getType().name().equals("OVERWORLD"))throw studio.engine.UnsupportedPlatform.unavailable("Material preview outside the native Overworld mode");
        int height=engine.getHeight();if((x&15)!=0||(z&15)!=0||Math.abs((long)x)>29999968||Math.abs((long)z)>29999968||height<16||height>4096||(height&15)!=0)throw new IllegalArgumentException("Carving component window exceeds worker bounds");
        WorkerCaveStorage.requireNoSubterrain(null,x>>4,z>>4,engine.getComplex());
        int cx=x>>4,cz=z>>4;WorkerCaveStorage.begin(height,cx,cz,placement==null?5:9);
        int placedY=-1;
        try {
            MantleCarvingComponent carving=new MantleCarvingComponent(engine.getMantle());
            for(int[] offset:placement==null?new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1},{-1,-1},{-1,1},{1,-1},{1,1}}){int chunkX=cx+offset[0],chunkZ=cz+offset[1];WorkerCaveStorage.select(chunkX,chunkZ);carving.generateLayer(null,chunkX,chunkZ,new ChunkContext(chunkX<<4,chunkZ<<4,engine.getComplex(),false));}
            WorkerCaveStorage.select(cx,cz);
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
            new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
            IrisCarveModifier cave=new IrisCarveModifier(engine);cave.onModify(cx,cz,blocks,false,context);
            if(post)new art.arcane.iris.generation.stage.IrisPostModifier(engine).onModify(x,z,blocks,false,context);
            var floatingModifier=floating?new art.arcane.iris.generation.stage.IrisFloatingChildBiomeModifier(engine):null;
            if(floating)floatingModifier.onModify(x,z,blocks,false,context);
            if(decorate)cave.decorateNaturalCaves(x,z,blocks,context);
            if(placement!=null)placedY=art.arcane.iris.generation.mantle.WorkerObjectTransactions.place(engine.getMantle(),placement.object(),placement.config(),placement.rng(),placement.plausible(),x+8,z+8,context);
            if(stage.ordinal()>=Stage.DEPOSITS.ordinal()){
                new art.arcane.iris.generation.stage.IrisDepositModifier(engine).onModify(x,z,blocks,false,context);
                engine.getMantle().insertMatter(cx,cz,blocks,false,context);
            }
            if(stage==Stage.MATERIAL_FINISH){
                new art.arcane.iris.generation.stage.IrisDecorantActuator(engine).onActuate(x,z,blocks,false,context);
                floatingModifier.decorateColumns(x,z,blocks,false,context);
                new art.arcane.iris.generation.stage.IrisPerfectionModifier(engine).onModify(x,z,blocks,false,context);
            }
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,placement==null?stage.scope:"native-procedural-placement-development");
            if(placement!=null)result=result.substring(0,result.length()-1)+",\"placedY\":"+placedY+",\"journaledCells\":"+WorkerCaveStorage.journalCellCount()+"}";
            return decorate?result.substring(0,result.length()-1)+",\"markers\":"+WorkerCaveStorage.markerEntries()+"}":result;
        } finally {if(floating)art.arcane.iris.generation.biome.FloatingIslandSample.clearThreadCaches();WorkerCaveStorage.clear();}
    }
}
