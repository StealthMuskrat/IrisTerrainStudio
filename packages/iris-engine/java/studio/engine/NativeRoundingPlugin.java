// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;

import org.teavm.model.*;
import org.teavm.model.instructions.InvokeInstruction;
import org.teavm.vm.spi.*;
import studio.engine.expression.WorkerJdkRound;

/** OpenJDK round semantics at original native calls; no replacement noise or terrain arithmetic. */
public final class NativeRoundingPlugin implements TeaVMPlugin {
    @Override public void install(TeaVMHost host){host.add((cls,context)->{
        String name=cls.getName();
        boolean diagnostic=name.equals("studio.engine.NativeRoundingDiagnostic");
        if(!diagnostic&&!name.startsWith("art.arcane.iris.")&&!name.startsWith("art.arcane.volmlib.")&&!name.equals("net.minecraft.world.level.block.state.properties.RotationSegment")&&!name.equals("net.minecraft.util.SegmentedAnglePrecision"))return;
        int doubles=0,floats=0;
        for(MethodHolder method:cls.getMethods()){
            Program p=method.getProgram();if(p==null)continue;
            for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                MethodReference ref=call.getMethod();if(!ref.getClassName().equals("java.lang.Math")&&!ref.getClassName().equals("java.lang.StrictMath"))continue;
                if(!ref.getName().equals("round")||ref.parameterCount()!=1)continue;
                if(ref.parameterType(0).equals(ValueType.DOUBLE)&&ref.getReturnType().equals(ValueType.LONG)){call.setMethod(new MethodReference(WorkerJdkRound.class,"round",double.class,long.class));doubles++;}
                else if(ref.parameterType(0).equals(ValueType.FLOAT)&&ref.getReturnType().equals(ValueType.INTEGER)){call.setMethod(new MethodReference(WorkerJdkRound.class,"round",float.class,int.class));floats++;}
                else throw new IllegalStateException("Unexpected native Math.round descriptor: "+ref);
            }
        }
        int expected=name.equals("art.arcane.iris.generation.decoration.ruin.RuinGenerator")?8:name.equals("art.arcane.iris.generation.decoration.ruin.RuinShapes")?4:name.equals("art.arcane.volmlib.util.noise.CNG")?9:name.equals("art.arcane.volmlib.util.noise.HexagonalNoise")?6:-1;
        if(expected>=0&&(doubles!=expected||floats!=0))throw new IllegalStateException("Pinned native rounding calls changed: "+name);
        if(diagnostic&&(doubles!=1||floats!=1))throw new IllegalStateException("Pinned rounding diagnostic calls changed");
        if(doubles+floats>0)System.out.println("JDK rounding boundary: "+name+" double="+doubles+" float="+floats);
    });}
}
