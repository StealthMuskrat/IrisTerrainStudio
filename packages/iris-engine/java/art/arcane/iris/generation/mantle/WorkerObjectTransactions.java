// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;

import art.arcane.iris.structure.object.*;
import art.arcane.volmlib.util.math.RNG;
import art.arcane.volmlib.util.mantle.runtime.Mantle;
import art.arcane.volmlib.util.matter.Matter;

/** Access bridge to original native writer initialization, source plans and destination transactions. */
public final class WorkerObjectTransactions {
    public record Neighborhood(MantleObjectComponent component,int placementRadius,int inputChunkRadius,int sourceChunkRadius,WorkerObjectSession session){}
    public record NeighborhoodStats(int sourceChunks,int contributingSources,int placementRadius,int inputChunkRadius,int sourceChunkRadius,long builtPlanBytes){}
    public record Result(int placedY,int sourcePlanDestinations,int replayedDestinations,int retainedBytes,NeighborhoodStats neighborhood){
        public Result(int y,int destinations,int replayed,int bytes){this(y,destinations,replayed,bytes,null);}
    }
    public static ObjectSourcePlan buildPlan(MantleObjectComponent component,MantleWriter writer,int sourceX,int sourceZ,art.arcane.iris.generation.context.ChunkContext context){throw new UnsupportedOperationException("Native private source-plan builder requires its pinned compiler bridge");}
    public static Neighborhood prepareNeighborhood(EngineMantle engine){
        var component=new MantleObjectComponent(engine);int radius=component.getRadius(),input=Math.ceilDiv(component.getInputRadius(),16),sources=MantleObjectComponent.sourceChunkRadius(radius);
        if(input>3||sources>1)throw studio.engine.UnsupportedPlatform.unavailable("Procedural neighborhood exceeds 49 prepared chunks or nine source chunks");
        return new Neighborhood(component,radius,Math.max(1,input),sources,((studio.engine.terrain.BrowserTerrainEngine)engine.getEngine()).objectSession());
    }
    public static MantleWriter createWriter(EngineMantle engine,Mantle<Matter> mantle,int x,int z,int radius){throw new UnsupportedOperationException("Browser writer factory requires its pinned compiler adapter");}
    public static Result place(EngineMantle engine,IrisObject object,IrisObjectPlacement config,RNG rng,boolean plausible,int x,int z,art.arcane.iris.generation.context.ChunkContext context){
        int cx=x>>4,cz=z>>4;
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine.getEngine(),engine.getEngine().getGenerationSessionId(),context);MantleWriter writer=createWriter(engine,null,cx,cz,1)){
            ObjectDestinationTransaction source=new ObjectDestinationTransaction(writer,cx,cz);
            IObjectPlacer placer=plausible?new DecayControlPlacer(source):source;
            Result[] result={new Result(-1,0,0,0)};
            writer.withComponentPriority(2,()->{
                int checkpoint=source.beginObjectPlacement();
                int placedY=object.place(x,-1,z,placer,config,rng,engine.getData());
                if(placedY<0)return;
                source.endObjectPlacement(checkpoint);
                ObjectSourcePlan plan=source.sourcePlanSince(checkpoint);
                result[0]=replay(writer,plan,cx,cz,placedY);
            });return result[0];
        }
    }
    public static Result scatter(EngineMantle engine,int cx,int cz,art.arcane.iris.generation.context.ChunkContext context){
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine.getEngine(),engine.getEngine().getGenerationSessionId(),context);MantleWriter writer=createWriter(engine,null,cx,cz,1)){
            ObjectDestinationTransaction source=new ObjectDestinationTransaction(writer,cx,cz);
            Result[] result={null};writer.withComponentPriority(2,()->{
                int checkpoint=source.mutationCheckpoint();
                new MantleObjectComponent(engine).generateOrigin(source,cx,cz,context);
                result[0]=replay(writer,source.sourcePlanSince(checkpoint),cx,cz,-1);
            });return result[0];
        }
    }
    public static Result neighborhood(EngineMantle engine,int cx,int cz,art.arcane.iris.generation.context.ChunkContext context,Neighborhood neighborhood){
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine.getEngine(),engine.getEngine().getGenerationSessionId(),context);MantleWriter writer=createWriter(engine,null,cx,cz,neighborhood.inputChunkRadius())){
            ObjectDestinationTransaction destination=new ObjectDestinationTransaction(writer,cx,cz);
            int[] sources={0,0};long before=neighborhood.session().builtBytes(engine.getEngine());
            writer.withComponentPriority(2,()->{
                MantleObjectComponent.replaySourceChunks(cx,cz,neighborhood.placementRadius(),(sx,sz)->{
                    ObjectSourcePlan plan=neighborhood.session().acquire(engine.getEngine(),sx,sz,cx,cz,neighborhood.sourceChunkRadius(),()->buildPlan(neighborhood.component(),writer,sx,sz,context));sources[0]++;
                    if(plan!=null){sources[1]++;destination.apply(plan);plan.persistContinuations(writer,sx,sz,cx,cz);}
                });
                destination.commit();
            });
            return new Result(-1,0,0,0,new NeighborhoodStats(sources[0],sources[1],neighborhood.placementRadius(),neighborhood.inputChunkRadius(),neighborhood.sourceChunkRadius(),neighborhood.session().builtBytes(engine.getEngine())-before));
        }
    }
    private static Result replay(MantleWriter writer,ObjectSourcePlan plan,int cx,int cz,int placedY){
        int destinations=0;
        for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)if(plan.destinationSlot(cx+dx,cz+dz)>=0)destinations++;
        if(destinations!=plan.destinationCount())throw studio.engine.UnsupportedPlatform.unavailable("Object source plan outside the prepared three-by-three chunk window");
        for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)if(plan.destinationSlot(cx+dx,cz+dz)>=0){
            ObjectDestinationTransaction destination=new ObjectDestinationTransaction(writer,cx+dx,cz+dz);
            destination.apply(plan);destination.commit();
        }
        return new Result(placedY,plan.destinationCount(),destinations,plan.estimatedRetainedBytes());
    }

}
