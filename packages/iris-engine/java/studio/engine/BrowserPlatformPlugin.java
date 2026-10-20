// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;

import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.TeaVMHost;
import org.teavm.vm.spi.TeaVMPlugin;

/** Browsers have no Java FFM backend. Select the original Billow Java branch in bytecode. */
public final class BrowserPlatformPlugin implements TeaVMPlugin {
    private static final String OWNER = "art.arcane.volmlib.util.noise.FractalBillowSimplexNoise";
    @Override
    public void install(TeaVMHost host) {
        host.add((cls, context) -> {
            String name = cls.getName();
            if (name.startsWith("art.arcane.volmlib.util.noise.") && java.util.Set.of("MarbleNoise", "GaborNoise", "QuasicrystalNoise", "GyroidNoise", "StrataNoise").contains(name.substring(name.lastIndexOf('.') + 1))) {
                int allocations = 0;
                for (MethodHolder method : cls.getMethods()) {
                    Program program = method.getProgram(); if (program == null) continue;
                    for (int b = 0; b < program.basicBlockCount(); b++) for (Instruction instruction = program.basicBlockAt(b).getFirstInstruction(); instruction != null; instruction = instruction.getNext()) {
                        if (instruction instanceof ConstructInstruction construct && construct.getType().equals("java.util.SplittableRandom")) { construct.setType("studio.engine.SplittableCompat"); allocations++; }
                        if (instruction instanceof InvokeInstruction call && call.getMethod().getClassName().equals("java.util.SplittableRandom")) call.setMethod(new MethodReference("studio.engine.SplittableCompat", call.getMethod().getDescriptor()));
                    }
                }
                if (allocations != 1) throw new IllegalStateException("Pinned SplittableRandom allocation changed in " + name);
            }
            if (name.equals("art.arcane.volmlib.util.noise.OffsetNoiseGenerator")) {
                int changed = 0;
                for (MethodHolder method : cls.getMethods()) {
                    Program program=method.getProgram();if(program==null)continue;
                    for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext()) {
                        if(instruction instanceof InvokeInstruction call && call.getMethod().getClassName().equals("art.arcane.volmlib.util.math.RNG") && call.getMethod().getName().equals("nextInt") && call.getMethod().parameterCount()==2) {
                            Variable instance=call.getInstance(),origin=call.getArguments().get(0),bound=call.getArguments().get(1);
                            call.setInstance(null);call.setArguments(instance,origin,bound);call.setType(InvocationType.SPECIAL);
                            call.setMethod(new MethodReference(RandomRangeCompat.class,"nextInt",java.util.Random.class,int.class,int.class,int.class));changed++;
                        }
                    }
                }
                if(changed!=2)throw new IllegalStateException("Pinned noise offset range calls changed: "+changed);
            }
            if (name.equals("art.arcane.iris.generation.noise.IrisGenerator$SurfaceCacheStripe")) {
                String original="java.util.concurrent.atomic.AtomicReferenceArray",replacement="studio.engine.WorkerReferenceArray";
                for(FieldHolder field:cls.getFields())if(field.getType().equals(ValueType.object(original))){field.setType(ValueType.object(replacement));field.setGenericType(null);}
                int allocations=0;
                for(MethodHolder method:cls.getMethods()){
                    Program program=method.getProgram();if(program==null)continue;
                    for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext()){
                        if(instruction instanceof ConstructInstruction construct&&construct.getType().equals(original)){construct.setType(replacement);allocations++;}
                        if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals(original))call.setMethod(new MethodReference(replacement,call.getMethod().getDescriptor()));
                        if(instruction instanceof GetFieldInstruction get&&get.getFieldType().equals(ValueType.object(original)))get.setFieldType(ValueType.object(replacement));
                        if(instruction instanceof PutFieldInstruction put&&put.getFieldType().equals(ValueType.object(original)))put.setFieldType(ValueType.object(replacement));
                    }
                }
                if(allocations!=1)throw new IllegalStateException("Pinned surface-cache storage allocation changed");
            }
            if (name.equals("art.arcane.iris.generation.noise.ImageNoise")) {
                for (MethodHolder method : cls.getMethods()) if (method.getProgram() != null) unavailable(method, "Image-map resources");
            }
            if (name.equals("art.arcane.iris.pack.loading.ResourceLoader")) {
                for (MethodHolder method : cls.getMethods()) {
                    if (method.getName().equals("<clinit>")) { Program program = new Program();program.createVariable();program.createBasicBlock().add(new ExitInstruction());method.setProgram(program); }
                    else if (method.getName().equals("load")) unavailable(method,"Native resource loading");
                }
            }
            if (name.equals("art.arcane.iris.generation.noise.IrisGeneratorStyle")) {
                for (MethodHolder method : cls.getMethods()) if (java.util.Set.of("cachePrefix","cacheKey","clearStaleCacheEntries").contains(method.getName())) unavailable(method,"Persistent float noise caches");
            }
            if (name.equals("art.arcane.volmlib.util.noise.CNG")) {
                for (MethodHolder method : cls.getMethods()) if (method.getName().equals("cached")) unavailable(method,"Persistent float noise caches");
            }
            if (!name.equals(OWNER)) return;
            int changed = 0;
            for (MethodHolder method : cls.getMethods()) {
                if (method.getName().equals("<clinit>")) {
                    Program program = new Program(); program.createVariable();
                    program.createBasicBlock().add(new ExitInstruction()); method.setProgram(program); changed++;
                }
                if (method.getName().equals("noise") && method.parameterCount() == 2) {
                    Program program = new Program();
                    Variable self = program.createVariable(), x = program.createVariable(), z = program.createVariable();
                    Variable noise = program.createVariable(), raw = program.createVariable(), output = program.createVariable();
                    BasicBlock block = program.createBasicBlock();
                    GetFieldInstruction field = new GetFieldInstruction(); field.setField(new FieldReference(OWNER, "n"));
                    field.setFieldType(ValueType.object("art.arcane.volmlib.util.noise.FastNoiseDouble"));
                    field.setInstance(self); field.setReceiver(noise); block.add(field);
                    InvokeInstruction sample = new InvokeInstruction(); sample.setType(InvocationType.VIRTUAL);
                    sample.setInstance(noise); sample.setMethod(new MethodReference(
                            "art.arcane.volmlib.util.noise.FastNoiseDouble", "GetSimplexFractal",
                            ValueType.DOUBLE, ValueType.DOUBLE, ValueType.DOUBLE));
                    sample.setArguments(x, z); sample.setReceiver(raw); block.add(sample);
                    InvokeInstruction fit = new InvokeInstruction(); fit.setType(InvocationType.VIRTUAL);
                    fit.setInstance(self); fit.setMethod(new MethodReference(OWNER, "f", ValueType.DOUBLE, ValueType.DOUBLE));
                    fit.setArguments(raw); fit.setReceiver(output); block.add(fit);
                    ExitInstruction exit = new ExitInstruction(); exit.setValueToReturn(output); block.add(exit);
                    method.setProgram(program); changed++;
                }
            }
            if (changed != 2) throw new IllegalStateException("Pinned Billow platform entry points changed: " + changed);
            System.out.println("Browser platform: select the original Java Billow branch; no native FFM or substitute noise");
        });
    }
    private static void unavailable(MethodHolder method, String feature) {
        Program program = new Program();for(int i=0;i<=method.parameterCount();i++)program.createVariable();
        Variable text=program.createVariable(),exception=program.createVariable();BasicBlock block=program.createBasicBlock();
        StringConstantInstruction label=new StringConstantInstruction();label.setConstant(feature);label.setReceiver(text);block.add(label);
        InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(UnsupportedPlatform.class,"unavailable",String.class,RuntimeException.class));call.setArguments(text);call.setReceiver(exception);block.add(call);
        RaiseInstruction raise=new RaiseInstruction();raise.setException(exception);block.add(raise);method.setProgram(program);
    }
}
