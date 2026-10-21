// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;

import art.arcane.iris.generation.decoration.IrisProceduralObjects;
import art.arcane.iris.generation.cave.CarvingMode;
import art.arcane.iris.structure.object.IrisObjectPlacement;
import art.arcane.iris.structure.object.ObjectPlaceMode;

/** Guarded original MantleObjectComponent origin pass; neighboring source scheduling is not connected. */
public final class ProceduralSourcePreview {
    public static String render(BrowserTerrainEngine engine,int x,int z)throws java.io.IOException{
        return render(engine,x,z,false);
    }
    public static String render(BrowserTerrainEngine engine,int x,int z,boolean neighborhood)throws java.io.IOException{
        WorkerProceduralMap.begin();try{
            int[] attempts={0};var dimension=engine.getDimension();
            for(var region:dimension.getAllRegions(engine::getData))if(region!=null){
                if(!region.getObjects().isEmpty())throw unsupported("Imported object placements");
                check(region.getProceduralObjects(),attempts);
            }
            for(var biome:dimension.getReachableBiomes(engine::getData))if(biome!=null){
                if(!biome.getObjects().isEmpty())throw unsupported("Imported object placements");
                check(biome.getProceduralObjects(),attempts);
            }
            return TerrainCarvingComponent.paint(engine,x,z,neighborhood?TerrainCarvingComponent.Stage.NEIGHBOR_SCATTER:TerrainCarvingComponent.Stage.SOURCE_SCATTER);
        }finally{WorkerProceduralMap.end();}
    }
    private static void check(IrisProceduralObjects objects,int[] attempts){
        if(objects==null)return;
        if(objects.getRuins()!=null&&!objects.getRuins().isEmpty())throw unsupported("Procedural ruins");
        for(var entry:objects.getAllPlacements()){
            if(entry==null)throw unsupported("Null procedural placement");
            if((attempts[0]+=Math.max(1,entry.getDensity()))>64||entry.getDensity()>64)throw unsupported("More than 64 configured procedural attempts in the source preview");
            if(ProceduralPreview.variants(entry)>8)throw unsupported("More than eight baked variants per procedural entry");
            IrisObjectPlacement placement=entry.asPlacement();
            if(placement.getCarvingSupport()!=CarvingMode.SURFACE_ONLY||placement.getMode()==ObjectPlaceMode.CEILING_HANG)throw unsupported("Cave procedural anchors");
            if(!placement.getAllowedCollisions().isEmpty()||!placement.getForbiddenCollisions().isEmpty())throw unsupported("Cross-source procedural collision rules");
        }
    }
    private static RuntimeException unsupported(String feature){return studio.engine.UnsupportedPlatform.unavailable(feature+" in the one-source procedural preview");}
}
