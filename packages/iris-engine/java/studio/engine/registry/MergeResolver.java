// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import java.util.*;

/** Resolves serialization of owned handles without interning parse masks. */
public final class MergeResolver {
    private final BrowserRegistries owner;
    private MergeResolver(BrowserRegistries owner){this.owner=owner;}
    public static MergeResolver current(){
        if(!(art.arcane.iris.spi.IrisPlatforms.get().registries() instanceof BrowserRegistries owner))throw studio.engine.UnsupportedPlatform.unavailable("Native state merging requires the browser registry");return new MergeResolver(owner);
    }
    public record Parsed(RotationState state,Map<RotationProperty,Comparable<?>> properties){}
    public Parsed resolveGet(String key){return owner.resolveMergeCanonical(key);}
}
