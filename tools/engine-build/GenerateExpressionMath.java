package studio.build;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;
import com.dfsek.paralithic.functions.natives.*;

/** Capture exact methods registered by the resolved native dependency; generate direct call handles. */
public final class GenerateExpressionMath {
    public static void main(String[] args)throws Exception{
        Map<String,Method> methods=new TreeMap<>();
        for(Field field:NativeMath.class.getFields())if(field.getType()==NativeFunction.class){Method m=((NativeFunction)field.get(null)).getMethod();methods.put(key(m),m);}
        StringBuilder source=new StringBuilder("package studio.engine.expression;\n/** Generated from actual native function method handles. */\npublic final class ExpressionMath {\npublic static final String[] KEYS={\n");
        for(String key:methods.keySet())source.append('"').append(key).append("\",\n");source.append("};\npublic static int resolve(String owner,String name,String descriptor){String key=owner+\".\"+name+descriptor;for(int i=0;i<KEYS.length;i++)if(KEYS[i].equals(key))return i;throw WorkerExpressions.failure(\"Unconnected native expression method: \"+key);}\npublic static int arguments(int id){return switch(id){\n");
        int id=0;for(Method method:methods.values())source.append("case ").append(id++).append(" -> ").append(method.getParameterCount()).append(";\n");source.append("default -> throw WorkerExpressions.failure(\"Unknown expression method handle\");};}\npublic static Object invoke(int id,Object[] values){return switch(id){\n");
        id=0;for(Method method:methods.values()){source.append("case ").append(id++).append(" -> ").append(method.getDeclaringClass()==Math.class&&method.getName().equals("round")?"studio.engine.expression.WorkerJdkRound":method.getDeclaringClass().getCanonicalName()).append('.').append(method.getName()).append('(');for(int i=0;i<method.getParameterCount();i++){if(i>0)source.append(',');if(method.getParameterTypes()[i]!=double.class)throw new IllegalStateException("Unexpected native expression argument type");source.append("((Number)values[").append(i).append("]).doubleValue()");}source.append(");\n");}
        source.append("default -> throw WorkerExpressions.failure(\"Unknown expression method handle\");};}\n}");Path root=Path.of(args[0]);Path output=root.resolve("studio/engine/expression/ExpressionMath.java");Files.createDirectories(output.getParent());Files.writeString(output,source);Files.writeString(Path.of(args[1]),new com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(Map.of("nativeMethods",methods.keySet(),"methodCount",methods.size()))+"\n");
    }
    private static String key(Method m){StringBuilder d=new StringBuilder("(");for(Class<?> type:m.getParameterTypes())d.append(type.descriptorString());return m.getDeclaringClass().getName().replace('.','/')+"."+m.getName()+d+")"+m.getReturnType().descriptorString();}
}
