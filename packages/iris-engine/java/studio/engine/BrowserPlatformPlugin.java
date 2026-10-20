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
            if(name.equals("java.util.TemplateCollections$NEtriesMap")){
                FieldHolder data=cls.getField("data");ValueType entries=ValueType.arrayOf(ValueType.object("java.util.Map$Entry"));if(data==null||!data.getType().equals(entries))throw new IllegalStateException("Pinned immutable-map storage changed");int changed=0;
                for(MethodHolder method:cls.getMethods())if(method.getName().equals("get")){
                    Program p=new Program();Variable self=p.createVariable(),key=p.createVariable(),array=p.createVariable(),result=p.createVariable();BasicBlock block=p.createBasicBlock();
                    GetFieldInstruction field=new GetFieldInstruction();field.setInstance(self);field.setField(new FieldReference(name,"data"));field.setFieldType(entries);field.setReceiver(array);block.add(field);
                    InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(WorkerCollections.class,"immutableGet",java.util.Map.Entry[].class,Object.class,Object.class));call.setArguments(array,key);call.setReceiver(result);block.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);block.add(exit);method.setProgram(p);changed++;
                }if(changed!=1)throw new IllegalStateException("Pinned immutable-map get method changed");
            }
            if(java.util.Set.of("art.arcane.iris.generation.hydrology.runtime.IrisHydrologyRuntime","art.arcane.iris.world.history.TransitionDisplacementField","art.arcane.iris.world.history.TransitionGenerationPlan","art.arcane.iris.generation.terrain.transform.TerrainTransformRuntime","art.arcane.iris.generation.terrain.Terrain3DRuntime","art.arcane.iris.generation.runtime.HydrologyNoiseCacheBudget","art.arcane.iris.generation.runtime.EngineThreadState").contains(name))for(MethodHolder method:cls.getMethods())if(method.getProgram()!=null)unavailable(method,"Native hydrology, saved-world transition, transform or volumetric runtime");
            if(name.equals("art.arcane.iris.generation.stream.CachedStream2D"))replaceClass(cls,"art.arcane.volmlib.util.cache.WorldCache2D","studio.engine.terrain.WorkerWorldCache");
            if(name.equals("art.arcane.iris.generation.stream.CachedDoubleStream2D"))replaceClass(cls,"art.arcane.volmlib.util.cache.WorldCache2DDouble","studio.engine.terrain.WorkerWorldDoubleCache");
            if(name.equals("art.arcane.iris.generation.runtime.SharedCornerBounds")){
                replaceClass(cls,"java.lang.invoke.VarHandle","studio.engine.terrain.WorkerArrayAccess");
                for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.lang.invoke.MethodHandles"))call.setMethod(new MethodReference("studio.engine.terrain.WorkerArrayAccess",call.getMethod().getDescriptor()));}
            }
            if(java.util.Set.of("art.arcane.iris.generation.runtime.IrisComplex","art.arcane.volmlib.util.stream.interpolation.Interpolated").contains(name)){
                for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;){Instruction next=instruction.getNext();
                    if(instruction instanceof ConstructInstruction construct&&construct.getType().equals("java.util.UUID"))instruction.delete();
                    if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.util.UUID")){
                        if(call.getMethod().getName().equals("<init>")){call.setReceiver(call.getInstance());call.setInstance(null);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(studio.probe.UuidCompat.class,"fromBits",long.class,long.class,java.util.UUID.class));}
                        else if(call.getMethod().getName().equals("getMostSignificantBits")){Variable self=call.getInstance();call.setInstance(null);call.setArguments(self);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(studio.probe.UuidCompat.class,"getMostSignificantBits",java.util.UUID.class,long.class));}
                    }instruction=next;
                }}
            }
            if(name.equals("art.arcane.iris.generation.runtime.IrisComplex$BoundsSampler"))replaceClass(cls,"java.lang.ref.WeakReference","studio.engine.terrain.WorkerWeakReference");
            if(name.equals("art.arcane.iris.configuration.IrisSettings"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("read"))unavailable(method,"Server settings filesystem IO; install worker settings first");
            if(name.equals("art.arcane.iris.generation.runtime.IrisComplex")){
                int uuids=0;for(MethodHolder method:cls.getMethods()){Program program=method.getProgram();if(program==null)continue;for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().equals(new MethodReference(java.util.UUID.class,"nameUUIDFromBytes",byte[].class,java.util.UUID.class))){call.setMethod(new MethodReference(studio.probe.UuidCompat.class,"nameUUIDFromBytes",byte[].class,java.util.UUID.class));uuids++;}}
                if(uuids!=1)throw new IllegalStateException("Pinned complex focus UUID call changed");
            }
            // TeaVM 0.16's Wasm reflection emitter dereferences a missing raw
            // generic type when a field also has runtime annotations. Supply
            // equivalent raw metadata; preserve every actual generic signature.
            if(studio.engine.config.NativeConfigMetadata.TYPES.contains(name))for(FieldHolder field:cls.getFields())if(field.getGenericType()==null)field.setGenericType(rawGeneric(field.getType()));
            if(name.equals("art.arcane.iris.generation.biome.IrisBiome")){
                int writes=0,reads=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("withInferredTypeSlow")){Program program=method.getProgram();for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("com.google.gson.Gson")){
                    if(call.getMethod().getName().equals("toJson")&&call.getMethod().parameterCount()==1){call.setInstance(null);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.config.NativeConfigWriter","toJson",ValueType.object("java.lang.Object"),ValueType.object("java.lang.String")));writes++;}
                    else if(call.getMethod().getName().equals("fromJson")&&call.getMethod().parameterCount()==2){call.setInstance(null);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.config.NativeConfigWriter","fromJson",ValueType.object("java.lang.String"),ValueType.object("java.lang.Class"),ValueType.object("java.lang.Object")));reads++;}
                }}if(writes!=1||reads!=1)throw new IllegalStateException("Pinned inferred-biome copy calls changed");
            }
            if(name.equals("art.arcane.iris.generation.terrain.IrisDimension")){
                int uuids=0,encodings=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("resolveFocusRegion")){Program program=method.getProgram();for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                    if(call.getMethod().getClassName().equals("java.util.UUID")&&call.getMethod().getName().equals("nameUUIDFromBytes")){call.setMethod(new MethodReference(studio.probe.UuidCompat.class,"nameUUIDFromBytes",byte[].class,java.util.UUID.class));uuids++;}
                    else if(call.getMethod().equals(new MethodReference(String.class,"getBytes",java.nio.charset.Charset.class,byte[].class))){Variable self=call.getInstance(),charset=call.getArguments().get(0);call.setInstance(null);call.setArguments(self,charset);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(studio.probe.UuidCompat.class,"utf8",String.class,java.nio.charset.Charset.class,byte[].class));encodings++;}
                }}if(uuids!=1||encodings!=1)throw new IllegalStateException("Pinned focus-region UUID calls changed");
            }
            if(name.equals("art.arcane.volmlib.util.collection.KSet")){
                int changed=0,iterators=0;for(MethodHolder method:cls.getMethods()){Program program=method.getProgram();if(program==null)continue;for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                    if(call.getMethod().getClassName().equals("java.util.concurrent.ConcurrentHashMap")&&call.getMethod().getName().equals("keySet")){Variable map=call.getInstance();call.setInstance(null);call.setArguments(map);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(WorkerCollections.class,"keys",java.util.Map.class,java.util.Set.class));changed++;}
                    else if(call.getMethod().getClassName().equals("java.util.concurrent.ConcurrentHashMap$KeySetView")&&call.getMethod().getName().equals("iterator")){call.setMethod(new MethodReference(java.util.Set.class,"iterator",java.util.Iterator.class));iterators++;}
                }}if(changed!=1||iterators!=1)throw new IllegalStateException("Pinned collection key-view calls changed");
            }
            if(name.equals("art.arcane.iris.pack.loading.IrisData")){
                int initializers=0,gates=0;
                for(MethodHolder method:cls.getMethods()){
                    if(method.getName().equals("hotloaded")||method.getName().equals("hotloadedDatapackCompiler")){delegateInstance(method,"initialize",ValueType.VOID);initializers++;}
                    if(method.getName().equals("getContentGate")){delegateInstance(method,"contentGate",ValueType.object("art.arcane.iris.pack.validation.ContentGate"));gates++;}
                }
                if(initializers!=2||gates!=1)throw new IllegalStateException("Pinned native data IO entry points changed");
            }
            if(name.equals("art.arcane.iris.pack.validation.CompatWalker")){
                int changed=0;for(MethodHolder method:cls.getMethods()){Program program=method.getProgram();if(program==null)continue;for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.lang.Class")&&call.getMethod().getName().equals("isRecord")){
                    Variable type=call.getInstance();call.setInstance(null);call.setArguments(type);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.config.NativeConfigMetadata","isRecord",ValueType.object("java.lang.Class"),ValueType.BOOLEAN));changed++;
                }}if(changed!=1)throw new IllegalStateException("Pinned compatibility record metadata call changed");
            }
            if(name.equals("art.arcane.iris.generation.noise.IrisExpression"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("expression"))unavailable(method,"Native expression bytecode compiler");
            if(name.equals("art.arcane.iris.structure.object.IrisObjectScale")){
                int changed=0;
                for(MethodHolder method:cls.getMethods())if(method.getName().equals("resolveCacheMaximumEstimatedBytes")){
                    Program program=new Program();program.createVariable();Variable value=program.createVariable();BasicBlock block=program.createBasicBlock();LongConstantInstruction size=new LongConstantInstruction();size.setConstant(32L*1024*1024);size.setReceiver(value);block.add(size);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(value);block.add(exit);method.setProgram(program);changed++;
                }
                if(changed!=1)throw new IllegalStateException("Pinned object-cache budget entry point changed");
            }
            if(java.util.Set.of("art.arcane.volmlib.util.cache.AtomicCache","art.arcane.iris.world.entity.IrisAttributeModifier","art.arcane.iris.pack.loading.ResourceLoader","art.arcane.iris.spi.IrisLogging","art.arcane.iris.pack.validation.ContentGate").contains(name)){
                int factories=0;
                for(MethodHolder method:cls.getMethods()){
                    Program program=method.getProgram();if(program==null)continue;
                    for(int b=0;b<program.basicBlockCount();b++)for(Instruction instruction=program.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext()){
                        if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.util.concurrent.ConcurrentHashMap")&&call.getMethod().getName().equals("newKeySet")&&call.getMethod().parameterCount()==0){call.setMethod(new MethodReference(WorkerCollections.class,"newKeySet",java.util.Set.class));factories++;}
                    }
                }
                if(factories!=1)throw new IllegalStateException("Pinned diagnostic set factory changed in "+name);
            }
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
            if (java.util.Set.of("art.arcane.iris.generation.noise.IrisGenerator$SurfaceCacheStripe","art.arcane.iris.generation.biome.IrisBiomePaletteLayer","art.arcane.iris.generation.terrain.ProceduralTerrainHeightSampler").contains(name)) {
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
                int expected=name.endsWith("IrisBiomePaletteLayer")?2:1;
                if(allocations!=expected)throw new IllegalStateException("Pinned reference-array allocation changed in "+name+": "+allocations);
            }
            if (name.equals("art.arcane.iris.generation.noise.ImageNoise")) {
                for (MethodHolder method : cls.getMethods()) if (method.getProgram() != null) unavailable(method, "Image-map resources");
            }
            if(name.equals("art.arcane.iris.generation.image.IrisImageMapRuntime"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("compileBinding"))unavailable(method,"Native image-map resource binding");
            if (name.equals("art.arcane.iris.pack.loading.ResourceLoader")) {
                int constructors=0;
                for (MethodHolder method : cls.getMethods()) {
                    if(method.getName().equals("<init>")){
                        Program program=new Program();for(int i=0;i<=method.parameterCount();i++)program.createVariable();program.createBasicBlock().add(new ExitInstruction());method.setProgram(program);constructors++;
                    }
                    if (method.getName().equals("load")) unavailable(method,"Native resource loading");
                }
                if(constructors!=1)throw new IllegalStateException("Pinned native resource IO constructor changed");
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
    private static ValueType replaced(ValueType type,String original,String replacement){return type.equals(ValueType.object(original))?ValueType.object(replacement):type;}
    private static void replaceClass(ClassHolder cls,String original,String replacement){
        for(FieldHolder field:cls.getFields())if(field.getType().equals(ValueType.object(original))){field.setType(ValueType.object(replacement));field.setGenericType(null);}
        for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext()){
            if(instruction instanceof ConstructInstruction construct&&construct.getType().equals(original))construct.setType(replacement);
            if(instruction instanceof GetFieldInstruction get)get.setFieldType(replaced(get.getFieldType(),original,replacement));
            if(instruction instanceof PutFieldInstruction put)put.setFieldType(replaced(put.getFieldType(),original,replacement));
            if(instruction instanceof InvokeInstruction call){MethodReference ref=call.getMethod();ValueType[] signature=ref.getDescriptor().getSignature();for(int i=0;i<signature.length;i++)signature[i]=replaced(signature[i],original,replacement);call.setMethod(new MethodReference(ref.getClassName().equals(original)?replacement:ref.getClassName(),new MethodDescriptor(ref.getName(),signature)));}
        }}
    }
    private static GenericValueType rawGeneric(ValueType type){
        if(type instanceof ValueType.Object object)return new GenericValueType.Object(null,object.getClassName(),new GenericValueType.Argument[0]);
        if(type instanceof ValueType.Array array)return new GenericValueType.Array(rawGeneric(array.getItemType()));
        if(type==ValueType.VOID)return GenericValueType.VOID;
        return switch(((ValueType.Primitive)type).getKind()){
            case BOOLEAN->GenericValueType.BOOLEAN;case BYTE->GenericValueType.BYTE;case SHORT->GenericValueType.SHORT;case INTEGER->GenericValueType.INT;case LONG->GenericValueType.LONG;case FLOAT->GenericValueType.FLOAT;case DOUBLE->GenericValueType.DOUBLE;case CHARACTER->GenericValueType.CHAR;
        };
    }
    private static void delegateInstance(MethodHolder method,String target,ValueType result){
        Program program=new Program();Variable self=program.createVariable();BasicBlock block=program.createBasicBlock();
        InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.pack.MemoryPack",target,ValueType.object("art.arcane.iris.pack.loading.IrisData"),result));call.setArguments(self);
        Variable value=null;if(result!=ValueType.VOID){value=program.createVariable();call.setReceiver(value);}block.add(call);
        ExitInstruction exit=new ExitInstruction();if(value!=null)exit.setValueToReturn(value);block.add(exit);method.setProgram(program);
    }
    private static void unavailable(MethodHolder method, String feature) {
        Program program = new Program();for(int i=0;i<=method.parameterCount();i++)program.createVariable();
        Variable text=program.createVariable(),exception=program.createVariable();BasicBlock block=program.createBasicBlock();
        StringConstantInstruction label=new StringConstantInstruction();label.setConstant(feature);label.setReceiver(text);block.add(label);
        InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(UnsupportedPlatform.class,"unavailable",String.class,RuntimeException.class));call.setArguments(text);call.setReceiver(exception);block.add(call);
        RaiseInstruction raise=new RaiseInstruction();raise.setException(exception);block.add(raise);method.setProgram(program);
    }
}
