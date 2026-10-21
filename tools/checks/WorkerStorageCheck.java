// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.probe;
import studio.engine.terrain.WorkerCaveStorage;
import art.arcane.volmlib.util.matter.MatterMarker;

/** Four marker writes at world-height bounds; no terrain generation or block-state sweep. */
public final class WorkerStorageCheck {
    public static void main(String[] args)throws Exception{
        WorkerCaveStorage.begin(4096,-1,2);
        try{
            WorkerCaveStorage.setMarker(null,-1,4095,32,new MatterMarker("top"));
            WorkerCaveStorage.setMarker(null,-14,3,36,new MatterMarker("last"));
            WorkerCaveStorage.setMarker(null,-15,3,36,new MatterMarker("first"));
            WorkerCaveStorage.setMarker(null,-16,16,32,new MatterMarker("section"));
            String expected="[[1,3,4,\"first\"],[2,3,4,\"last\"],[0,16,0,\"section\"],[15,4095,0,\"top\"]]";
            if(!expected.equals(WorkerCaveStorage.markerEntries()))throw new AssertionError("Sparse markers changed order or coordinates");
        }finally{WorkerCaveStorage.clear();}
        WorkerCaveStorage.begin(4096,-1,2);
        try{if(!WorkerCaveStorage.markerEntries().equals("[]"))throw new AssertionError("Marker storage leaked across requests");}finally{WorkerCaveStorage.clear();}
        System.out.println("Sparse marker check passed: four writes, height 4096, ordering and request cleanup.");
    }
}
