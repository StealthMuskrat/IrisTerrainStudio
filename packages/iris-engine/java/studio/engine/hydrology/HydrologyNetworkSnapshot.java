// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;

import art.arcane.iris.generation.hydrology.*;
import art.arcane.iris.generation.hydrology.runtime.IrisHydrologyRuntime;
import com.google.gson.stream.JsonWriter;
import java.io.IOException;

/** Bounded, read-only publication of original tile graphs and hydraulic centerlines. */
public final class HydrologyNetworkSnapshot {
    public static final int MAX_TILES=32,MAX_COURSES=256,MAX_SEGMENTS=1024,MAX_POINTS=32768,MAX_NODES=4096,MAX_OUTLETS=1024;
    private static String id(long value){return Long.toUnsignedString(value,16);}
    private static void point(JsonWriter writer,HydrologyPoint point)throws IOException{writer.beginArray().value(point.x()).value(point.y()).value(point.z()).endArray();}
    public static void write(JsonWriter writer,IrisHydrologyRuntime runtime,int minX,int minZ,int maxX,int maxZ)throws IOException{
        int size=runtime.settings().routing().tileSize(),halo=runtime.settings().publicationRadius();
        int left=Math.toIntExact(Math.floorDiv((long)minX-halo,size)),right=Math.toIntExact(Math.floorDiv((long)maxX-1+halo,size));
        int top=Math.toIntExact(Math.floorDiv((long)minZ-halo,size)),bottom=Math.toIntExact(Math.floorDiv((long)maxZ-1+halo,size));
        long totalTiles=((long)right-left+1)*((long)bottom-top+1);int tiles=0,courses=0,segments=0,points=0,nodes=0,outlets=0,omittedCourses=0,omittedNodes=0,omittedOutlets=0;
        writer.beginObject();writer.name("version").value(1);writer.name("selection").value("native-publication-halo");writer.name("coordinates").value("native-hydrology-x-headY-z");writer.name("tileSize").value(size);writer.name("publicationRadius").value(halo);writer.name("totalOwnerTiles").value(totalTiles);
        writer.name("limits").beginObject().name("tiles").value(MAX_TILES).name("courses").value(MAX_COURSES).name("segments").value(MAX_SEGMENTS).name("points").value(MAX_POINTS).name("nodes").value(MAX_NODES).name("outlets").value(MAX_OUTLETS).endObject();
        writer.name("tiles").beginArray();
        for(int tz=top;tz<=bottom&&tiles<MAX_TILES;tz++)for(int tx=left;tx<=right&&tiles<MAX_TILES;tx++){
            var tile=runtime.tile(new HydrologyTileKey(tx,tz));tiles++;
            writer.beginObject().name("x").value(tx).name("z").value(tz);
            writer.name("nodes").beginArray();for(var node:tile.nodes()){if(nodes>=MAX_NODES){omittedNodes++;continue;}nodes++;writer.beginObject().name("id").value(id(node.id())).name("point");point(writer,node.naturalPoint());writer.name("outletId").value(id(node.outletId())).name("potential").value(node.potential()).endObject();}writer.endArray();
            writer.name("outlets").beginArray();for(var outlet:tile.outlets()){if(outlets>=MAX_OUTLETS){omittedOutlets++;continue;}outlets++;writer.beginObject().name("id").value(id(outlet.id())).name("type").value(outlet.type().name()).name("nodeId").value(id(outlet.drainageNodeId())).name("landward");point(writer,outlet.landwardPoint());writer.name("connection");point(writer,outlet.connectionPoint());writer.name("seaLevel").value(outlet.seaLevel()).name("directOcean").value(outlet.directOcean()).endObject();}writer.endArray();
            writer.name("courses").beginArray();for(var course:tile.courses()){
                long addedPoints=0;for(var segment:course.segments())addedPoints+=segment.centerline().size();
                if(courses>=MAX_COURSES||course.segments().size()>MAX_SEGMENTS-segments||addedPoints>MAX_POINTS-points){omittedCourses++;continue;}
                if(course.profileKey().length()>1024)throw new IllegalArgumentException("Hydrology diagnostic profile key exceeds 1,024 characters");
                courses++;segments+=course.segments().size();points+=Math.toIntExact(addedPoints);
                writer.beginObject().name("id").value(id(course.id())).name("type").value(course.type().name()).name("profile").value(course.profileKey()).name("discharge").value(course.discharge());
                writer.name("sourceNodeId");if(course.sourceNodeId().isPresent())writer.value(id(course.sourceNodeId().getAsLong()));else writer.nullValue();writer.name("outletId");if(course.outletId().isPresent())writer.value(id(course.outletId().getAsLong()));else writer.nullValue();
                writer.name("segments").beginArray();for(var segment:course.segments()){
                    writer.beginObject().name("id").value(id(segment.id())).name("type").value(segment.type().name()).name("upstreamHeadY").value(segment.upstreamHeadY()).name("downstreamHeadY").value(segment.downstreamHeadY()).name("width").value(segment.width()).name("depth").value(segment.depth()).name("fallingFluid").value(segment.fallingFluid()).name("receivingPool").value(segment.receivingPool());
                    writer.name("points").beginArray();for(int station=0;station<segment.centerline().size();station++){var p=segment.centerline().get(station);writer.beginArray().value(p.x()).value(p.y()).value(p.z()).value(segment.channelProfile().widthAt(station)).value(segment.channelProfile().depthAt(station)).endArray();}writer.endArray().endObject();
                }writer.endArray().endObject();
            }writer.endArray().endObject();
        }writer.endArray();
        writer.name("counts").beginObject().name("tiles").value(tiles).name("courses").value(courses).name("segments").value(segments).name("points").value(points).name("nodes").value(nodes).name("outlets").value(outlets).endObject();
        writer.name("omitted").beginObject().name("tiles").value(Math.max(0,totalTiles-tiles)).name("courses").value(omittedCourses).name("nodes").value(omittedNodes).name("outlets").value(omittedOutlets).endObject();
        writer.name("truncated").value(totalTiles>tiles||omittedCourses>0||omittedNodes>0||omittedOutlets>0);writer.endObject();
    }
}
