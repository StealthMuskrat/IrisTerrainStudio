// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.configuration.IrisSettings;
import art.arcane.iris.generation.runtime.*;
import art.arcane.iris.spi.*;
import java.util.concurrent.ExecutorService;

/** Explicit host boundary for isolated scalar sampling; no server services are simulated. */
public final class WorkerTerrainPlatform {
    private static final art.arcane.iris.generation.simd.SimdKernels SCALAR=new art.arcane.iris.generation.simd.ScalarSimdKernels();
    public static art.arcane.iris.generation.simd.SimdKernels scalarKernels(){return SCALAR;}
    public static void install(PlatformRegistries registry){
        IrisPlatforms.unbind();
        IrisPlatforms.bind(new PlatformBoundary(){
            public String platformName(){return "browser-worker";}
            public String minecraftVersion(){return "26.3";}
            public PlatformRegistries registries(){return registry;}
            public void log(LogLevel level,String message){System.err.println(level+": "+message);}
            public void msg(String message){System.err.println(message);}
            public void reportError(Throwable error){error.printStackTrace();}
        });
        if(!(registry instanceof studio.engine.registry.BrowserRegistries owned))throw new IllegalArgumentException("Worker decorators require the native registry");
        var decorators=new WorkerDecoratorHooks(owned);
        art.arcane.iris.generation.decoration.DecoratorPlatformHooks.bind(decorators,decorators);
        IrisSettings.settings=new IrisSettings();
        IrisServices.register(PreservationRegistry.class,new PreservationRegistry(){
            public void register(Thread value){throw new UnsupportedOperationException("Worker terrain cannot register server threads");}
            public void register(ExecutorService value){throw new UnsupportedOperationException("Worker terrain cannot register server executors");}
            public void registerCache(MeteredCache value){} // Lifetime is the owning worker snapshot.
            public void dereference(){}
        });
    }
}
