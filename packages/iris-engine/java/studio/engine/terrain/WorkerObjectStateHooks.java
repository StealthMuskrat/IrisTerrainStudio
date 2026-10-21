// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.structure.object.IrisObjectRotation;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;

/** Explicit state-operation boundary; geometry remains native and unsupported state operations refuse. */
public final class WorkerObjectStateHooks {
    public static NativeBlockState rotate(IrisObjectRotation rotation,NativeBlockState state,int x,int y,int z){
        if(state==null||art.arcane.iris.pack.validation.MissingBlockState.isPlaceholder(state)||!rotation.canRotate()||(x%360==0&&y%360==0&&z%360==0))return state;
        throw studio.engine.UnsupportedPlatform.unavailable("Non-identity object block-state rotation");
    }
}
