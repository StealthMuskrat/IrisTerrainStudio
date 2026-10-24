// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import java.util.*;

/** Owned physical state handle; mutations do not alter native first-parse matching masks. */
public final class RotationState {
    final BrowserRegistries owner;final BrowserRegistries.State state;
    RotationState(BrowserRegistries owner,BrowserRegistries.State state){this.owner=owner;this.state=state;}
    public Collection<RotationProperty> getProperties(){return owner.rotationProperties(state.type);}
    public Comparable<?> getValue(RotationProperty property){return property.parse(state.values[index(property)]);}
    public Object setValue(RotationProperty property,Comparable<?> value){
        int index=index(property);String[] values=state.values.clone();values[index]=property.serialize(value);return owner.rotationState(state.type,values);
    }
    private int index(RotationProperty property){
        if(!getProperties().contains(property))throw studio.engine.UnsupportedPlatform.unavailable("Rotation property belongs to another block type");
        int index=Arrays.asList(owner.rotationType(state.type).order).indexOf(property.name);if(index<0)throw studio.engine.UnsupportedPlatform.unavailable("Missing native rotation property");return index;
    }
    public Block getBlock(){return owner.rotationBlock(state.type);}
    public static final class Block {
        final BrowserRegistries owner;final int type;Block(BrowserRegistries owner,int type){this.owner=owner;this.type=type;}
        public RotationState defaultBlockState(){return owner.rotationHandle(owner.rotationDefault(type));}
    }
}
