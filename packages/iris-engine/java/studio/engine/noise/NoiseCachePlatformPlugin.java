// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.noise;
import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.*;

/** Preserve native cache algorithms; bind only IO, owner metadata and captured build identity. */
public final class NoiseCachePlatformPlugin implements TeaVMPlugin {
    @Override public void install(TeaVMHost host){
        final String fingerprint;
        try{var file=java.nio.file.Path.of(System.getenv("IRIS_ENGINE_INPUTS")).resolveSibling("noise-cache-identity.json");fingerprint=com.google.gson.JsonParser.parseString(java.nio.file.Files.readString(file)).getAsJsonObject().get("implementationFingerprint").getAsString();if(!fingerprint.matches("[0-9a-f]{64}"))throw new IllegalStateException("Invalid captured noise cache identity");}catch(Exception failure){throw new IllegalStateException("Native noise identity capture is required",failure);}
        host.add((cls,context)->{
            String name=cls.getName();
            if(name.equals("art.arcane.iris.generation.noise.IrisGeneratorStyle$NoiseCacheIdentity")){
                int captures=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("fingerprint")){
                    Program p=new Program();p.createVariable();Variable value=p.createVariable();BasicBlock b=p.createBasicBlock();StringConstantInstruction constant=new StringConstantInstruction();constant.setConstant(fingerprint);constant.setReceiver(value);b.add(constant);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(value);b.add(exit);method.setProgram(p);captures++;
                }if(captures!=1)throw new IllegalStateException("Pinned noise cache identity entry changed");
            }
            if(name.equals("art.arcane.iris.generation.noise.IrisGeneratorStyle")){
                int roots=0,keys=0,constructs=0;
                for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;){Instruction next=i.getNext();
                    if(method.getName().equals("clearStaleCacheEntries")&&i instanceof GetFieldInstruction get&&get.getField().getFieldName().equals("ACTIVE_CACHE_KEYS")){
                        InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseIO","activeKeys",ValueType.object("art.arcane.iris.pack.loading.IrisData"),ValueType.object("java.util.concurrent.ConcurrentHashMap")));call.setArguments(p.variableAt(1));call.setReceiver(get.getReceiver());i.replace(call);keys++;
                    }
                    if(i instanceof ConstructInstruction construct&&construct.getType().equals("java.io.File")){construct.setType("studio.engine.noise.MemoryNoiseFile");constructs++;}
                    if(i instanceof InvokeInstruction call){MethodReference ref=call.getMethod();
                        if(ref.getClassName().equals("java.io.File")&&ref.getName().equals("<init>"))call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseFile",ref.getDescriptor()));
                        if(ref.getClassName().equals("art.arcane.iris.pack.loading.IrisData")&&ref.getName().equals("getDataFolder")){Variable data=call.getInstance();call.setInstance(null);call.setArguments(data);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseIO","root",ValueType.object("art.arcane.iris.pack.loading.IrisData"),ValueType.object("java.io.File")));roots++;}
                    }i=next;
                }}if(roots!=2||keys!=1||constructs!=1)throw new IllegalStateException("Pinned style cache IO boundary changed: "+roots+","+keys+","+constructs);
            }
            if(name.equals("art.arcane.volmlib.util.noise.CNG")){
                int entries=0,constructs=0,paths=0,moves=0,deletes=0,outputs=0;
                for(MethodHolder method:cls.getMethods())if(method.getName().equals("cached")&&method.parameterCount()==4){
                    Program p=method.getProgram();InvokeInstruction admit=new InvokeInstruction();admit.setType(InvocationType.SPECIAL);admit.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseIO","admit",ValueType.INTEGER,ValueType.object("java.lang.String"),ValueType.object("java.io.File"),ValueType.VOID));admit.setArguments(p.variableAt(1),p.variableAt(2),p.variableAt(3));p.basicBlockAt(0).getFirstInstruction().insertPrevious(admit);entries++;
                    for(int b=0;b<p.basicBlockCount();b++)for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext()){
                        if(i instanceof ConstructInstruction construct){if(construct.getType().equals("java.io.File")){construct.setType("studio.engine.noise.MemoryNoiseFile");constructs++;}if(construct.getType().equals("java.io.FileOutputStream")){construct.setType("studio.engine.noise.MemoryNoiseOutput");outputs++;}}
                        if(i instanceof InvokeInstruction call){MethodReference ref=call.getMethod();
                            if(ref.getClassName().equals("java.io.File")&&ref.getName().equals("<init>"))call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseFile",ref.getDescriptor()));
                            if(ref.getClassName().equals("java.io.FileOutputStream"))call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseOutput",ref.getDescriptor()));
                            if(ref.getClassName().equals("java.io.File")&&ref.getName().equals("toPath")){Variable file=call.getInstance();call.setInstance(null);call.setArguments(file);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseIO","path",ValueType.object("java.io.File"),ValueType.object("java.io.File")));paths++;}
                            if(ref.getClassName().equals("java.nio.file.Files")&&ref.getName().equals("move")){call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseIO","move",ValueType.object("java.io.File"),ValueType.object("java.io.File"),ValueType.arrayOf(ValueType.object("java.nio.file.CopyOption")),ValueType.object("java.io.File")));moves++;}
                            if(ref.getClassName().equals("java.nio.file.Files")&&ref.getName().equals("deleteIfExists")){call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseIO","deleteIfExists",ValueType.object("java.io.File"),ValueType.BOOLEAN));deletes++;}
                        }
                    }
                }if(entries!=1||constructs!=3||paths!=3||moves!=1||deletes!=1||outputs!=1)throw new IllegalStateException("Pinned CNG cache IO boundary changed: "+entries+","+constructs+","+paths+","+moves+","+deletes+","+outputs);
            }
            if(name.equals("art.arcane.volmlib.util.cache.FloatCache")){
                int inputs=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext()){
                    if(i instanceof ConstructInstruction construct&&construct.getType().equals("java.io.FileInputStream")){construct.setType("studio.engine.noise.MemoryNoiseInput");inputs++;}
                    if(i instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.io.FileInputStream"))call.setMethod(new MethodReference("studio.engine.noise.MemoryNoiseInput",call.getMethod().getDescriptor()));
                }}if(inputs!=1)throw new IllegalStateException("Pinned native float cache input changed");
            }
        });
    }
}
