// SPDX-License-Identifier: GPL-3.0-or-later
package studio.build;

import art.arcane.iris.generation.runtime.Engine;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/** Generate fail-closed declarations for the native engine's platform-facing API. */
public final class GenerateEngineBoundary {
    private static final Set<String> NATIVE_DEFAULTS=Set.of("getAllBiomes","getDimensionStackContext","isAdditionalTerrainOwned","getSubterrainCell","getSubterrainBiome","getCaveBiome","getSurfaceBiome","getHostSurfaceBiome","answersFromNaturalTerrain","getGenerationSessionId","getGenerationSessions","isTerrainSurfaceSolid","getNativeStructureVolumes","acquireGenerationLease","isClosing");
    public static void main(String[] args) throws Exception {
        generate(Engine.class,"EngineBoundary",args[0]);
        generate(art.arcane.iris.spi.IrisPlatform.class,"PlatformBoundary",args[0]);
        generate(art.arcane.iris.generation.mantle.EngineMantle.class,"MantleBoundary",args[0]);
    }
    private static void generate(Class<?> api,String name,String directory)throws Exception {
        TreeMap<String,Method> methods=new TreeMap<>();
        for(Method method:api.getMethods())if(!Modifier.isStatic(method.getModifiers())){
            String key=method.getName()+Arrays.toString(method.getParameterTypes());
            Method old=methods.get(key);
            if(old==null||old.getReturnType().isAssignableFrom(method.getReturnType()))methods.put(key,method);
        }
        StringBuilder out=new StringBuilder("// Generated from the pinned native host interface.\npackage studio.engine.terrain;\n@SuppressWarnings({\"rawtypes\",\"unchecked\"})\npublic abstract class "+name+" implements "+api.getCanonicalName()+" {\n");
        for(Method method:methods.values()){
            out.append("@Override public ").append(method.getReturnType().getCanonicalName()).append(' ').append(method.getName()).append('(');
            Class<?>[] parameters=method.getParameterTypes();
            for(int i=0;i<parameters.length;i++){if(i>0)out.append(',');out.append(parameters[i].getCanonicalName()).append(" p").append(i);}
            if(api==Engine.class&&NATIVE_DEFAULTS.contains(method.getName())||api==art.arcane.iris.generation.mantle.EngineMantle.class&&Set.of("getData","getComplex","trueHeight","getFluidHeight","insertMatter","getHighest","isPreventingDecay","isUnderwater","isDebugSmartBore").contains(method.getName())){
                if(!method.isDefault())throw new IllegalStateException("Pinned native engine default changed: "+method);
                out.append(')');Class<?>[] errors=method.getExceptionTypes();if(errors.length>0){out.append(" throws ");for(int i=0;i<errors.length;i++){if(i>0)out.append(',');out.append(errors[i].getCanonicalName());}}out.append('{');if(method.getReturnType()!=void.class)out.append("return ");out.append(api.getCanonicalName()).append(".super.").append(method.getName()).append('(');for(int i=0;i<parameters.length;i++){if(i>0)out.append(',');out.append('p').append(i);}out.append(");}\n");
            }else out.append("){throw studio.engine.UnsupportedPlatform.unavailable(\"Native engine platform operation: ").append(method.getName()).append("\");}\n");
        }
        out.append("}\n");Path file=Path.of(directory,"studio/engine/terrain/"+name+".java");Files.createDirectories(file.getParent());Files.writeString(file,out);
    }
}
