// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;

import art.arcane.iris.structure.object.*;
import art.arcane.volmlib.util.math.RNG;
import art.arcane.volmlib.util.mantle.runtime.Mantle;
import art.arcane.volmlib.util.matter.Matter;

/** Access bridge to original native writer initialization and destination transaction. */
public final class WorkerObjectTransactions {
    public static MantleWriter createWriter(EngineMantle engine,Mantle<Matter> mantle,int x,int z,int radius){throw new UnsupportedOperationException("Browser writer factory requires its pinned compiler adapter");}
    public static int place(EngineMantle engine,IrisObject object,IrisObjectPlacement config,RNG rng,boolean plausible,int x,int z,art.arcane.iris.generation.context.ChunkContext context){
        try(var scope=art.arcane.iris.generation.context.IrisContext.open(engine.getEngine(),engine.getEngine().getGenerationSessionId(),context);MantleWriter writer=createWriter(engine,null,x>>4,z>>4,1)){
            ObjectDestinationTransaction transaction=new ObjectDestinationTransaction(writer,x>>4,z>>4);
            IObjectPlacer placer=plausible?new DecayControlPlacer(transaction):transaction;
            int[] result={-1};writer.withComponentPriority(2,()->{
                int checkpoint=transaction.beginObjectPlacement();
                result[0]=object.place(x,-1,z,placer,config,rng,engine.getData());
                if(result[0]>=0){transaction.endObjectPlacement(checkpoint);transaction.commit();}
            });return result[0];
        }
    }
}
