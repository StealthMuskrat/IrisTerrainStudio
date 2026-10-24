// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.iris.spi.IrisPlatforms;

/** Physical state handles and captured FULL support predicates for the original native face algorithm. */
public final class WorkerStateFaces {
    public static Object handle(NativeBlockState state){
        if(!(IrisPlatforms.get().registries() instanceof BrowserRegistries registry))throw studio.engine.UnsupportedPlatform.unavailable("Face correction requires the owned browser registry");
        return registry.owned(state).handle();
    }
    public static boolean isFaceSturdy(RotationState state,RotationTokens.Direction face){
        if(IrisPlatforms.get().registries()!=state.owner)throw new IllegalArgumentException("Face support requires the current registry owner");
        int index=switch(face.getSerializedName()){case"north"->0;case"east"->1;case"south"->2;case"west"->3;case"up"->4;case"down"->5;default->throw new IllegalArgumentException("Unknown native support face");};
        return(state.state.faces&(1<<index))!=0;
    }
}
