// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import org.objectweb.asm.*;
import static org.objectweb.asm.Opcodes.*;
import com.dfsek.paralithic.functions.dynamic.*;
import java.util.*;

/** Collect the original node emitter's instructions; reject unsupported operations before evaluation. */
public final class WorkerInstructionBuilder extends MethodVisitor {
    public static final String OWNER="studio/engine/expression/WorkerExpression";
    record Instruction(int opcode,int operand,Object value){}
    private final List<Instruction> code=new ArrayList<>();
    private final Map<Label,Integer> labels=new IdentityHashMap<>();
    private final Map<String,DynamicFunction> functions;
    private int locals=3;
    public WorkerInstructionBuilder(Map<String,DynamicFunction> functions){super(ASM9);this.functions=new LinkedHashMap<>(functions);}
    private void add(int op,int operand,Object value){if(code.size()>=2048)throw WorkerExpressions.failure("Expression exceeds 2048 emitted instructions");code.add(new Instruction(op,operand,value));}
    @Override public void visitInsn(int op){if(!Set.of(ICONST_M1,ICONST_0,ICONST_1,ICONST_2,ICONST_3,ICONST_4,ICONST_5,DCONST_0,DCONST_1,DALOAD,DASTORE,DUP,DUP2,DADD,DSUB,DMUL,DDIV,DREM,DNEG,DCMPG,I2D,F2D,L2D).contains(op))throw WorkerExpressions.failure("Unconnected expression instruction: "+op);add(op,0,null);}
    @Override public void visitVarInsn(int op,int index){if(index<0||index>=131||op!=ALOAD&&op!=DLOAD&&op!=DSTORE||op==ALOAD&&index>2)throw WorkerExpressions.failure("Unconnected expression local access");locals=Math.max(locals,index+2);add(op,index,null);}
    @Override public void visitIntInsn(int op,int value){if(op!=SIPUSH&&op!=BIPUSH&&!(op==NEWARRAY&&value==T_DOUBLE))throw WorkerExpressions.failure("Unconnected expression integer instruction");add(op,value,null);}
    @Override public void visitLdcInsn(Object value){if(!(value instanceof Double))throw WorkerExpressions.failure("Unconnected expression constant");add(LDC,0,value);}
    @Override public void visitJumpInsn(int op,Label target){if(!Set.of(IFEQ,IFNE,IFLT,IFGE,IFGT,IFLE,GOTO).contains(op))throw WorkerExpressions.failure("Unconnected expression branch");add(op,0,target);}
    @Override public void visitLabel(Label label){if(labels.put(label,code.size())!=null)throw WorkerExpressions.failure("Repeated expression label");}
    @Override public void visitFieldInsn(int op,String owner,String name,String descriptor){if(op!=GETFIELD||!owner.equals(OWNER)||!descriptor.equals("Lcom/dfsek/paralithic/functions/dynamic/DynamicFunction;")||!functions.containsKey(name))throw WorkerExpressions.failure("Unconnected expression field");add(op,0,functions.get(name));}
    @Override public void visitMethodInsn(int op,String owner,String name,String descriptor,boolean isInterface){
        if(op==INVOKESTATIC)add(op,ExpressionMath.resolve(owner,name,descriptor),null);
        else if(op==INVOKEINTERFACE&&owner.equals("com/dfsek/paralithic/functions/dynamic/DynamicFunction")&&name.equals("eval")&&descriptor.equals("(Lcom/dfsek/paralithic/functions/dynamic/Context;[D)D"))add(op,0,null);
        else throw WorkerExpressions.failure("Unconnected expression invocation");
    }
    public WorkerExpression finish(){
        add(DRETURN,0,null);for(int i=0;i<code.size();i++){var instruction=code.get(i);if(instruction.value() instanceof Label label){Integer target=labels.get(label);if(target==null||target<=i||target>=code.size())throw WorkerExpressions.failure("Expression branch must have a forward destination");code.set(i,new Instruction(instruction.opcode(),target,null));}}
        return new WorkerExpression(code.toArray(Instruction[]::new),locals);
    }
}
