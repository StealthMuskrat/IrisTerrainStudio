// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import com.google.gson.Gson;
import net.minecraft.core.Direction;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.block.state.properties.*;
import java.nio.file.*;
import java.util.*;

/** Export property handle types and direction constants; never enumerates block states or placement pairs. */
public final class GenerateRotationBindings {
    private static final Gson JSON=new Gson();
    private static String literal(String value){return JSON.toJson(value);}
    private record Field(String name,String kind,String valueClass,List<String> values){}
    @SuppressWarnings({"rawtypes","unchecked"}) private static Field field(Property property){
        List<String> values=new ArrayList<>();for(Object value:property.getPossibleValues())values.add(property.getName((Comparable)value));
        return new Field(property.getName(),property.getClass().getName(),property.getValueClass().getName(),List.copyOf(values));
    }
    public static void main(String[] args)throws Exception{
        try(var jar=new java.util.jar.JarFile(args[2])){for(String name:List.of("net/minecraft/world/level/block/state/properties/RotationSegment.class","net/minecraft/util/SegmentedAnglePrecision.class")){var entry=jar.getJarEntry(name);if(entry==null||entry.getSize()>65536)throw new IllegalArgumentException("Missing or oversized native rotation math class");Path target=Path.of(args[3]).resolve(name);Files.createDirectories(target.getParent());try(var input=jar.getInputStream(entry)){Files.write(target,input.readAllBytes());}}}
        HeadlessNativeBootstrap.initialize();Path output=Path.of(args[0]).toAbsolutePath(),folder=output.resolve("studio/engine/registry");Files.createDirectories(folder);
        List<String> keys=new ArrayList<>();Map<String,Integer> indices=new LinkedHashMap<>();List<List<Field>> layouts=new ArrayList<>();Map<List<Field>,Integer> shared=new LinkedHashMap<>();
        for(var block:BuiltInRegistries.BLOCK){String key=BuiltInRegistries.BLOCK.getKey(block).toString();List<Field> fields=new ArrayList<>();for(Property<?> property:block.defaultBlockState().getProperties())fields.add(field(property));List<Field> layout=List.copyOf(fields);int index=shared.computeIfAbsent(layout,ignored->{layouts.add(layout);return layouts.size()-1;});keys.add(key);indices.put(key,index);}
        StringBuilder source=new StringBuilder("// Generated from pinned native property handles.\npackage studio.engine.registry;\nimport java.util.*;\npublic final class RotationBindings {\nprivate static final List<List<RotationProperty>> GROUPS=new ArrayList<>();\nstatic {\n");
        for(int index=0;index<layouts.size();index++)source.append("GROUPS.add(group").append(index).append("());\n");source.append("}\n");
        for(int index=0;index<layouts.size();index++){source.append("private static List<RotationProperty> group").append(index).append("(){return List.of(");boolean first=true;for(Field field:layouts.get(index)){if(!first)source.append(',');first=false;source.append("RotationProperty.create(").append(literal(field.name())).append(',').append(literal(field.kind())).append(',').append(literal(field.valueClass())).append(",List.of(");for(int value=0;value<field.values().size();value++){if(value>0)source.append(',');source.append(literal(field.values().get(value)));}source.append("))");}source.append(");}\n");}
        source.append("public static List<RotationProperty> properties(String name){return GROUPS.get(switch(name){\n");for(var entry:indices.entrySet())source.append("case ").append(literal(entry.getKey())).append(" -> ").append(entry.getValue()).append(";\n");source.append("default -> throw studio.engine.UnsupportedPlatform.unavailable(\"Block type absent from pinned rotation metadata\");});}\n}\n");
        Files.writeString(folder.resolve("RotationBindings.java"),source);
        StringBuilder tokens=new StringBuilder("// Generated native enum identities and coordinate constants.\npackage studio.engine.registry;\npublic final class RotationTokens {\npublic enum Axis {\n");
        for(Direction.Axis value:Direction.Axis.values())tokens.append(value.name()).append('(').append(literal(value.getSerializedName())).append(',').append(value.isVertical()).append("),\n");tokens.setLength(tokens.length()-2);tokens.append(";final String name;final boolean vertical;Axis(String name,boolean vertical){this.name=name;this.vertical=vertical;}public String getSerializedName(){return name;}public boolean isVertical(){return vertical;}}\npublic enum Direction {\n");
        for(Direction value:Direction.values())tokens.append(value.name()).append('(').append(value.getStepX()).append(',').append(value.getStepY()).append(',').append(value.getStepZ()).append(',').append(literal(value.getSerializedName())).append(",Axis.").append(value.getAxis().name()).append(',').append(value.get2DDataValue()).append("),\n");tokens.setLength(tokens.length()-2);tokens.append(";final int x,y,z,index;final String name;final Axis axis;Direction(int x,int y,int z,String name,Axis axis,int index){this.x=x;this.y=y;this.z=z;this.name=name;this.axis=axis;this.index=index;}public int getStepX(){return x;}public int getStepY(){return y;}public int getStepZ(){return z;}public String getSerializedName(){return name;}public Axis getAxis(){return axis;}public int get2DDataValue(){return index;}}\n");
        tokens.append("public enum WallSide {\n");for(WallSide value:WallSide.values())tokens.append(value.name()).append('(').append(literal(value.getSerializedName())).append("),\n");tokens.setLength(tokens.length()-2);tokens.append(";final String name;WallSide(String name){this.name=name;}public String getSerializedName(){return name;}}\npublic enum RedstoneSide {\n");for(RedstoneSide value:RedstoneSide.values())tokens.append(value.name()).append('(').append(literal(value.getSerializedName())).append("),\n");tokens.setLength(tokens.length()-2);tokens.append(";final String name;RedstoneSide(String name){this.name=name;}public String getSerializedName(){return name;}}\n}\n");Files.writeString(folder.resolve("RotationTokens.java"),tokens);
        Files.writeString(Path.of(args[1]),JSON.toJson(Map.of("scope","pinned-native-rotation-property-handles","blocks",indices,"layouts",layouts))+"\n");System.out.println("Exported "+keys.size()+" block-type property handles in "+layouts.size()+" layouts; no block-state or placement-pair enumeration.");
    }
}
