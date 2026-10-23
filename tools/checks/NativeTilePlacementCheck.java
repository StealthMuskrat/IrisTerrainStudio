// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

/** Original native placement with the pinned probe tile factory; no server/world tile application. */
public final class NativeTilePlacementCheck {
    public static void main(String[] args)throws Exception{
        var reader=art.arcane.iris.generation.block.TileData.bindPlatformReader(StubTileData::read);
        var factory=art.arcane.iris.generation.block.TileData.bindPlatformFactory(StubTileData::fromProperties);
        art.arcane.volmlib.util.matter.IrisMatter.registerSliceType("art.arcane.iris.util.project.matter.TileWrapper",new art.arcane.iris.world.storage.matter.TileMatter());
        try{NativeTerrainLinkCheck.main(args);}
        finally{art.arcane.iris.generation.block.TileData.restorePlatformReader(reader);art.arcane.iris.generation.block.TileData.restorePlatformFactory(factory);}
    }
}
