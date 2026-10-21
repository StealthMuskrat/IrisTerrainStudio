// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.expression;
import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.*;

/** Native parser/emitter plus bounded worker execution, without runtime JVM class definition. */
public final class ExpressionPlatformPlugin implements TeaVMPlugin {
    @Override public void install(TeaVMHost host){host.add((cls,context)->{
        if(cls.getName().equals("com.dfsek.paralithic.eval.ExpressionBuilder")){
            int entries=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("get")){
                Program p=new Program();Variable self=p.createVariable(),root=p.createVariable(),functions=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();GetFieldInstruction get=new GetFieldInstruction();get.setField(new FieldReference(cls.getName(),"functions"));get.setFieldType(ValueType.object("java.util.Map"));get.setInstance(self);get.setReceiver(functions);b.add(get);InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.expression.WorkerExpressions","compile",ValueType.object("com.dfsek.paralithic.node.Node"),ValueType.object("java.util.Map"),ValueType.object("com.dfsek.paralithic.Expression")));call.setArguments(root,functions);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);entries++;
            }if(entries!=1)throw new IllegalStateException("Pinned native expression builder changed");
        }
        if(cls.getName().equals("com.dfsek.paralithic.node.special.function.NativeFunctionNode")){
            int metadata=0,invocations=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext())if(i instanceof InvokeInstruction call){MethodReference ref=call.getMethod();
                if(ref.getClassName().equals("java.lang.reflect.Method")&&ref.getName().equals("getParameters")){Variable nativeMethod=call.getInstance();call.setInstance(null);call.setArguments(nativeMethod);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.expression.ExpressionParameters","parameters",ValueType.object("java.lang.reflect.Method"),ValueType.arrayOf(ValueType.object("studio.engine.expression.ExpressionParameters$Parameter"))));metadata++;}
                if(ref.getClassName().equals("java.lang.reflect.Method")&&ref.getName().equals("invoke")){java.util.List<Variable> args=new java.util.ArrayList<>();args.add(call.getInstance());args.addAll(call.getArguments());call.setInstance(null);call.setArguments(args.toArray(Variable[]::new));call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.expression.ExpressionReflect","invoke",ValueType.object("java.lang.reflect.Method"),ValueType.object("java.lang.Object"),ValueType.arrayOf(ValueType.object("java.lang.Object")),ValueType.object("java.lang.Object")));invocations++;}
                if(ref.getClassName().equals("java.lang.reflect.Parameter"))call.setMethod(new MethodReference("studio.engine.expression.ExpressionParameters$Parameter",ref.getDescriptor()));
            }}if(metadata!=1||invocations!=2)throw new IllegalStateException("Pinned native expression method metadata changed: "+metadata+","+invocations);
        }
        if(cls.getName().equals("art.arcane.iris.generation.noise.IrisExpressionLoad")){
            int mandatory=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext())if(i instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("art.arcane.volmlib.util.cache.AtomicCache")&&call.getMethod().getName().equals("aquire")){call.setMethod(new MethodReference(call.getMethod().getClassName(),new MethodDescriptor("aquireOrThrow",call.getMethod().getSignature())));mandatory++;}}if(mandatory!=4)throw new IllegalStateException("Pinned mandatory expression-variable caches changed: "+mandatory);
        }
        if(cls.getName().equals("art.arcane.iris.generation.noise.IrisExpression")){
            int admissions=0,reports=0,caches=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;
                if(method.getName().startsWith("lambda$expression$")){InvokeInstruction admit=new InvokeInstruction();admit.setType(InvocationType.SPECIAL);admit.setMethod(new MethodReference("studio.engine.expression.WorkerExpressions","admit",ValueType.object(cls.getName()),ValueType.VOID));admit.setArguments(p.variableAt(0));p.basicBlockAt(0).getFirstInstruction().insertPrevious(admit);admissions++;}
                if(method.getName().equals("expression"))for(int i=0;i<p.basicBlockCount();i++)for(Instruction instruction=p.basicBlockAt(i).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("art.arcane.volmlib.util.cache.AtomicCache")&&call.getMethod().getName().equals("aquire")){call.setMethod(new MethodReference(call.getMethod().getClassName(),new MethodDescriptor("aquireOnceOrThrow",call.getMethod().getSignature())));caches++;}
                for(int i=0;i<p.basicBlockCount();i++)for(Instruction instruction=p.basicBlockAt(i).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("art.arcane.iris.spi.IrisLogging")&&call.getMethod().getName().equals("reportError")){call.setMethod(new MethodReference("studio.engine.expression.WorkerExpressions","report",ValueType.object("java.lang.String"),ValueType.object("java.lang.Throwable"),ValueType.VOID));reports++;}
            }if(admissions!=1||reports!=2||caches!=1)throw new IllegalStateException("Pinned Iris expression initialization changed: "+admissions+","+reports+","+caches);
        }
    });}
}
