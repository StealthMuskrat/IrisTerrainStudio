// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import java.util.*;

/** Native property-handle metadata adapter used by the unchanged native rotation algorithm. */
public class RotationProperty {
    final String name,nativeKind,nativeValueClass;final List<String> serialized;
    protected RotationProperty(String name,String kind,String valueClass,List<String> values){this.name=name;nativeKind=kind;nativeValueClass=valueClass;serialized=List.copyOf(values);}
    public static RotationProperty create(String name,String kind,String valueClass,List<String> values){
        return switch(kind){
            case"net.minecraft.world.level.block.state.properties.BooleanProperty"->new BooleanProperty(name,kind,valueClass,values);
            case"net.minecraft.world.level.block.state.properties.IntegerProperty"->new IntegerProperty(name,kind,valueClass,values);
            case"net.minecraft.world.level.block.state.properties.EnumProperty"->new EnumProperty(name,kind,valueClass,values);
            default->throw studio.engine.UnsupportedPlatform.unavailable("Unconnected native rotation property handle: "+kind);
        };
    }
    public String getName(){return name;}
    public Class<?> getValueClass(){return switch(nativeValueClass){
        case"java.lang.Boolean"->Boolean.class;case"java.lang.Integer"->Integer.class;
        case"net.minecraft.core.Direction"->RotationTokens.Direction.class;case"net.minecraft.core.Direction$Axis"->RotationTokens.Axis.class;
        case"net.minecraft.world.level.block.state.properties.WallSide"->RotationTokens.WallSide.class;case"net.minecraft.world.level.block.state.properties.RedstoneSide"->RotationTokens.RedstoneSide.class;
        default->Other.class;
    };}
    public List<? extends Comparable<?>> getPossibleValues(){List<Comparable<?>> values=new ArrayList<>();for(String value:serialized)values.add(parse(value));return values;}
    Comparable<?> parse(String value){
        if(!serialized.contains(value))throw studio.engine.UnsupportedPlatform.unavailable("Value is outside native rotation property domain");
        Class<?> type=getValueClass();
        if(type==Boolean.class)return Boolean.valueOf(value);if(type==Integer.class)return Integer.valueOf(value);
        if(type==RotationTokens.Direction.class){for(var token:RotationTokens.Direction.values())if(token.getSerializedName().equals(value))return token;}
        if(type==RotationTokens.Axis.class){for(var token:RotationTokens.Axis.values())if(token.getSerializedName().equals(value))return token;}
        if(type==RotationTokens.WallSide.class){for(var token:RotationTokens.WallSide.values())if(token.getSerializedName().equals(value))return token;}
        if(type==RotationTokens.RedstoneSide.class){for(var token:RotationTokens.RedstoneSide.values())if(token.getSerializedName().equals(value))return token;}
        if(type==Other.class)return new Other(this,value);
        throw studio.engine.UnsupportedPlatform.unavailable("Unconnected native property value: "+nativeValueClass);
    }
    String serialize(Comparable<?> value){
        String result=value instanceof RotationTokens.Direction token?token.getSerializedName():value instanceof RotationTokens.Axis token?token.getSerializedName():value instanceof RotationTokens.WallSide token?token.getSerializedName():value instanceof RotationTokens.RedstoneSide token?token.getSerializedName():String.valueOf(value);
        if(!serialized.contains(result)||!getValueClass().isInstance(value)||value instanceof Other token&&token.property!=this)throw studio.engine.UnsupportedPlatform.unavailable("Incompatible native rotation property value");return result;
    }
    /** Captured opaque enum values can be copied; their enum behavior is not simulated. */
    private record Other(RotationProperty property,String value) implements Comparable<Other>{
        @Override public String toString(){return value;}
        @Override public int compareTo(Other other){throw studio.engine.UnsupportedPlatform.unavailable("Opaque native property ordering");}
    }
    public static final class BooleanProperty extends RotationProperty {BooleanProperty(String name,String kind,String valueClass,List<String> values){super(name,kind,valueClass,values);}}
    public static final class IntegerProperty extends RotationProperty {IntegerProperty(String name,String kind,String valueClass,List<String> values){super(name,kind,valueClass,values);}}
    public static final class EnumProperty extends RotationProperty {EnumProperty(String name,String kind,String valueClass,List<String> values){super(name,kind,valueClass,values);}}
}
