// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.matter;
import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.*;
/** Keep native Matter encoding/decoding and registry rules; bind the supported codec constructors explicitly. */
public final class SourceMatterPlugin implements TeaVMPlugin {
    @Override public void install(TeaVMHost host){host.add((cls,context)->{
        String name=cls.getName();
        if(name.equals("art.arcane.volmlib.util.matter.IrisMatter")){
            int registries=0,factories=0,detection=0;
            for(MethodHolder method:cls.getMethods()){
                if(method.getName().equals("detectBukkit")){falseValue(method);detection++;}
                if(method.getName().equals("buildRegistry")){
                    Program p=new Program();p.createVariable();Variable map=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();InvokeInstruction empty=new InvokeInstruction();empty.setType(InvocationType.SPECIAL);empty.setMethod(new MethodReference("java.util.Collections","emptyMap",ValueType.object("java.util.Map")));empty.setReceiver(map);b.add(empty);
                    ConstructInstruction construct=new ConstructInstruction();construct.setType(name+"$SliceRegistry");construct.setReceiver(result);b.add(construct);InvokeInstruction init=new InvokeInstruction();init.setType(InvocationType.SPECIAL);init.setMethod(new MethodReference(name+"$SliceRegistry","<init>",ValueType.object("java.util.Map"),ValueType.object("java.util.Map"),ValueType.VOID));init.setInstance(result);init.setArguments(map,map);b.add(init);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);registries++;
                }
                if(method.getName().equals("createSlice")){
                    Program p=new Program();Variable self=p.createVariable(),type=p.createVariable();p.createVariable();Variable result=p.createVariable();BasicBlock b=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.matter.WorkerMatterCodecs","create",ValueType.object("java.lang.Class"),ValueType.object("art.arcane.volmlib.util.matter.Matter"),ValueType.object("art.arcane.volmlib.util.matter.MatterSlice")));call.setArguments(type,self);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);factories++;
                }
            }if(registries!=1||factories!=1||detection!=1)throw new IllegalStateException("Pinned Matter host boundary changed");
        }
        if(name.equals("art.arcane.volmlib.util.matter.Matter$BukkitDetection"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("detect"))falseValue(method);
        if(name.equals("art.arcane.iris.world.storage.matter.IrisMatterSupport"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("ensureRegistered")){
            Program p=new Program();p.createVariable();BasicBlock b=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.matter.WorkerMatterCodecs","ensureRegistered",ValueType.VOID));b.add(call);b.add(new ExitInstruction());method.setProgram(p);
        }
    });}
    private static void falseValue(MethodHolder method){Program p=new Program();p.createVariable();Variable result=p.createVariable();BasicBlock b=p.createBasicBlock();IntegerConstantInstruction value=new IntegerConstantInstruction();value.setConstant(0);value.setReceiver(result);b.add(value);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);}
}
