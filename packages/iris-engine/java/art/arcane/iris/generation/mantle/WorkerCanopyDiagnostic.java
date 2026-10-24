// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;
import art.arcane.iris.generation.decoration.tree.*;
import art.arcane.iris.structure.object.*;
import art.arcane.iris.generation.block.TileData;
import art.arcane.iris.pack.loading.IrisData;
import art.arcane.iris.spi.IrisPlatforms;
import art.arcane.iris.generation.runtime.Engine;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.math.BlockPosition;
import art.arcane.volmlib.util.matter.*;
import com.google.gson.stream.JsonWriter;
import java.io.*;import java.util.*;

/** Tiny owned inputs exercise unchanged 4.3.5 grounding, plan bits and continuation codecs. */
public final class WorkerCanopyDiagnostic {
    public static String run()throws IOException{
        var registry=IrisPlatforms.get().registries();var wood=registry.decodeBlockState("minecraft:oak_log[axis=y]");var leaves=registry.decodeBlockState("minecraft:oak_leaves[distance=7,persistent=true,waterlogged=false]");
        var mutations=List.<ObjectDestinationTransaction.Mutation>of(
            new ObjectDestinationTransaction.SetMutation(new ObjectDestinationTransaction.DataKey(16,5,1,NativeBlockState.class),wood,false),
            new ObjectDestinationTransaction.SetMutation(new ObjectDestinationTransaction.DataKey(16,5,1,String.class),"trunk",false),
            new ObjectDestinationTransaction.SetMutation(new ObjectDestinationTransaction.DataKey(16,5,1,NativeBlockState.class),leaves,true),
            new ObjectDestinationTransaction.SetMutation(new ObjectDestinationTransaction.DataKey(16,5,1,String.class),"blocked-canopy",true),
            new ObjectDestinationTransaction.SetMutation(new ObjectDestinationTransaction.DataKey(17,5,1,NativeBlockState.class),leaves,true));
        var plan=new ObjectSourcePlan(mutations);var decoded=plan.mutationsFor(1,0);var encoded=ObjectSourcePlan.encode(decoded,16);Matter payload=Matter.read(new ByteArrayInputStream(encoded));
        var text=new StringWriter();try(var writer=new JsonWriter(text)){
            writer.beginObject();writer.name("mutations").beginArray();for(var mutation:decoded){writer.beginArray().value(mutation.key().x()).value(mutation.key().y()).value(mutation.key().z()).value(mutation.canopy()).endArray();}writer.endArray();
            writer.name("trunk").value(payload.<NativeBlockState>getSlice(NativeBlockState.class).get(0,5,1).key());writer.name("trunkMarker").value(payload.<String>getSlice(String.class).get(0,5,1));writer.name("canopy").value(payload.<NativeBlockState>getSlice(NativeBlockState.class).get(1,5,1).key());writer.name("trunkConditionAbsent").value(payload.<TreeCanopy>getSlice(TreeCanopy.class).get(0,5,1)==null);writer.name("canopyConditionRetained").value(payload.<TreeCanopy>getSlice(TreeCanopy.class).get(1,5,1)==TreeCanopy.INSTANCE);
            var config=new IrisObjectPlacement();config.getRotation().setEnabled(false);
            studio.engine.terrain.WorkerProceduralMap.begin();try{
                var grounding=TreeGrounding.create(List.of(new TreeGrounding.Root(0,0,0,wood),new TreeGrounding.Root(1,1,0,wood)),4,Set.of(new TreeBlockCanvas.Vec(0,2,0)));
                writer.name("grounding").beginArray();for(int surface:new int[]{3,1,-8}){var result=grounding.plan(new Ground(surface),new TreeGrounding.Placement(null,config,new BlockPosition(0,4,0),new BlockPosition(0,0,0)));writer.beginObject();writer.name("surface").value(surface);writer.name("supported").value(result.supported());writer.name("extensions").beginArray();for(var extension:result.extensions())writer.beginArray().value(extension.x()).value(extension.topY()).value(extension.bottomY()).value(extension.z()).value(extension.state().key()).endArray();writer.endArray();writer.endObject();}writer.endArray();
            }finally{studio.engine.terrain.WorkerProceduralMap.end();}
            writer.endObject();
        }return text.toString();
    }
    private record Ground(int surface)implements IObjectPlacer{
        public int getHighest(int x,int z,IrisData data){return getHighest(x,z,data,true);}public int getHighest(int x,int z,IrisData data,boolean ignoreFluid){return x==1?surface:3;}
        public void set(int x,int y,int z,NativeBlockState state){throw new UnsupportedOperationException("Read-only grounding probe");}public NativeBlockState get(int x,int y,int z){return null;}
        public boolean isPreventingDecay(){return true;}public boolean isCarved(int x,int y,int z){return false;}public boolean isSolid(int x,int y,int z){return y<=getHighest(x,z,null);}
        public boolean isUnderwater(int x,int z){return false;}public int getFluidHeight(){return 0;}public boolean isDebugSmartBore(){return false;}
        public void setTile(int x,int y,int z,TileData value){throw new UnsupportedOperationException("Read-only grounding probe");}public<T>void setData(int x,int y,int z,T value){throw new UnsupportedOperationException("Read-only grounding probe");}public<T>T getData(int x,int y,int z,Class<T> type){return null;}public Engine getEngine(){return null;}
    }
}
