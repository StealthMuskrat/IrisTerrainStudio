// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import art.arcane.volmlib.nativelib.terrain.NativeBlockState;
import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateMerger;

/** A guarded compiler bridge constructs the unchanged native platform merger with owned handles. */
public final class WorkerStateMerging {
    public static NativeBlockState merge(NativeBlockState base,NativeBlockState update){return create(MergeResolver.current()).merge(base,update);}
    private static NativeStateMerger create(MergeResolver resolver){throw studio.engine.UnsupportedPlatform.unavailable("Native state-merger constructor requires compiler binding");}
}
