// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;
import org.teavm.classlib.*;
import org.teavm.model.*;
import studio.engine.config.NativeConfigMetadata;
import java.util.*;

/** Preserve native field/generic/annotation reflection for the actual compatibility walker. */
public final class NativeConfigReflection implements ReflectionSupplier {
    @Override public Collection<String> getAccessibleFields(ReflectionContext context,String name){
        if(!NativeConfigMetadata.TYPES.contains(name))return List.of();ClassReader type=context.getClassSource().get(name);if(type==null)throw new IllegalStateException("Missing native reflection class: "+name);
        List<String> fields=new ArrayList<>();for(FieldReader field:type.getFields())if(!field.hasModifier(ElementModifier.STATIC)&&!field.hasModifier(ElementModifier.TRANSIENT)&&!field.hasModifier(ElementModifier.SYNTHETIC))fields.add(field.getName());return fields;
    }
    @Override public Collection<MethodDescriptor> getAccessibleMethods(ReflectionContext context,String name){return NativeConfigMetadata.TYPES.contains(name)?List.of(new MethodDescriptor("<init>",ValueType.VOID)):List.of();}
    @Override public boolean isClassFoundByName(ReflectionContext context,String name){return NativeConfigMetadata.TYPES.contains(name);}
}
