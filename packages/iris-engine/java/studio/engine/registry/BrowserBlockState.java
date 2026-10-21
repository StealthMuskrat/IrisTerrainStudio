// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
import art.arcane.volmlib.nativelib.terrain.*;
import java.util.Map;

/** Native platform state semantics, with the exported physical state as the owned handle. */
final class BrowserBlockState implements NativeBlockState {
    final BrowserRegistries owner;final BrowserRegistries.State state;final Map<String,String> parsed;
    BrowserBlockState(BrowserRegistries owner,BrowserRegistries.State state,Map<String,String> parsed){this.owner=owner;this.state=state;this.parsed=parsed;}
    @Override public String key(){return state.key;}
    @Override public String namespace(){return BlockStateKey.namespace(key());}
    @Override public String materialKey(){int bracket=state.key.indexOf('[');return bracket<0?state.key:state.key.substring(0,bracket);}
    private boolean flag(int index){return(state.flags&(1<<index))!=0;}
    @Override public boolean isAir(){return flag(0);}
    @Override public boolean isSolid(){return flag(1);}
    @Override public boolean isOccluding(){return flag(2);}
    @Override public boolean isFluid(){return flag(3);}
    @Override public boolean isWater(){return flag(4);}
    @Override public boolean isWaterLogged(){return flag(5);}
    @Override public boolean isLit(){return flag(6);}
    @Override public boolean isUpdatable(){return flag(7);}
    @Override public boolean isFoliage(){return flag(8);}
    @Override public boolean isTreeBlock(){return flag(9);}
    @Override public boolean isFoliagePlantable(){return flag(10);}
    @Override public boolean isDecorant(){return flag(11);}
    @Override public boolean isStorage(){return flag(12);}
    @Override public boolean isStorageChest(){return flag(13);}
    @Override public boolean isOre(){return flag(14);}
    @Override public boolean isDeepSlate(){return flag(15);}
    @Override public boolean isVineBlock(){return flag(16);}
    @Override public boolean hasTileEntity(){return flag(17);}
    @Override public boolean isCustom(){return false;}
    @Override public boolean canPlaceOnto(NativeBlockState onto){return owner.canPlace(this,onto);}
    @Override public boolean matches(NativeBlockState other){if(!(other instanceof BrowserBlockState value)||value.owner!=owner||value.state.type!=state.type)return false;if(value.state==state)return true;if(value.parsed==null)return false;String key=key();for(var property:value.parsed.entrySet())key=BlockStateKey.withProperty(key,property.getKey(),property.getValue());return key.equals(key());}
    @Override public NativeBlockState withProperty(String name,String value){return owner.decodeBlockState(BlockStateKey.withProperty(key(),name,value));}
    public RotationState handle(){return owner.rotationHandle(state);}
    public Map<String,String> parsedProperties(){return parsed;}
    public BrowserBlockState withHandle(RotationState updated,Map<String,String> properties){
        if(updated.owner!=owner)throw studio.engine.UnsupportedPlatform.unavailable("Rotation state belongs to another registry");
        return updated.state==state&&properties==parsed?this:owner.intern(updated.state,properties);
    }
    @Override public Object nativeHandle(){return state;}
    @Override public boolean equals(Object other){return other instanceof BrowserBlockState value&&owner==value.owner&&state==value.state;}
    @Override public int hashCode(){return state.id;}
}
