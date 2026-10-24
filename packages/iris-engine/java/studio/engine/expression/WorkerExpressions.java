// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import art.arcane.iris.generation.noise.IrisExpression;
import studio.engine.pack.MemoryPack;
import com.dfsek.paralithic.node.*;
import com.dfsek.paralithic.functions.dynamic.DynamicFunction;
import com.dfsek.paralithic.Expression;
import java.util.*;

/** Admission, failure propagation and dynamic-class replacement; native parsing/emission stay intact. */
public final class WorkerExpressions {
    public static IllegalArgumentException failure(String reason){return new IllegalArgumentException(reason,new Error("Browser expression boundary"));}
    public static void report(String message,Throwable error){throw new IllegalArgumentException(message+" "+error.getMessage(),new Error("Native expression failed",error));}
    public static void admit(IrisExpression expression){
        String text=expression.getExpression();if(text==null||text.length()>4096||expression.getVariables().size()>64||expression.getFunctions().size()>32)throw failure("Expression exceeds text/variable/function bounds");
        int depth=0;for(int i=0;i<text.length();i++){char c=text.charAt(i);if(c=='('&&++depth>64)throw failure("Expression nesting exceeds 64");if(c==')')depth--;}
        for(var function:expression.getFunctions())if(function.getArgNumber()>32)throw failure("Expression function exceeds 32 arguments");
        MemoryPack.owner(expression.getLoader()).reserveExpression(65536L+32L*text.length());
    }
    public static Expression compile(Node root,Map<String,DynamicFunction> functions){
        WorkerInstructionBuilder builder=new WorkerInstructionBuilder(functions);NodeUtils.simplify(root).apply(builder,WorkerInstructionBuilder.OWNER);return builder.finish();
    }
}
