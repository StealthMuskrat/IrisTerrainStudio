// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.runtime.Engine;
import art.arcane.iris.pack.loading.IrisData;
import art.arcane.volmlib.util.mantle.runtime.Mantle;
import art.arcane.volmlib.util.matter.Matter;
import java.nio.file.Path;
import java.util.function.Supplier;

/** Owned storage/task capabilities only; native registration, pass planning and scheduling execute. */
public final class WorkerMatterRuntime {
    private static Engine owner;
    private static int maximumAccess;
    public static void begin(Engine engine){if(owner!=null)throw new IllegalStateException("Nested native matter preview");owner=engine;maximumAccess=0;}
    public static void end(){owner=null;maximumAccess=0;}
    public static Path storageRoot(Path path){if(owner==null||path!=null)throw studio.engine.UnsupportedPlatform.unavailable("Native mantle filesystem root outside an owned preview");return null;}
    public static Mantle<Matter> createStorage(Engine engine,Path path,Supplier<IrisData> data){if(owner!=engine||path!=null||data.get()!=engine.getData())throw new IllegalStateException("Native mantle storage requires its active snapshot");return null;}
    public static void admitWriter(int prefetch,int access,boolean multicore){
        if(owner==null)throw new IllegalStateException("Native matter writer requires an owned preview");
        if(multicore||prefetch<0||prefetch>3||access<prefetch||access>6)throw studio.engine.UnsupportedPlatform.unavailable("Native matter writer exceeds its bounded inline window");maximumAccess=Math.max(maximumAccess,access);
    }
    public static int maximumAccess(){return maximumAccess;}
}
