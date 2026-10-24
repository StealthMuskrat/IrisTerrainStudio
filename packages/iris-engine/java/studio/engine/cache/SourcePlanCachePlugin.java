// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.cache;
import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.*;

/** Redirect only the native cache's platform storage, counters and completion ABI. */
public final class SourcePlanCachePlugin implements TeaVMPlugin {
    private static final String PREFIX="art.arcane.iris.generation.mantle.ObjectSourcePlanCache";
    @Override public void install(TeaVMHost host){host.add((cls,context)->{
        if(!cls.getName().equals(PREFIX)&&!cls.getName().startsWith(PREFIX+"$"))return;
        String[][] mappings={
            {"com.github.benmanes.caffeine.cache.Cache","studio.engine.cache.WorkerSourcePlanStore"},
            {"com.github.benmanes.caffeine.cache.Caffeine","studio.engine.cache.WorkerSourcePlanStore$Builder"},
            {"com.github.benmanes.caffeine.cache.Policy","studio.engine.cache.WorkerSourcePlanStore$Policy"},
            {"com.github.benmanes.caffeine.cache.Policy$Eviction","studio.engine.cache.WorkerSourcePlanStore$Eviction"},
            {"java.util.concurrent.atomic.LongAdder","studio.engine.cache.WorkerPlanCounter"},
            {"java.util.concurrent.CompletableFuture","studio.engine.cache.WorkerPlanCompletion"},
            {"java.util.concurrent.CompletionException","studio.engine.cache.WorkerPlanCompletionException"}
        };
        for(String[] mapping:mappings)replace(cls,mapping[0],mapping[1]);
    });}
    private static ValueType type(ValueType value,String from,String to){return value.equals(ValueType.object(from))?ValueType.object(to):value;}
    private static void replace(ClassHolder cls,String from,String to){
        for(FieldHolder field:cls.getFields())if(field.getType().equals(ValueType.object(from))){field.setType(ValueType.object(to));field.setGenericType(null);}
        for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++){for(TryCatchBlock handler:p.basicBlockAt(b).getTryCatchBlocks())if(from.equals(handler.getExceptionType()))handler.setExceptionType(to);for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext()){
            if(i instanceof ConstructInstruction construct&&construct.getType().equals(from))construct.setType(to);
            if(i instanceof GetFieldInstruction get)get.setFieldType(type(get.getFieldType(),from,to));
            if(i instanceof PutFieldInstruction put)put.setFieldType(type(put.getFieldType(),from,to));
            if(i instanceof CastInstruction cast)cast.setTargetType(type(cast.getTargetType(),from,to));
            if(i instanceof IsInstanceInstruction check)check.setType(type(check.getType(),from,to));
            if(i instanceof InvokeInstruction call){MethodReference ref=call.getMethod();ValueType[] signature=ref.getSignature();for(int n=0;n<signature.length;n++)signature[n]=type(signature[n],from,to);call.setMethod(new MethodReference(ref.getClassName().equals(from)?to:ref.getClassName(),new MethodDescriptor(ref.getName(),signature)));}
        }}}
        for(MethodHolder old:new java.util.ArrayList<>(cls.getMethods())){
            ValueType[] signature=old.getDescriptor().getSignature();boolean changed=false;for(int n=0;n<signature.length;n++){ValueType replacement=type(signature[n],from,to);changed|=!replacement.equals(signature[n]);signature[n]=replacement;}if(!changed)continue;
            MethodHolder method=new MethodHolder(new MethodDescriptor(old.getName(),signature));method.setLevel(old.getLevel());method.getModifiers().addAll(old.getModifiers());method.setProgram(old.getProgram());method.setThrownTypes(old.getThrownTypes());method.setAnnotationDefault(old.getAnnotationDefault());org.teavm.model.util.ModelUtils.copyAnnotations(old.getAnnotations(),method.getAnnotations());for(int n=0;n<old.parameterCount();n++)org.teavm.model.util.ModelUtils.copyAnnotations(old.parameterAnnotation(n),method.parameterAnnotation(n));cls.removeMethod(old);cls.addMethod(method);
        }
    }
}
