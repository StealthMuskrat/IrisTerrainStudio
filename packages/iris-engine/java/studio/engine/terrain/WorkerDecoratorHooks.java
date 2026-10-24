// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.iris.generation.decoration.DecoratorPlatformHooks;
import art.arcane.iris.generation.mantle.EngineMantle;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.util.hunk.Hunk;
import studio.engine.registry.BrowserRegistries;
/** Original native decorator face correction over owned worker states and prepared matter. */
public final class WorkerDecoratorHooks implements DecoratorPlatformHooks.FaceFixer,DecoratorPlatformHooks.SurfaceSturdiness {
    private final BrowserRegistries registry;
    public WorkerDecoratorHooks(BrowserRegistries registry){this.registry=registry;}
    public boolean canGoOn(NativeBlockState surface,boolean upward){return registry.isFaceSturdy(surface,upward?4:5);}
    public NativeBlockState fixFaces(NativeBlockState state,Hunk<NativeBlockState> hunk,int rX,int rZ,int x,int y,int z,EngineMantle mantle){return new art.arcane.iris.modded.ModdedDecoratorHooks().fixFaces(state,hunk,rX,rZ,x,y,z,mantle);}
}
