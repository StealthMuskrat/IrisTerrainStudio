// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import java.lang.reflect.Method;
/** Bind the emitter's Parameter.getType metadata query to supported native Method parameter types. */
public final class ExpressionParameters {
    public record Parameter(Class<?> type){public Class<?> getType(){return type;}}
    public static Parameter[] parameters(Method method){Class<?>[] types=method.getParameterTypes();Parameter[] result=new Parameter[types.length];for(int i=0;i<types.length;i++)result[i]=new Parameter(types[i]);return result;}
}
