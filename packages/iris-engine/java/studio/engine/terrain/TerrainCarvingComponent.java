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
        MATERIAL_FINISH("native-overworld-material-finish-development"),
        SOURCE_SCATTER("native-procedural-source-scatter-development"),
        NEIGHBOR_SCATTER("native-procedural-neighborhood-development");
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
        boolean neighbors=stage==Stage.NEIGHBOR_SCATTER,scatter=stage==Stage.SOURCE_SCATTER,content=placement!=null||scatter||neighbors;
        var neighborhood=neighbors?art.arcane.iris.generation.mantle.WorkerObjectTransactions.prepareNeighborhood(engine.getMantle()):null;
        int radius=neighbors?neighborhood.inputChunkRadius():1,limit=neighbors?(2*radius+1)*(2*radius+1):content?9:5;
        if(neighbors&&((long)height*256*limit>8388608||Math.abs((long)x)+(radius<<4)+15>30000000||Math.abs((long)z)+(radius<<4)+15>30000000))throw new IllegalArgumentException("Procedural neighborhood exceeds its worker volume or coordinate budget");
        int cx=x>>4,cz=z>>4;WorkerCaveStorage.begin(height,cx,cz,limit);
        art.arcane.iris.generation.mantle.WorkerObjectTransactions.Result placementResult=null;art.arcane.iris.generation.mantle.WorkerObjectSession.Pass cachePass=null;
        try {
            if(neighbors)cachePass=neighborhood.session().begin(engine);
            MantleCarvingComponent carving=new MantleCarvingComponent(engine.getMantle());
            int[][] offsets;if(neighbors){offsets=new int[limit][2];int index=0;for(int dx=-radius;dx<=radius;dx++)for(int dz=-radius;dz<=radius;dz++)offsets[index++]=new int[]{dx,dz};}else offsets=!content?new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1}}:new int[][]{{0,0},{-1,0},{1,0},{0,-1},{0,1},{-1,-1},{-1,1},{1,-1},{1,1}};
            for(int[] offset:offsets){int chunkX=cx+offset[0],chunkZ=cz+offset[1];WorkerCaveStorage.select(chunkX,chunkZ);try(var writer=art.arcane.iris.generation.mantle.WorkerObjectTransactions.createWriter(engine.getMantle(),null,chunkX,chunkZ,0)){carving.generateLayer(writer,chunkX,chunkZ,new ChunkContext(chunkX<<4,chunkZ<<4,engine.getComplex(),false));}}
            WorkerCaveStorage.select(cx,cz);
            if(neighbors)WorkerCaveStorage.restoreContinuations(neighborhood.session().continuations(engine),engine);
            ArrayHunk<NativeBlockState> blocks=new ArrayHunk<>(16,height,16);blocks.fill(IrisPlatforms.get().registries().air());ChunkContext context=new ChunkContext(x,z,engine.getComplex(),false);
            new IrisTerrainNormalActuator(engine).paint(x,z,blocks,context);
            IrisCarveModifier cave=new IrisCarveModifier(engine);cave.onModify(cx,cz,blocks,false,context);
            if(post)new art.arcane.iris.generation.stage.IrisPostModifier(engine).onModify(x,z,blocks,false,context);
            var floatingModifier=floating?new art.arcane.iris.generation.stage.IrisFloatingChildBiomeModifier(engine):null;
            if(floating)floatingModifier.onModify(x,z,blocks,false,context);
            if(decorate)cave.decorateNaturalCaves(x,z,blocks,context);
            if(placement!=null)placementResult=art.arcane.iris.generation.mantle.WorkerObjectTransactions.place(engine.getMantle(),placement.object(),placement.config(),placement.rng(),placement.plausible(),x+8,z+8,context);
            if(neighbors)placementResult=art.arcane.iris.generation.mantle.WorkerObjectTransactions.neighborhood(engine.getMantle(),cx,cz,context,neighborhood);
            if(scatter)placementResult=art.arcane.iris.generation.mantle.WorkerObjectTransactions.scatter(engine.getMantle(),cx,cz,context);
            if(stage.ordinal()>=Stage.DEPOSITS.ordinal()){
                new art.arcane.iris.generation.stage.IrisDepositModifier(engine).onModify(x,z,blocks,false,context);
                engine.getMantle().insertMatter(cx,cz,blocks,false,context);
            }
            if(stage.ordinal()>=Stage.MATERIAL_FINISH.ordinal()){
                new art.arcane.iris.generation.stage.IrisDecorantActuator(engine).onActuate(x,z,blocks,false,context);
                floatingModifier.decorateColumns(x,z,blocks,false,context);
                new art.arcane.iris.generation.stage.IrisPerfectionModifier(engine).onModify(x,z,blocks,false,context);
            }
            String result=TerrainPaintStage.serialize(engine,x,z,blocks,placement==null?stage.scope:"native-procedural-placement-development");
            result=result.substring(0,result.length()-1)+",\"subterrain\":{\"nativePlanner\":true,\"enabled\":"+!engine.getComplex().getSubterrainPlanner().isEmpty()+",\"samplingWorkCharged\":"+WorkerCaveStorage.subterrainWork()+",\"workLimit\":16777216}}";
            if(content&&!neighbors)result=result.substring(0,result.length()-1)+",\"placedY\":"+placementResult.placedY()+",\"journaledCells\":"+WorkerCaveStorage.journalCellCount()+",\"sourcePlan\":{\"destinations\":"+placementResult.sourcePlanDestinations()+",\"replayedDestinations\":"+placementResult.replayedDestinations()+",\"retainedBytes\":"+placementResult.retainedBytes()+"},\"journalWindow\":"+WorkerCaveStorage.journalWindow()+"}";
            if(neighbors){var stats=placementResult.neighborhood();result=result.substring(0,result.length()-1)+",\"neighborhood\":{\"sourceChunks\":"+stats.sourceChunks()+",\"contributingSources\":"+stats.contributingSources()+",\"placementRadius\":"+stats.placementRadius()+",\"inputChunkRadius\":"+stats.inputChunkRadius()+",\"sourceChunkRadius\":"+stats.sourceChunkRadius()+",\"builtPlanBytes\":"+stats.builtPlanBytes()+"},\"journaledCells\":"+WorkerCaveStorage.journalCellCount()+",\"journalWindow\":"+WorkerCaveStorage.journalWindow()+"}";}
            if(scatter||neighbors)result=result.substring(0,result.length()-1)+",\"objectTags\":"+WorkerCaveStorage.objectTags()+"}";
            if(decorate)result=result.substring(0,result.length()-1)+",\"markers\":"+WorkerCaveStorage.markerEntries()+"}";
            if(neighbors){WorkerCaveStorage.retainContinuations(neighborhood.session().continuations(engine),engine);result=result.substring(0,result.length()-1)+",\"cache\":"+neighborhood.session().statistics(engine)+"}";cachePass.commit();}
            return result;
        } finally {try{if(cachePass!=null)cachePass.close();}finally{if(floating)art.arcane.iris.generation.biome.FloatingIslandSample.clearThreadCaches();WorkerCaveStorage.clear();}}
    }
}
