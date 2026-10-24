// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import org.teavm.classlib.*;
import org.teavm.model.*;
import java.util.*;

/** Allow only exact native math methods used by the pinned expression dependency. */
public final class ExpressionReflection implements ReflectionSupplier {
    @Override public Collection<String> getAccessibleFields(ReflectionContext context,String name){return List.of();}
    @Override public Collection<MethodDescriptor> getAccessibleMethods(ReflectionContext context,String name){
        if(!name.equals("java.lang.Math")&&!name.equals("com.dfsek.paralithic.functions.natives.NativeMath"))return List.of();ClassReader cls=context.getClassSource().get(name);List<MethodDescriptor> result=new ArrayList<>();
        for(MethodReader method:cls.getMethods()){StringBuilder signature=new StringBuilder("(");boolean doubles=true;for(int i=0;i<method.parameterCount();i++){doubles&=method.parameterType(i).equals(ValueType.DOUBLE);signature.append('D');}if(!doubles)continue;signature.append(')').append(method.getResultType().equals(ValueType.DOUBLE)?'D':method.getResultType().equals(ValueType.LONG)?'J':'?');String key=name.replace('.','/')+"."+method.getName()+signature;for(String allowed:ExpressionMath.KEYS)if(allowed.equals(key)){result.add(method.getDescriptor());break;}}return result;
    }
    @Override public boolean isClassFoundByName(ReflectionContext context,String name){return false;}
}
