// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
import org.teavm.model.*;
import org.teavm.model.instructions.*;
import org.teavm.vm.spi.*;
/** Bind only AWT pixel access, image IO and synchronous digest services; native map algorithms remain. */
public final class ImagePlatformPlugin implements TeaVMPlugin {
    @Override public void install(TeaVMHost host){host.add((cls,context)->{
        String name=cls.getName();
        if(name.equals("art.arcane.iris.generation.image.IrisImage")){
            String[][] mappings={{"java.awt.image.BufferedImage","studio.engine.image.WorkerImagePixels"},{"java.awt.image.WritableRaster","studio.engine.image.WorkerImagePixels$Raster"},{"java.awt.image.Raster","studio.engine.image.WorkerImagePixels$Raster"},{"java.awt.image.ColorModel","studio.engine.image.WorkerImagePixels$ColorModel"},{"java.awt.image.IndexColorModel","studio.engine.image.WorkerImagePixels$IndexedColorModel"},{"java.awt.image.SampleModel","studio.engine.image.WorkerImagePixels$SampleModel"}};
            for(String[] mapping:mappings)replace(cls,mapping[0],mapping[1]);
        }
        if(name.equals("art.arcane.iris.pack.loading.ImageResourceLoader")){
            int constructors=0;for(MethodHolder method:cls.getMethods())if(method.getProgram()!=null){
                Program p=new Program();for(int i=0;i<=method.parameterCount();i++)p.createVariable();BasicBlock b=p.createBasicBlock();
                if(method.getName().equals("<init>")){b.add(new ExitInstruction());constructors++;}
                else{Variable text=p.createVariable(),failure=p.createVariable();StringConstantInstruction label=new StringConstantInstruction();label.setConstant("Native image filesystem loader outside an owned worker snapshot");label.setReceiver(text);b.add(label);InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.UnsupportedPlatform","unavailable",ValueType.object("java.lang.String"),ValueType.object("java.lang.RuntimeException")));call.setArguments(text);call.setReceiver(failure);b.add(call);RaiseInstruction raise=new RaiseInstruction();raise.setException(failure);b.add(raise);}method.setProgram(p);
            }if(constructors!=1)throw new IllegalStateException("Pinned native image loader constructors changed: "+constructors);
        }
        if(name.equals("art.arcane.iris.generation.image.IrisImageMapCompiler")){
            int entries=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("compile")){
                Program p=method.getProgram();InvokeInstruction budget=new InvokeInstruction();budget.setType(InvocationType.SPECIAL);budget.setMethod(new MethodReference("studio.engine.pack.MemoryPack","reserveImageCompile",ValueType.object("art.arcane.iris.generation.image.IrisImageMap"),ValueType.object("art.arcane.iris.generation.image.IrisImage"),ValueType.VOID));budget.setArguments(p.variableAt(1),p.variableAt(2));p.basicBlockAt(0).getFirstInstruction().insertPrevious(budget);entries++;
            }if(entries!=1)throw new IllegalStateException("Pinned image-map compiler entry changed");
        }
        if(name.equals("art.arcane.iris.generation.image.IrisImageMapCompiler$HashAccumulator")){
            replace(cls,"java.util.HexFormat","studio.engine.image.WorkerImageHex");
            replace(cls,"java.security.MessageDigest","studio.engine.image.WorkerImageDigest");
            replace(cls,"java.security.NoSuchAlgorithmException","java.lang.IllegalArgumentException");
        }
        if(name.equals("studio.engine.image.WorkerImageFactory")){
            int factories=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("create")){
                Program p=new Program();p.createVariable();Variable pixels=p.createVariable(),format=p.createVariable(),image=p.createVariable();BasicBlock b=p.createBasicBlock();ConstructInstruction create=new ConstructInstruction();create.setType("art.arcane.iris.generation.image.IrisImage");create.setReceiver(image);b.add(create);StringConstantInstruction png=new StringConstantInstruction();png.setConstant("png");png.setReceiver(format);b.add(png);InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("art.arcane.iris.generation.image.IrisImage","<init>",ValueType.object("studio.engine.image.WorkerImagePixels"),ValueType.object("java.lang.String"),ValueType.VOID));call.setInstance(image);call.setArguments(pixels,format);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(image);b.add(exit);method.setProgram(p);factories++;
            }if(factories!=1)throw new IllegalStateException("Worker native image factory changed");
        }
    });}
    private static ValueType type(ValueType value,String from,String to){if(value instanceof ValueType.Array array)return ValueType.arrayOf(type(array.getItemType(),from,to));return value.equals(ValueType.object(from))?ValueType.object(to):value;}
    private static void replace(ClassHolder cls,String from,String to){
        for(FieldHolder field:cls.getFields())if(field.getType().equals(ValueType.object(from))){field.setType(ValueType.object(to));field.setGenericType(null);}
        for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++){for(TryCatchBlock handler:p.basicBlockAt(b).getTryCatchBlocks())if(from.equals(handler.getExceptionType()))handler.setExceptionType(to);for(Instruction i=p.basicBlockAt(b).getFirstInstruction();i!=null;i=i.getNext()){
            if(i instanceof ConstructInstruction construct&&construct.getType().equals(from))construct.setType(to);
            if(i instanceof ConstructArrayInstruction array)array.setItemType(type(array.getItemType(),from,to));
            if(i instanceof ClassConstantInstruction value)value.setConstant(type(value.getConstant(),from,to));
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
