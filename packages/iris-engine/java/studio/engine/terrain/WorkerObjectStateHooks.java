// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.structure.object.IrisObjectRotation;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;

/** Native modded-platform rotation, with browser property/state handles supplied by the compiler boundary. */
public final class WorkerObjectStateHooks {
    public static NativeBlockState rotate(IrisObjectRotation rotation,NativeBlockState state,int x,int y,int z){
        if(state==null||art.arcane.iris.pack.validation.MissingBlockState.isPlaceholder(state))return state;
        return new art.arcane.iris.modded.ModdedStateRotator().rotate(rotation,state,x,y,z);
    }
}
