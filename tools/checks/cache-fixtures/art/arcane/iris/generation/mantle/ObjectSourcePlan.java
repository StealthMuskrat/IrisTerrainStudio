// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.generation.mantle;

/** TEST ONLY: controlled plan ABI for cache lifecycle checks. No generation/compression is implemented. */
final class ObjectSourcePlan {
    static final ObjectSourcePlan EMPTY=new ObjectSourcePlan(new int[0][],160,160);
    private final int[][] destinations;private final int retained,indexBytes;
    ObjectSourcePlan(int[][] destinations,int retained,int indexBytes){this.destinations=destinations;this.retained=retained;this.indexBytes=indexBytes;}
    boolean isEmpty(){return destinations.length==0;}
    int destinationCount(){return destinations.length;}
    int destinationSlot(int x,int z){for(int i=0;i<destinations.length;i++)if(destinations[i][0]==x&&destinations[i][1]==z)return i;return -1;}
    ObjectSourcePlan destinationIndex(){return new ObjectSourcePlan(destinations,indexBytes,indexBytes);}
    int estimatedRetainedBytes(){return retained;}
}
