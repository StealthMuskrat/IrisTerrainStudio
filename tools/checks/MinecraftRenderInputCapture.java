// SPDX-License-Identifier: GPL-3.0-or-later
import com.google.gson.*;
import net.minecraft.core.*;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.client.color.block.*;
import net.minecraft.client.renderer.block.BlockAndTintGetter;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.*;
import net.minecraft.world.level.block.state.properties.*;
import net.minecraft.world.level.material.*;
import net.minecraft.world.phys.shapes.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;

/** Explicit rendering input extraction, not a parity test or placement-pair sweep. */
public final class MinecraftRenderInputCapture {
    static final Gson GSON=new Gson();
    static final Direction[] DIRS={Direction.NORTH,Direction.EAST,Direction.SOUTH,Direction.WEST,Direction.UP,Direction.DOWN};
    static <T> int intern(List<T> list,Map<T,Integer> ids,T row){var id=ids.get(row);if(id==null){id=list.size();ids.put(row,id);list.add(row);}return id;}
    static String floats(float[] values){var bytes=ByteBuffer.allocate(values.length*4).order(ByteOrder.LITTLE_ENDIAN);for(float v:values)bytes.putFloat(v);return Base64.getEncoder().encodeToString(bytes.array());}
    static String doubles(double[] values){var bytes=ByteBuffer.allocate(values.length*8).order(ByteOrder.LITTLE_ENDIAN);for(double v:values)bytes.putDouble(v);return Base64.getEncoder().encodeToString(bytes.array());}
    static String value(Property property,BlockState state){return property.getName(state.getValue(property));}
    public static void main(String[] args)throws Exception{
        net.minecraft.SharedConstants.tryDetectVersion();net.minecraft.server.Bootstrap.bootStrap();
        var result=new JsonObject();result.addProperty("formatVersion",1);result.addProperty("minecraftVersion","26.3");result.addProperty("clientSha256",args[1]);
        var shapes=new ArrayList<JsonArray>();var shapeIds=new HashMap<JsonArray,Integer>();var profiles=new ArrayList<JsonArray>();var profileIds=new HashMap<JsonArray,Integer>();var blocks=new JsonObject();int count=0;
        for(var block:BuiltInRegistries.BLOCK){
            var record=new JsonObject();var order=new ArrayList<Property<?>>(block.getStateDefinition().getProperties());order.sort(Comparator.comparing(Property::getName));record.add("properties",GSON.toJsonTree(order.stream().map(Property::getName).toList()));var states=new JsonObject();
            for(var state:block.getStateDefinition().getPossibleStates()){
                count++;var fluid=state.getFluidState();String kind=fluid.isEmpty()?"empty":fluid.getType().isSame(Fluids.WATER)?"water":fluid.getType().isSame(Fluids.LAVA)?"lava":null;if(kind==null)throw new IllegalStateException("Unknown native fluid");
                var row=new JsonArray();row.add(kind);row.add(fluid.getOwnHeight());row.add(!fluid.isEmpty()&&fluid.hasProperty(FlowingFluid.FALLING)&&fluid.getValue(FlowingFluid.FALLING));row.add(state.isSolid());row.add(state.isSolidRender());
                for(var dir:DIRS){var shape=state.getFaceOcclusionShape(dir);var rects=new JsonArray();if(shape==Shapes.block()){rects.add(GSON.toJsonTree(new double[]{0,0,1,1}));}else if(!shape.isEmpty())for(var box:shape.toAabbs()){
                    var axis=dir.getAxis();rects.add(GSON.toJsonTree(axis==Direction.Axis.Y?new double[]{box.minX,box.minZ,box.maxX,box.maxZ}:axis==Direction.Axis.X?new double[]{box.minZ,box.minY,box.maxZ,box.maxY}:new double[]{box.minX,box.minY,box.maxX,box.maxY}));
                }row.add(intern(shapes,shapeIds,rects));}
                row.add(state.getRenderShape().name());int support=0;for(int i=0;i<DIRS.length;i++)if(state.isFaceSturdy(net.minecraft.world.level.EmptyBlockGetter.INSTANCE,BlockPos.ZERO,DIRS[i]))support|=1<<i;row.add(support);states.addProperty(String.join(",",order.stream().map(p->value(p,state)).toList()),intern(profiles,profileIds,row));
            }
            record.add("states",states);record.addProperty("overlay",block instanceof HalfTransparentBlock||block instanceof LeavesBlock);record.addProperty("ice",block instanceof IceBlock);blocks.add(BuiltInRegistries.BLOCK.getKey(block).toString(),record);
        }
        result.add("faceNames",GSON.toJsonTree(Arrays.stream(DIRS).map(Direction::getSerializedName).toList()));result.add("shapes",GSON.toJsonTree(shapes));result.add("profiles",GSON.toJsonTree(profiles));result.add("blocks",blocks);result.addProperty("capturedStates",count);
        var colors=BlockColors.createDefault();var tintRules=new JsonObject();var classes=new HashMap<Class<?>,String>();classes.put(BlockTintSources.doubleTallGrass().getClass(),"lower-grass");classes.put(BlockTintSources.grass().getClass(),"grass");classes.put(BlockTintSources.grassBlock().getClass(),"grass");classes.put(BlockTintSources.sugarCane().getClass(),"grass");classes.put(BlockTintSources.foliage().getClass(),"foliage");classes.put(BlockTintSources.dryFoliage().getClass(),"dry_foliage");classes.put(BlockTintSources.water().getClass(),"water");
        for(var block:BuiltInRegistries.BLOCK){var sources=colors.getTintSources(block.defaultBlockState());if(sources.isEmpty())continue;var layers=new JsonArray();for(var source:sources){var rule=new JsonObject();var kind=classes.get(source.getClass());if(kind!=null)rule.addProperty("kind",kind);else if(source.relevantProperties().isEmpty()){rule.addProperty("kind","constant");rule.addProperty("color",source.colorInWorld(block.defaultBlockState(),BlockAndTintGetter.EMPTY,BlockPos.ZERO));}else{
            if(source.relevantProperties().size()!=1)throw new IllegalStateException("Unadapted tint state");var property=source.relevantProperties().iterator().next();rule.addProperty("kind","property");rule.addProperty("property",property.getName());var values=new JsonObject();for(var state:block.getStateDefinition().getPossibleStates())values.addProperty(value(property,state),source.color(state));rule.add("values",values);
        }layers.add(rule);}tintRules.add(BuiltInRegistries.BLOCK.getKey(block).toString(),layers);}
        result.add("tints",tintRules);
        var gradient=Biome.BIOME_INFO_NOISE.getClass().getSuperclass();var perms=gradient.getDeclaredField("perms");perms.setAccessible(true);result.addProperty("biomeNoisePermutation",Base64.getEncoder().encodeToString((byte[])perms.get(Biome.BIOME_INFO_NOISE)));
        var mth=net.minecraft.util.Mth.class;for(String name:new String[]{"SIN","ASIN_TAB","COS_TAB"}){var field=mth.getDeclaredField(name);field.setAccessible(true);var table=field.get(null);result.addProperty(name,table instanceof float[]?floats((float[])table):doubles((double[])table));}
        Files.writeString(Path.of(args[0]),GSON.toJson(result)+"\n");
    }
}
