// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.matter;
import art.arcane.volmlib.util.matter.*;
import art.arcane.volmlib.util.matter.slices.*;
import art.arcane.iris.world.storage.matter.*;

/** Original native slice codecs, with explicit construction instead of JVM reflection. */
public final class WorkerMatterCodecs {
    private static boolean registered;
    public static synchronized void ensureRegistered(){
        if(registered)return;
        IrisMatter.registerSliceType(new StringMatter());IrisMatter.registerSliceType(new MarkerMatter());IrisMatter.registerSliceType(new CavernMatter());
        IrisMatter.registerSliceType("art.arcane.iris.util.project.matter.TileWrapper",new TileMatter());IrisMatter.registerSliceType(new UpdateMatter());IrisMatter.registerSliceType("art.arcane.iris.engine.hydrology.cave.HydrologyCaveCell",new HydrologyCaveMatter());
        IrisMatter.registerSliceType(new ObjectContinuationMatter());IrisMatter.registerSliceType(new PlatformBlockMatter());
        IrisMatter.registerSliceType("art.arcane.iris.core.link.Identifier",new IdentifierMatter());
        IrisMatter.registerSliceType("art.arcane.iris.util.project.matter.PreObjectMatterCell",new PreObjectMatter());
        IrisMatter.registerSliceType("art.arcane.iris.engine.framework.TreeBlockMaterial",new TreeBlockMaterialMatter());registered=true;
    }
    @SuppressWarnings("unchecked") public static <T>MatterSlice<T> create(Class<T> type,Matter owner){
        ensureRegistered();int w=owner.getWidth(),h=owner.getHeight(),d=owner.getDepth();MatterSlice<?> result;
        if(type==String.class)result=new StringMatter(w,h,d);
        else if(type==MatterMarker.class)result=new MarkerMatter(w,h,d);
        else if(type==MatterCavern.class)result=new CavernMatter(w,h,d);
        else if(type==art.arcane.iris.generation.mantle.ObjectContinuationBundle.class)result=new ObjectContinuationMatter(w,h,d);
        else if(type==art.arcane.volmlib.nativelib.terrain.NativeBlockState.class)result=new PlatformBlockMatter(w,h,d);
        else if(type==art.arcane.iris.integration.Identifier.class)result=new IdentifierMatter(w,h,d);
        else if(type==art.arcane.iris.generation.hydrology.cave.HydrologyCaveCell.class)result=new HydrologyCaveMatter(w,h,d);
        else if(type==TileWrapper.class)result=new TileMatter(w,h,d);
        else if(type==MatterUpdate.class)result=new UpdateMatter(w,h,d);
        else if(type==PreObjectMatterCell.class)result=new PreObjectMatter(w,h,d);
        else if(type==art.arcane.iris.generation.decoration.tree.TreeBlockMaterial.class)result=new TreeBlockMaterialMatter(w,h,d);
        else throw studio.engine.UnsupportedPlatform.unavailable("Native Matter slice codec: "+type.getName());
        return (MatterSlice<T>)result;
    }
}
