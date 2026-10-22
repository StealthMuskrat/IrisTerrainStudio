// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.*;

/** Original hydrology algorithms with owned worker cache/task services. */
public final class HydrologyPlatformPlugin implements TeaVMPlugin {
    private static final String DISPATCH="studio.engine.hydrology.WorkerHydrologyDispatch";
    @Override public void install(TeaVMHost host){host.add((cls,context)->{
        String name=cls.getName();
        boolean caveView=name.equals("art.arcane.iris.generation.mantle.MantleHydrologyCaveVoxelView");
        boolean hydrology=caveView||name.startsWith("art.arcane.iris.generation.hydrology.")||name.startsWith("art.arcane.iris.generation.runtime.HydrologyNoiseCacheBudget");
        if(!hydrology&&!name.equals("art.arcane.iris.configuration.IrisSettings"))return;
        if(hydrology){
            String[][] mappings={
                {"com.github.benmanes.caffeine.cache.Cache","studio.engine.hydrology.WorkerHydrologyStore"},
                {"com.github.benmanes.caffeine.cache.Caffeine","studio.engine.hydrology.WorkerHydrologyStore$Builder"},
                {"com.github.benmanes.caffeine.cache.Policy","studio.engine.cache.WorkerSourcePlanStore$Policy"},
                {"com.github.benmanes.caffeine.cache.Policy$Eviction","studio.engine.cache.WorkerSourcePlanStore$Eviction"},
                {"java.util.concurrent.CompletableFuture","studio.engine.hydrology.WorkerHydrologyCompletion"},
                {"java.util.concurrent.CompletionException","studio.engine.cache.WorkerPlanCompletionException"},
                {"java.util.concurrent.RejectedExecutionException","studio.engine.hydrology.WorkerHydrologyRejectedException"},
                {"java.util.concurrent.CountDownLatch",DISPATCH+"$Latch"},
                {"java.util.concurrent.ConcurrentLinkedQueue",DISPATCH+"$Queue"},
                {"java.util.concurrent.ConcurrentHashMap$KeySetView","java.util.Set"},
                {"java.util.concurrent.Semaphore","studio.engine.terrain.WorkerSemaphore"},
                {"java.util.concurrent.atomic.AtomicReferenceArray","studio.engine.WorkerReferenceArray"},
                {"java.util.concurrent.ForkJoinPool$ManagedBlocker",DISPATCH+"$ManagedBlocker"},
                {"java.util.concurrent.ForkJoinWorkerThread",DISPATCH+"$PoolThread"},
                {"java.util.concurrent.ForkJoinPool",DISPATCH+"$Pool"},
                {"art.arcane.iris.generation.concurrent.MultiBurst",DISPATCH}
            };
            for(String[] mapping:mappings)replace(cls,mapping[0],mapping[1]);
        }
        int prefetchFields=0,storageHandles=0,storageNullChecks=0,heights=0,flags=0,matterReads=0,carvingInputs=0,completions=0;
        for(MethodHolder method:cls.getMethods()){
            Program program=method.getProgram();if(program==null)continue;
            if(caveView&&method.getName().equals("generateCarvingInput")){
                InvokeInstruction prepare=new InvokeInstruction();prepare.setType(InvocationType.SPECIAL);prepare.setMethod(new MethodReference("studio.engine.hydrology.WorkerHydrologyMatter","prepareCarvingInput",ValueType.INTEGER,ValueType.INTEGER,ValueType.VOID));prepare.setArguments(program.variableAt(3),program.variableAt(4));program.basicBlockAt(0).getFirstInstruction().insertPrevious(prepare);carvingInputs++;
            }
            if(name.equals("art.arcane.iris.generation.hydrology.HydrologyTileCache")&&method.getName().equals("planRequired")){
                InvokeInstruction admission=new InvokeInstruction();admission.setType(InvocationType.SPECIAL);admission.setMethod(new MethodReference("studio.engine.hydrology.WorkerHydrologyBudget","admit",ValueType.object("art.arcane.iris.generation.hydrology.HydrologyTileKey"),ValueType.VOID));admission.setArguments(program.variableAt(1));program.basicBlockAt(0).getFirstInstruction().insertPrevious(admission);
            }
            if(name.equals("art.arcane.iris.generation.hydrology.HydrologyTileCache")&&java.util.Set.of("enableSharedCache","preparePregeneration","awaitPlanningRetry").contains(method.getName())){
                unavailable(method,"Hydrology saved-world persistence, pregeneration or retry waits");continue;
            }
            for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;){Instruction next=instruction.getNext();
                if(name.equals("art.arcane.iris.generation.hydrology.runtime.IrisHydrologyRuntime")&&method.getName().equals("<init>")&&instruction instanceof GetFieldInstruction field&&field.getField().equals(new FieldReference(DISPATCH,"hydrology"))){
                    // First read selects the native inline-cache constructor branch; the second reports thread count.
                    if(prefetchFields++==0){NullConstantInstruction value=new NullConstantInstruction();value.setReceiver(field.getReceiver());instruction.replace(value);}
                }else if(instruction instanceof InvokeInstruction call){
                    MethodReference reference=call.getMethod();String target=null;
                    if(name.equals("art.arcane.iris.generation.hydrology.HydrologyForkJoin$Task")&&method.getName().equals("await")&&method.parameterCount()==1&&reference.getClassName().equals(name)&&reference.getName().equals("isReleasable")){
                        Variable latch=program.createVariable();GetFieldInstruction get=new GetFieldInstruction();get.setInstance(call.getInstance());get.setField(new FieldReference(name,"complete"));get.setFieldType(ValueType.object(DISPATCH+"$Latch"));get.setReceiver(latch);call.insertPrevious(get);
                        InvokeInstruction guard=new InvokeInstruction();guard.setType(InvocationType.SPECIAL);guard.setMethod(new MethodReference(DISPATCH,"requireComplete",ValueType.object(DISPATCH+"$Latch"),ValueType.VOID));guard.setArguments(latch);call.insertPrevious(guard);completions++;
                    }
                    if(caveView){
                        String owner=null;
                        if(reference.getClassName().equals("art.arcane.iris.generation.mantle.EngineMantle")&&reference.getName().equals("getMantle")){owner="studio.engine.terrain.WorkerCaveStorage";target="getMantle";storageHandles++;}
                        else if(reference.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&reference.getName().equals("getWorldHeight")){owner="studio.engine.terrain.WorkerCaveStorage";target="getWorldHeight";heights++;}
                        else if(reference.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&reference.getName().equals("hasFlag")){owner="studio.engine.hydrology.WorkerHydrologyMatter";target="hasFlag";flags++;}
                        else if(reference.getClassName().equals("art.arcane.iris.generation.mantle.TerrainMatterView")&&reference.getName().equals("get")&&reference.parameterType(0).equals(ValueType.object("art.arcane.volmlib.util.mantle.runtime.Mantle"))){owner="studio.engine.hydrology.WorkerHydrologyMatter";target="terrainMatter";matterReads++;}
                        else if(method.getName().equals("<init>")&&method.parameterCount()==3&&method.parameterType(0).equals(ValueType.object("art.arcane.volmlib.util.mantle.runtime.Mantle"))&&reference.getClassName().equals("java.util.Objects")&&reference.getName().equals("requireNonNull")&&storageNullChecks==0){owner="studio.engine.hydrology.WorkerHydrologyMatter";target="storageHandle";storageNullChecks++;}
                        if(owner!=null){redirect(call,owner,target);instruction=next;continue;}
                    }
                    if(reference.getClassName().equals("java.lang.Runtime")){
                        if(reference.getName().equals("maxMemory"))target="maximumHeap";
                        else if(reference.getName().equals("availableProcessors"))target="processors";
                    }
                    if(target!=null){call.setInstance(null);call.setArguments();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(DISPATCH,target,reference.getReturnType()));}
                    if(reference.getClassName().equals("java.util.concurrent.ConcurrentHashMap")&&reference.getName().equals("newKeySet")){call.setMethod(new MethodReference(DISPATCH,"newKeySet",ValueType.object("java.util.Set")));}
                    if(reference.getClassName().equals("java.util.concurrent.ForkJoinPool")&&reference.getName().equals("managedBlock")){call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(DISPATCH,reference.getDescriptor()));}
                }
                instruction=next;
            }
        }
        if(name.equals("art.arcane.iris.generation.hydrology.runtime.IrisHydrologyRuntime")&&prefetchFields!=2)throw new IllegalStateException("Pinned hydrology planning executor boundary changed");
        if(caveView&&(storageHandles!=6||storageNullChecks!=1||heights!=2||flags!=1||matterReads!=1||carvingInputs!=1))throw new IllegalStateException("Pinned hydrology cave storage boundary changed: "+storageHandles+","+storageNullChecks+","+heights+","+flags+","+matterReads+","+carvingInputs);
        if(name.equals("art.arcane.iris.generation.hydrology.HydrologyForkJoin$Task")&&completions!=1)throw new IllegalStateException("Pinned native hydrology task wait boundary changed");
    });}
    private static void redirect(InvokeInstruction call,String owner,String name){
        MethodReference reference=call.getMethod();var arguments=new java.util.ArrayList<Variable>(call.getArguments());ValueType[] original=reference.getSignature(),signature;
        if(call.getInstance()!=null){arguments.add(0,call.getInstance());signature=new ValueType[original.length+1];signature[0]=ValueType.object(reference.getClassName());System.arraycopy(original,0,signature,1,original.length);}else signature=original;
        call.setInstance(null);call.setArguments(arguments.toArray(Variable[]::new));call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(owner,name,signature));
    }
    private static ValueType type(ValueType value,String from,String to){if(value.equals(ValueType.object(from)))return ValueType.object(to);if(value instanceof ValueType.Array array)return ValueType.arrayOf(type(array.getItemType(),from,to));return value;}
    private static void replace(ClassHolder cls,String from,String to){
        if(cls.getInterfaces().remove(from))cls.getInterfaces().add(to);
        for(FieldHolder field:cls.getFields()){ValueType mapped=type(field.getType(),from,to);if(!mapped.equals(field.getType())){field.setType(mapped);field.setGenericType(null);}}
        for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++){for(TryCatchBlock handler:p.basicBlockAt(b).getTryCatchBlocks())if(from.equals(handler.getExceptionType()))handler.setExceptionType(to);for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext()){
            if(i instanceof ConstructInstruction construct&&construct.getType().equals(from))construct.setType(to);
            if(i instanceof ClassConstantInstruction value)value.setConstant(type(value.getConstant(),from,to));
            if(i instanceof InitClassInstruction init&&init.getClassName().equals(from))init.setClassName(to);
            if(i instanceof ConstructArrayInstruction array)array.setItemType(type(array.getItemType(),from,to));
            if(i instanceof GetFieldInstruction get){get.setFieldType(type(get.getFieldType(),from,to));if(get.getField().getClassName().equals(from))get.setField(new FieldReference(to,get.getField().getFieldName()));}
            if(i instanceof PutFieldInstruction put){put.setFieldType(type(put.getFieldType(),from,to));if(put.getField().getClassName().equals(from))put.setField(new FieldReference(to,put.getField().getFieldName()));}
            if(i instanceof CastInstruction cast)cast.setTargetType(type(cast.getTargetType(),from,to));
            if(i instanceof IsInstanceInstruction check)check.setType(type(check.getType(),from,to));
            if(i instanceof InvokeInstruction call){MethodReference ref=call.getMethod();ValueType[] signature=ref.getSignature();for(int n=0;n<signature.length;n++)signature[n]=type(signature[n],from,to);call.setMethod(new MethodReference(ref.getClassName().equals(from)?to:ref.getClassName(),new MethodDescriptor(ref.getName(),signature)));}
        }}}
        for(MethodHolder old:new java.util.ArrayList<>(cls.getMethods())){
            ValueType[] signature=old.getDescriptor().getSignature();boolean changed=false;for(int n=0;n<signature.length;n++){ValueType replacement=type(signature[n],from,to);changed|=!replacement.equals(signature[n]);signature[n]=replacement;}if(!changed)continue;
            MethodHolder method=new MethodHolder(new MethodDescriptor(old.getName(),signature));method.setLevel(old.getLevel());method.getModifiers().addAll(old.getModifiers());method.setProgram(old.getProgram());method.setThrownTypes(old.getThrownTypes());method.setAnnotationDefault(old.getAnnotationDefault());org.teavm.model.util.ModelUtils.copyAnnotations(old.getAnnotations(),method.getAnnotations());for(int n=0;n<old.parameterCount();n++)org.teavm.model.util.ModelUtils.copyAnnotations(old.parameterAnnotation(n),method.parameterAnnotation(n));cls.removeMethod(old);cls.addMethod(method);
        }
    }
    private static void unavailable(MethodHolder method,String feature){
        Program p=new Program();p.createVariable();for(int i=0;i<method.parameterCount();i++)p.createVariable();Variable text=p.createVariable(),failure=p.createVariable();BasicBlock block=p.createBasicBlock();StringConstantInstruction value=new StringConstantInstruction();value.setReceiver(text);value.setConstant(feature);block.add(value);InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.UnsupportedPlatform","unavailable",ValueType.object("java.lang.String"),ValueType.object("java.lang.RuntimeException")));call.setArguments(text);call.setReceiver(failure);block.add(call);RaiseInstruction raise=new RaiseInstruction();raise.setException(failure);block.add(raise);method.setProgram(p);
    }
}
