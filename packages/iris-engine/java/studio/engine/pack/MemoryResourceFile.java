// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.pack;
import java.io.File;
/** Sealed JSON resource identity. A snapshot has no filesystem modification clock. */
final class MemoryResourceFile extends File {
    private final MemoryPack owner;
    MemoryResourceFile(MemoryPack owner,String path){super("/iris-memory-pack/"+path);this.owner=owner;}
    @Override public long lastModified(){if(!owner.isOpen())throw studio.engine.expression.WorkerExpressions.failure("Resource handle is outside its open snapshot");return 0;}
}
