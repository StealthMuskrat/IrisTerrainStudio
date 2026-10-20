// SPDX-License-Identifier: GPL-3.0-or-later
package studio.probe;

import java.util.UUID;
import java.nio.charset.Charset;
import org.teavm.model.Instruction;
import org.teavm.model.MethodHolder;
import org.teavm.model.MethodReference;
import org.teavm.model.Program;
import org.teavm.model.Variable;
import org.teavm.model.instructions.InvocationType;
import org.teavm.model.instructions.InvokeInstruction;
import org.teavm.vm.spi.TeaVMHost;
import org.teavm.vm.spi.TeaVMPlugin;

/** Redirect only missing UUID operations and Java UTF-8 semantics in the pinned RNG class. */
public final class UuidTeaVMPlugin implements TeaVMPlugin {
    @Override
    public void install(TeaVMHost host) {
        host.add((cls, context) -> {
            if (!cls.getName().equals("art.arcane.volmlib.util.math.RNG")) return;
            int changed = 0;
            int encodings = 0;
            for (MethodHolder method : cls.getMethods()) {
                Program program = method.getProgram();
                if (program == null) continue;
                for (int block = 0; block < program.basicBlockCount(); block++) {
                    for (Instruction instruction = program.basicBlockAt(block).getFirstInstruction(); instruction != null; instruction = instruction.getNext()) {
                        if (!(instruction instanceof InvokeInstruction call)) continue;
                        if (call.getMethod().equals(new MethodReference(String.class, "getBytes", Charset.class, byte[].class))) {
                            Variable instance = call.getInstance();
                            Variable charset = call.getArguments().get(0);
                            call.setInstance(null);
                            call.setArguments(instance, charset);
                            call.setType(InvocationType.SPECIAL);
                            call.setMethod(new MethodReference(UuidCompat.class, "utf8", String.class, Charset.class, byte[].class));
                            encodings++;
                            continue;
                        }
                        if (!call.getMethod().getClassName().equals("java.util.UUID")) continue;
                        String name = call.getMethod().getName();
                        if (name.equals("nameUUIDFromBytes")) {
                            call.setMethod(new MethodReference(UuidCompat.class, name, byte[].class, UUID.class));
                            changed++;
                        } else if (name.equals("getMostSignificantBits") || name.equals("getLeastSignificantBits")) {
                            Variable instance = call.getInstance();
                            call.setInstance(null);
                            call.setArguments(instance);
                            call.setType(InvocationType.SPECIAL);
                            call.setMethod(new MethodReference(UuidCompat.class, name, UUID.class, long.class));
                            changed++;
                        }
                    }
                }
            }
            if (changed != 4) throw new IllegalStateException("Unexpected pinned RNG UUID call count: " + changed);
            if (encodings != 2) throw new IllegalStateException("Unexpected pinned RNG UTF-8 call count: " + encodings);
            System.out.println("UUID compatibility: redirected exactly four UUID and two UTF-8 JDK calls in unmodified RNG bytecode");
        });
    }
}
