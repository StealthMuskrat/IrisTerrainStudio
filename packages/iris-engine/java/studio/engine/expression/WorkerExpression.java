// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import com.dfsek.paralithic.Expression;
import com.dfsek.paralithic.functions.dynamic.*;
import static org.objectweb.asm.Opcodes.*;
import java.util.*;

/** Execute the pinned emitter's finite instruction subset, including its DCMPG and branch semantics. */
public final class WorkerExpression implements Expression {
    private final WorkerInstructionBuilder.Instruction[] code;private final int localCount;
    private static final ThreadLocal<int[]> DEPTH=ThreadLocal.withInitial(()->new int[2]);
    private final ThreadLocal<Pool> frames=ThreadLocal.withInitial(Pool::new);
    private static final class Frame {final Object[] stack=new Object[256];final double[] locals;Frame(int locals){this.locals=new double[locals];}}
    private static final class Pool {int depth;final Frame[] retained=new Frame[8];}
    WorkerExpression(WorkerInstructionBuilder.Instruction[] code,int locals){this.code=code;localCount=locals;}
    private static double number(Object value){return ((Number)value).doubleValue();}
    @Override public double evaluate(Context context,double... arguments){
        int[] depth=DEPTH.get();if(depth[0]>=32)throw WorkerExpressions.failure("Expression evaluation exceeds 32 nested calls");if(depth[0]==0)depth[1]=65536;depth[0]++;Pool pool=frames.get();int slot=pool.depth++;Frame frame=slot<8?pool.retained[slot]:null;if(frame==null){frame=new Frame(localCount);if(slot<8)pool.retained[slot]=frame;}Object[] stack=frame.stack;double[] locals=frame.locals;int top=0;
        try{
            for(int pc=0;pc<code.length;pc++){if(--depth[1]<0)throw WorkerExpressions.failure("Expression evaluation exceeds its per-sample work limit");var in=code[pc];int op=in.opcode(),operand=in.operand();
                if(op>=ICONST_M1&&op<=ICONST_5){stack[top++]=op-ICONST_0;continue;}
                switch(op){
                    case DCONST_0 -> stack[top++]=0D;case DCONST_1 -> stack[top++]=1D;case LDC -> stack[top++]=in.value();case SIPUSH,BIPUSH -> stack[top++]=operand;
                    case ALOAD -> stack[top++]=operand==0?this:operand==1?context:arguments;case DLOAD -> stack[top++]=locals[operand];case DSTORE -> locals[operand]=number(stack[--top]);
                    case DALOAD -> {int index=((Number)stack[--top]).intValue();double[] array=(double[])stack[--top];stack[top++]=array[index];}
                    case DASTORE -> {double value=number(stack[--top]);int index=((Number)stack[--top]).intValue();((double[])stack[--top])[index]=value;}
                    case NEWARRAY -> {int length=((Number)stack[--top]).intValue();if(length<0||length>32)throw WorkerExpressions.failure("Expression argument array exceeds 32");stack[top++]=new double[length];}
                    case DUP,DUP2 -> {stack[top]=stack[top-1];top++;}
                    case DADD,DSUB,DMUL,DDIV,DREM,DCMPG -> {double right=number(stack[--top]),left=number(stack[--top]);stack[top++]=switch(op){case DADD->left+right;case DSUB->left-right;case DMUL->left*right;case DDIV->left/right;case DREM->left%right;default->Double.isNaN(left)||Double.isNaN(right)?1D:left>right?1D:left==right?0D:-1D;};}
                    case DNEG -> stack[top-1]=-number(stack[top-1]);case I2D,F2D,L2D -> stack[top-1]=number(stack[top-1]);
                    case GETFIELD -> {top--;stack[top++]=in.value();}
                    case INVOKESTATIC -> {int count=ExpressionMath.arguments(operand);Object[] values=new Object[count];top-=count;System.arraycopy(stack,top,values,0,count);stack[top++]=ExpressionMath.invoke(operand,values);}
                    case INVOKEINTERFACE -> {double[] values=(double[])stack[--top];Context current=(Context)stack[--top];DynamicFunction function=(DynamicFunction)stack[--top];stack[top++]=function.eval(current,values);}
                    case GOTO -> pc=operand-1;
                    case IFEQ,IFNE,IFLT,IFGE,IFGT,IFLE -> {int value=((Number)stack[--top]).intValue();boolean jump=switch(op){case IFEQ->value==0;case IFNE->value!=0;case IFLT->value<0;case IFGE->value>=0;case IFGT->value>0;default->value<=0;};if(jump)pc=operand-1;}
                    case DRETURN -> {if(top!=1)throw WorkerExpressions.failure("Invalid emitted expression stack");return number(stack[0]);}
                    default -> throw WorkerExpressions.failure("Unconnected expression operation");
                }
                if(top<0||top>=stack.length)throw WorkerExpressions.failure("Expression operand stack exceeds 255");
            }throw WorkerExpressions.failure("Expression instruction stream has no return");
        }catch(IndexOutOfBoundsException failure){throw WorkerExpressions.failure("Expression exceeds its operand/local/argument bounds");}
        finally{Arrays.fill(stack,null);Arrays.fill(locals,0D);pool.depth--;depth[0]--;}
    }
}
