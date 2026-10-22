// SPDX-License-Identifier: GPL-3.0-or-later
package studio.build;

import org.objectweb.asm.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import com.google.gson.GsonBuilder;

/** Retain native layer assembly bytecode, substituting only its concrete server host type. */
public final class GenerateLayerKernel {
    private static final String ORIGINAL="art/arcane/iris/world/history/GenerationKernelV1";
    private static final String TARGET="studio/engine/terrain/NativeLayerKernel";
    private static final String SERVER="art/arcane/iris/generation/runtime/IrisEngine";
    private static final String ENGINE="art/arcane/iris/generation/runtime/Engine";
    private static String name(String value){return value.equals(ORIGINAL)?TARGET:value.equals(SERVER)?ENGINE:value;}
    private static String descriptor(String value){return value==null?null:value.replace("L"+ORIGINAL+";","L"+TARGET+";").replace("L"+SERVER+";","L"+ENGINE+";");}
    private static Object constant(Object value){
        if(value instanceof Type type)return Type.getType(descriptor(type.getDescriptor()));
        if(value instanceof Handle handle){boolean server=handle.getOwner().equals(SERVER);return new Handle(server&&handle.getTag()==Opcodes.H_INVOKEVIRTUAL?Opcodes.H_INVOKEINTERFACE:handle.getTag(),name(handle.getOwner()),handle.getName(),descriptor(handle.getDesc()),server||handle.isInterface());}
        if(value instanceof ConstantDynamic dynamic){Object[] arguments=new Object[dynamic.getBootstrapMethodArgumentCount()];for(int i=0;i<arguments.length;i++)arguments[i]=constant(dynamic.getBootstrapMethodArgument(i));return new ConstantDynamic(dynamic.getName(),descriptor(dynamic.getDescriptor()),(Handle)constant(dynamic.getBootstrapMethod()),arguments);}
        return value;
    }
    private static String hash(byte[] bytes)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    public static void main(String[] args)throws Exception{
        byte[] original;try(var stream=GenerateLayerKernel.class.getClassLoader().getResourceAsStream(ORIGINAL+".class")){if(stream==null)throw new IllegalStateException("Pinned native layer factory class is missing");original=stream.readAllBytes();}
        ClassWriter writer=new ClassWriter(0);Set<String> retained=new TreeSet<>();int[] callbacks={0},hostCalls={0};
        new ClassReader(original).accept(new ClassVisitor(Opcodes.ASM9,writer){
            @Override public void visit(int version,int access,String className,String signature,String parent,String[] interfaces){if(!className.equals(ORIGINAL)||!parent.equals("java/lang/Object"))throw new IllegalStateException("Pinned layer factory type changed");super.visit(version,Opcodes.ACC_PUBLIC|Opcodes.ACC_FINAL|Opcodes.ACC_SUPER,TARGET,null,parent,new String[0]);}
            @Override public FieldVisitor visitField(int access,String field,String desc,String signature,Object value){return null;}
            @Override public void visitNestHost(String host){}
            @Override public void visitNestMember(String member){}
            @Override public void visitInnerClass(String inner,String outer,String simple,int access){}
            @Override public MethodVisitor visitMethod(int access,String method,String desc,String signature,String[] exceptions){
                boolean callback=method.startsWith("lambda$registerDimensionStack$");
                if(!Set.of("<init>","createUpperContext","createDimensionStackContext","registerDimensionStack").contains(method)&&!callback)return null;
                if(callback)callbacks[0]++;else if(!retained.add(method))throw new IllegalStateException("Ambiguous layer factory method");
                MethodVisitor output=super.visitMethod(method.equals("<init>")?Opcodes.ACC_PUBLIC:access,method,descriptor(desc),null,exceptions);
                return new MethodVisitor(Opcodes.ASM9,output){
                    @Override public void visitTypeInsn(int opcode,String type){super.visitTypeInsn(opcode,name(type));}
                    @Override public void visitFieldInsn(int opcode,String owner,String field,String type){super.visitFieldInsn(opcode,name(owner),field,descriptor(type));}
                    @Override public void visitMethodInsn(int opcode,String owner,String method,String desc,boolean iface){boolean server=owner.equals(SERVER);if(server)hostCalls[0]++;super.visitMethodInsn(server&&opcode==Opcodes.INVOKEVIRTUAL?Opcodes.INVOKEINTERFACE:opcode,name(owner),method,descriptor(desc),server||iface);}
                    @Override public void visitInvokeDynamicInsn(String method,String desc,Handle bootstrap,Object... values){Object[] mapped=Arrays.stream(values).map(GenerateLayerKernel::constant).toArray();super.visitInvokeDynamicInsn(method,descriptor(desc),(Handle)constant(bootstrap),mapped);}
                    @Override public void visitLdcInsn(Object value){super.visitLdcInsn(constant(value));}
                    @Override public void visitFrame(int type,int locals,Object[] local,int stack,Object[] values){super.visitFrame(type,locals,mapFrame(local),stack,mapFrame(values));}
                    private Object[] mapFrame(Object[] frame){if(frame==null)return null;return Arrays.stream(frame).map(value->value instanceof String text?name(text):value).toArray();}
                    @Override public void visitLocalVariable(String variable,String desc,String signature,Label start,Label end,int index){super.visitLocalVariable(variable,descriptor(desc),null,start,end,index);}
                };
            }
        },0);
        if(!retained.equals(Set.of("<init>","createUpperContext","createDimensionStackContext","registerDimensionStack"))||callbacks[0]!=2||hostCalls[0]!=3)throw new IllegalStateException("Pinned layer factory boundary changed: "+retained+", callbacks="+callbacks[0]+", host calls="+hostCalls[0]);
        byte[] output=writer.toByteArray();Path target=Path.of(args[0],TARGET+".class");Files.createDirectories(target.getParent());Files.write(target,output);
        Map<String,Object> metadata=new LinkedHashMap<>();metadata.put("scope","native-layer-kernel-host-boundary");metadata.put("nativeClass",ORIGINAL);metadata.put("nativeClassSha256",hash(original));metadata.put("adaptedClassSha256",hash(output));metadata.put("methods",retained);metadata.put("callbacks",callbacks[0]);metadata.put("hostCalls",hostCalls[0]);metadata.put("adaptation","Concrete IrisEngine parameter/call owners become Engine; native method instructions and lambda ordering retained. Runtime fingerprint, unrelated factory services and interface removed.");
        Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(metadata)+"\n");
        System.out.println("Captured native upper/stack context factories and stack stage registration; no terrain algorithm rewritten.");
    }
}
