// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import java.lang.reflect.*;
/** Scoped JDK math service correction, also used by native parse-time constant folding. */
public final class ExpressionReflect {
    public static Object invoke(Method method,Object receiver,Object[] arguments)throws InvocationTargetException,IllegalAccessException{
        if(method.getDeclaringClass()==Math.class&&method.getName().equals("round")&&method.getParameterTypes().length==1&&method.getParameterTypes()[0]==double.class)return WorkerJdkRound.round(((Number)arguments[0]).doubleValue());
        return method.invoke(receiver,arguments);
    }
}
