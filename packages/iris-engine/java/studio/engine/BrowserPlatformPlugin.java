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
            if(name.equals("art.arcane.iris.modded.ModdedStateRotator")){
                int callbacks=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateRotator")&&call.getMethod().getName().equals("rotate")){
                    Variable callback=p.createVariable();InvokeInstruction factory=new InvokeInstruction();factory.setType(InvocationType.SPECIAL);factory.setMethod(new MethodReference("studio.engine.registry.RotationFailures","instance",ValueType.object("java.util.function.Consumer")));factory.setReceiver(callback);call.insertPrevious(factory);Variable[] arguments=call.getArguments().toArray(Variable[]::new);arguments[2]=callback;call.setArguments(arguments);callbacks++;
                }}if(callbacks!=1)throw new IllegalStateException("Pinned native rotation failure callback changed");
            }
            if(java.util.Set.of("art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateMerger","art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockFaces","art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateRotator","net.minecraft.world.level.block.state.properties.RotationSegment","net.minecraft.util.SegmentedAnglePrecision").contains(name)){
                String[][] mappings={
                    {"art.arcane.volmlib.nativelib.minecraft26_2.modded.ModdedBlockState","studio.engine.registry.BrowserBlockState"},
                    {"art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockResolver","studio.engine.registry.MergeResolver"},
                    {"art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockResolver$Parsed","studio.engine.registry.MergeResolver$Parsed"},
                    {"net.minecraft.world.level.block.state.BlockState","studio.engine.registry.RotationState"},
                    {"net.minecraft.world.level.block.state.StateHolder","studio.engine.registry.RotationState"},
                    {"net.minecraft.world.level.block.Block","studio.engine.registry.RotationState$Block"},
                    {"net.minecraft.world.level.block.state.properties.Property","studio.engine.registry.RotationProperty"},
                    {"net.minecraft.world.level.block.state.properties.BooleanProperty","studio.engine.registry.RotationProperty$BooleanProperty"},
                    {"net.minecraft.world.level.block.state.properties.IntegerProperty","studio.engine.registry.RotationProperty$IntegerProperty"},
                    {"net.minecraft.world.level.block.state.properties.EnumProperty","studio.engine.registry.RotationProperty$EnumProperty"},
                    {"net.minecraft.core.Direction","studio.engine.registry.RotationTokens$Direction"},
                    {"net.minecraft.core.Direction$Axis","studio.engine.registry.RotationTokens$Axis"},
                    {"net.minecraft.world.level.block.state.properties.WallSide","studio.engine.registry.RotationTokens$WallSide"},
                    {"net.minecraft.world.level.block.state.properties.RedstoneSide","studio.engine.registry.RotationTokens$RedstoneSide"},
                    {"art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockProperties","studio.engine.registry.RotationPredicates"}
                };
                for(String[] mapping:mappings){replaceClass(cls,mapping[0],mapping[1]);replaceDeclarations(cls,mapping[0],mapping[1]);
                    for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int block=0;block<p.basicBlockCount();block++)for(Instruction instruction=p.basicBlockAt(block).getFirstInstruction();instruction!=null;instruction=instruction.getNext()){
                        if(instruction instanceof IsInstanceInstruction check)check.setType(replaced(check.getType(),mapping[0],mapping[1]));
                        if(instruction instanceof ClassConstantInstruction value)value.setConstant(replaced(value.getConstant(),mapping[0],mapping[1]));
                        if(instruction instanceof GetFieldInstruction field&&field.getField().getClassName().equals(mapping[0]))field.setField(new FieldReference(mapping[1],field.getField().getFieldName()));
                        if(instruction instanceof PutFieldInstruction field&&field.getField().getClassName().equals(mapping[0]))field.setField(new FieldReference(mapping[1],field.getField().getFieldName()));
                    }}
                }
            }
            if(name.equals("art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockFaces")){
                int handles=0,predicates=0;
                for(MethodHolder method:cls.getMethods()){
                    if(method.getName().equals("isFaceSturdy")){
                        Program p=new Program();p.createVariable();Variable state=p.createVariable(),face=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.registry.WorkerStateFaces",method.getDescriptor()));call.setArguments(state,face);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);predicates++;continue;
                    }
                    Program p=method.getProgram();if(p==null)continue;
                    for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().equals(new MethodReference("art.arcane.volmlib.nativelib.terrain.NativeBlockState","nativeHandle",ValueType.object("java.lang.Object")))){
                        Variable state=call.getInstance();call.setInstance(null);call.setArguments(state);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.registry.WorkerStateFaces","handle",ValueType.object("art.arcane.volmlib.nativelib.terrain.NativeBlockState"),ValueType.object("java.lang.Object")));handles++;
                    }
                }if(handles!=3||predicates!=1)throw new IllegalStateException("Pinned native face handle boundary changed");
            }
            if(name.equals("art.arcane.iris.modded.ModdedDecoratorHooks$Neighbors")){
                int storage=0;
                for(MethodHolder method:cls.getMethods())if(method.getName().equals("primary")){
                    Program p=method.getProgram();for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                        MethodReference ref=call.getMethod();String target=null;
                        if(ref.getClassName().equals("art.arcane.iris.generation.mantle.EngineMantle")&&ref.getName().equals("getMantle"))target="getMantle";
                        else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("get"))target="get";
                        if(target!=null){redirectHostCall(call,target);storage++;}
                    }
                }if(storage!=2)throw new IllegalStateException("Pinned decorator neighbor storage calls changed");
            }
            if(name.equals("art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateMerger")){
                int masks=0,handles=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("studio.engine.registry.BrowserBlockState")){
                    String target=call.getMethod().getName();if(target.equals("parsedProperties")){target="mergeProperties";masks++;}else if(target.equals("withHandle")){target="withMergedHandle";handles++;}else continue;
                    call.setMethod(new MethodReference(call.getMethod().getClassName(),new MethodDescriptor(target,call.getMethod().getSignature())));
                }}if(masks!=1||handles!=4)throw new IllegalStateException("Pinned native merger handle boundary changed: "+masks+","+handles);
            }
            if(name.equals("studio.engine.registry.WorkerStateMerging")){
                int hooks=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("create")){
                    Program p=new Program();p.createVariable();Variable resolver=p.createVariable(),merger=p.createVariable();BasicBlock b=p.createBasicBlock();ConstructInstruction construct=new ConstructInstruction();construct.setType("art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateMerger");construct.setReceiver(merger);b.add(construct);
                    InvokeInstruction init=new InvokeInstruction();init.setType(InvocationType.SPECIAL);init.setMethod(new MethodReference("art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeStateMerger","<init>",ValueType.object("studio.engine.registry.MergeResolver"),ValueType.VOID));init.setInstance(merger);init.setArguments(resolver);b.add(init);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(merger);b.add(exit);method.setProgram(p);hooks++;
                }if(hooks!=1)throw new IllegalStateException("Native state-merger constructor boundary changed");
            }
            if(name.equals("art.arcane.iris.generation.mantle.MantleObjectComponent")){
                replaceClass(cls,"art.arcane.iris.generation.mantle.ObjectSourcePlanCache","art.arcane.iris.generation.mantle.WorkerNativeSourcePlans");
                replaceDeclarations(cls,"art.arcane.iris.generation.mantle.ObjectSourcePlanCache","art.arcane.iris.generation.mantle.WorkerNativeSourcePlans");
                int hosts=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("<init>")){
                    Program p=method.getProgram();for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("art.arcane.iris.generation.mantle.WorkerNativeSourcePlans")&&call.getMethod().getName().equals("<init>")){
                        call.setArguments(p.variableAt(1));call.setMethod(new MethodReference("art.arcane.iris.generation.mantle.WorkerNativeSourcePlans","<init>",ValueType.object("art.arcane.iris.generation.mantle.EngineMantle"),ValueType.VOID));hosts++;
                    }
                }if(hosts!=1)throw new IllegalStateException("Pinned object cache ownership constructor changed");
                for(MethodHolder method:cls.getMethods())if(java.util.Set.of("loadObjectSize","placeObject","placeCaveObject","placeUpperObjects","placeContainedCaveObject","findCavePlacementAnchor").contains(method.getName()))unavailable(method,"Imported object lookup/placement or cave anchors outside guarded procedural previews");
            }
            if(name.equals("art.arcane.iris.generation.mantle.ObjectSourcePlan")){
                int mantles=0,heights=0;
                for(MethodHolder method:cls.getMethods()){
                    Program p=method.getProgram();if(p==null)continue;
                    for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                        MethodReference ref=call.getMethod();String target=null;
                        if(ref.getClassName().equals("art.arcane.iris.generation.mantle.MantleWriter")&&ref.getName().equals("getMantle")){target="getMantle";mantles++;}
                        else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("getWorldHeight")){target="getWorldHeight";heights++;}
                        if(target!=null)redirectHostCall(call,target);
                    }
                }if(mantles!=1||heights!=1)throw new IllegalStateException("Pinned continuation world-height boundary changed");
            }
            if(name.equals("art.arcane.iris.generation.mantle.GoldenDebugObjectPlacer"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("resolveGoldenDebugSpec")){
                Program p=new Program();p.createVariable();Variable result=p.createVariable();BasicBlock block=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerProceduralMap","debugSpec",ValueType.object("java.lang.String")));call.setReceiver(result);block.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);block.add(exit);method.setProgram(p);
            }
            if(name.equals("art.arcane.iris.generation.decoration.ruin.IrisRuin"))for(MethodHolder method:cls.getMethods())if(java.util.Set.of("getVariantObjects","getVariantObject").contains(method.getName()))unavailable(method,"Procedural ruins outside natural-object preview scope");
            if(name.equals("art.arcane.iris.generation.mantle.MantleCarvingComponent")){
                int mantle=0,chunks=0,heights=0;
                for(MethodHolder method:cls.getMethods()){
                    Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                        MethodReference ref=call.getMethod();String target=null;
                        if(ref.getClassName().equals("art.arcane.iris.generation.mantle.MantleWriter")&&ref.getName().equals("getMantle")){target="getMantle";mantle++;}
                        else if(ref.getClassName().equals("art.arcane.iris.generation.mantle.MantleWriter")&&ref.getName().equals("acquireChunk")){target="acquireChunk";chunks++;}
                        else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("getWorldHeight")){target="getWorldHeight";heights++;}
                        if(target!=null)redirectHostCall(call,target);
                    }
                }if(mantle!=2||chunks!=2||heights!=2)throw new IllegalStateException("Pinned carving component storage calls changed: "+mantle+","+chunks+","+heights);
            }
            if(name.equals("art.arcane.iris.generation.subterrain.SubterrainRasterizer")){
                int guards=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("rasterize")){
                    Program p=method.getProgram();InvokeInstruction guard=new InvokeInstruction();guard.setType(InvocationType.SPECIAL);guard.setMethod(new MethodReference("studio.engine.terrain.WorkerCaveStorage","admitSubterrain",ValueType.object("art.arcane.iris.generation.subterrain.SubterrainPlanner"),ValueType.INTEGER,ValueType.INTEGER,ValueType.VOID));guard.setArguments(p.variableAt(1),p.variableAt(2),p.variableAt(3));p.basicBlockAt(0).getFirstInstruction().insertPrevious(guard);guards++;
                }if(guards!=1)throw new IllegalStateException("Pinned subterrain rasterizer entry changed");
            }
            if(name.equals("art.arcane.iris.generation.stage.IrisDepositModifier")){
                int storage=0,dispatch=0;
                for(MethodHolder method:cls.getMethods())if(method.getName().equals("generateDeposits")){
                    Program p=method.getProgram();for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;){Instruction next=instruction.getNext();
                        if(instruction instanceof InvokeInstruction call){MethodReference ref=call.getMethod();String target=null;
                            if(ref.getName().equals("burst")&&ref.parameterCount()==0&&ref.getReturnType().equals(ValueType.object("art.arcane.iris.generation.concurrent.MultiBurst"))){NullConstantInstruction empty=new NullConstantInstruction();empty.setReceiver(call.getReceiver());instruction.replace(empty);dispatch++;}
                            else if(ref.getClassName().equals("art.arcane.iris.generation.concurrent.MultiBurst")&&ref.getName().equals("burst")&&ref.parameterCount()==1){java.util.List<Variable> args=new java.util.ArrayList<>(call.getArguments());call.setInstance(null);call.setArguments(args.toArray(Variable[]::new));call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerDepositDispatch","burst",ValueType.BOOLEAN,ValueType.object("studio.engine.terrain.WorkerDepositDispatch")));dispatch++;}
                            else if(ref.getClassName().equals("art.arcane.iris.generation.runtime.Engine")&&ref.getName().equals("getMantle"))target="engineMantle";
                            else if(ref.getClassName().equals("art.arcane.iris.generation.mantle.EngineMantle")&&ref.getName().equals("getMantle"))target="getMantle";
                            else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("useChunk"))target="useChunk";
                            if(target!=null){redirectHostCall(call,target);storage++;}
                        }instruction=next;
                    }
                }if(storage!=3||dispatch!=2)throw new IllegalStateException("Pinned deposit host calls changed: "+storage+","+dispatch);
                replaceClass(cls,"art.arcane.iris.generation.concurrent.BurstExecutor","studio.engine.terrain.WorkerDepositDispatch");
                replaceDeclarations(cls,"art.arcane.iris.generation.concurrent.BurstExecutor","studio.engine.terrain.WorkerDepositDispatch");
            }
            if(name.equals("art.arcane.iris.generation.stage.IrisPerfectionModifier")){
                int dispatch=0;for(MethodHolder method:cls.getMethods())if(java.util.Set.of("onModify","hideOres").contains(method.getName())){Program p=method.getProgram();for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;){Instruction next=instruction.getNext();if(instruction instanceof InvokeInstruction call){MethodReference ref=call.getMethod();if(ref.getName().equals("burst")&&ref.parameterCount()==0&&ref.getReturnType().equals(ValueType.object("art.arcane.iris.generation.concurrent.MultiBurst"))){NullConstantInstruction empty=new NullConstantInstruction();empty.setReceiver(call.getReceiver());instruction.replace(empty);dispatch++;}else if(ref.getClassName().equals("art.arcane.iris.generation.concurrent.MultiBurst")&&ref.getName().equals("burst")&&ref.parameterCount()==1){call.setInstance(null);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerDepositDispatch","burst",ValueType.BOOLEAN,ValueType.object("studio.engine.terrain.WorkerDepositDispatch")));dispatch++;}}instruction=next;}}
                if(dispatch!=4)throw new IllegalStateException("Pinned perfection dispatch changed");
                replaceClass(cls,"art.arcane.iris.generation.concurrent.BurstExecutor","studio.engine.terrain.WorkerDepositDispatch");
                replaceDeclarations(cls,"art.arcane.iris.generation.concurrent.BurstExecutor","studio.engine.terrain.WorkerDepositDispatch");
            }
            if(name.equals("art.arcane.iris.generation.mantle.EngineMantle")){
                int storage=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("insertMatter")){Program p=method.getProgram();for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){MethodReference ref=call.getMethod();String target=null;if(ref.getClassName().equals(name)&&ref.getName().equals("getMantle"))target="getMantle";else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("useChunk"))target="useChunk";if(target!=null){redirectHostCall(call,target);storage++;}}}if(storage!=2)throw new IllegalStateException("Pinned matter insertion calls changed");
            }
            if(java.util.Set.of("art.arcane.iris.generation.decoration.tree.TreeBlockCanvas","art.arcane.iris.generation.decoration.formation.FormationCanvas","art.arcane.iris.generation.decoration.coral.CoralCanvas","art.arcane.iris.generation.decoration.crystal.CrystalCanvas","art.arcane.iris.generation.decoration.fungus.FungusGenerator").contains(name))replaceClass(cls,"java.util.HashMap","studio.engine.terrain.WorkerProceduralMap");
            if(name.equals("art.arcane.iris.generation.decoration.tree.IrisProceduralTree")){
                int debug=0;for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().equals(new MethodReference(java.io.File.class,"isFile",boolean.class))){Variable file=call.getInstance();call.setInstance(null);call.setArguments(file);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerProceduralMap","debugFile",ValueType.object("java.io.File"),ValueType.BOOLEAN));debug++;}}
                if(debug!=1)throw new IllegalStateException("Pinned procedural debug-file boundary changed");
            }
            if(name.equals("art.arcane.iris.generation.mantle.MantleWriter$TerrainAccess"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("ensure"))unavailable(method,"Lazy terrain pass execution outside the prepared object window");
            if(java.util.Set.of("art.arcane.iris.structure.object.IrisObjectScale$CacheKey","art.arcane.iris.structure.object.IrisObjectTransforms").contains(name))replaceClass(cls,"java.util.concurrent.locks.Lock","studio.engine.terrain.WorkerLock");
            if(name.equals("art.arcane.volmlib.util.collection.KMap")){
                int enumerations=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("k")){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getName().equals("keys")&&call.getMethod().parameterCount()==0){Variable map=call.getInstance();call.setInstance(null);call.setArguments(map);call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(WorkerCollections.class,"enumeration",java.util.Map.class,java.util.Enumeration.class));enumerations++;}}
                if(enumerations!=1)throw new IllegalStateException("Pinned native key enumeration changed");
            }
            if(name.equals("art.arcane.iris.generation.block.TileData"))for(MethodHolder method:cls.getMethods())if(method.getProgram()!=null)unavailable(method,"Object tile-entity values");
            if(name.equals("art.arcane.iris.generation.block.IrisBlockData"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("getTile"))unavailable(method,"Object tile-entity material payloads");
            if(name.equals("art.arcane.iris.generation.block.BlockDataMergeSupport")){
                int hooks=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("merge")&&method.parameterCount()==2&&method.parameterType(0).equals(ValueType.object("art.arcane.volmlib.nativelib.terrain.NativeBlockState"))){
                    Program p=new Program();p.createVariable();Variable base=p.createVariable(),update=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.registry.WorkerStateMerging",method.getDescriptor()));call.setArguments(base,update);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);hooks++;
                }if(hooks!=1)throw new IllegalStateException("Pinned block-state merge boundary changed");
            }
            if(name.equals("art.arcane.iris.structure.object.IrisObjectRotation")){
                int hooks=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("rotate")&&method.parameterCount()==4&&method.parameterType(0).equals(ValueType.object("art.arcane.volmlib.nativelib.terrain.NativeBlockState"))){Program p=new Program();Variable self=p.createVariable(),state=p.createVariable(),x=p.createVariable(),y=p.createVariable(),z=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerObjectStateHooks","rotate",ValueType.object(name),ValueType.object("art.arcane.volmlib.nativelib.terrain.NativeBlockState"),ValueType.INTEGER,ValueType.INTEGER,ValueType.INTEGER,ValueType.object("art.arcane.volmlib.nativelib.terrain.NativeBlockState")));call.setArguments(self,state,x,y,z);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);hooks++;}if(hooks!=1)throw new IllegalStateException("Pinned object state-rotation boundary changed");
            }
            if(name.equals("art.arcane.iris.generation.mantle.WorkerObjectTransactions")){
                int factories=0;for(MethodHolder method:cls.getMethods())if(method.getName().equals("createWriter")){
                    Program p=new Program();p.createVariable();Variable engine=p.createVariable(),mantle=p.createVariable(),x=p.createVariable(),z=p.createVariable(),radius=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();ConstructInstruction construct=new ConstructInstruction();construct.setType("art.arcane.iris.generation.mantle.MantleWriter");construct.setReceiver(result);b.add(construct);InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setInstance(result);call.setArguments(engine,mantle,x,z,radius);call.setMethod(new MethodReference("art.arcane.iris.generation.mantle.MantleWriter","<init>",ValueType.object("art.arcane.iris.generation.mantle.EngineMantle"),ValueType.object("art.arcane.volmlib.util.mantle.runtime.Mantle"),ValueType.INTEGER,ValueType.INTEGER,ValueType.INTEGER,ValueType.VOID));b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.setProgram(p);factories++;
                }if(factories!=1)throw new IllegalStateException("Worker native writer factory changed");
            }
            if(java.util.Set.of("art.arcane.iris.generation.mantle.MantleWriter","art.arcane.iris.generation.mantle.ObjectDestinationTransaction").contains(name)){
                int heights=0,use=0,constructors=0;
                for(MethodHolder method:cls.getMethods()){
                    if(name.endsWith("MantleWriter")&&method.getName().equals("<init>")&&method.parameterCount()==5)constructors++;
                    Program p=method.getProgram();if(p==null)continue;
                    for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){MethodReference ref=call.getMethod();String target=null;if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("getWorldHeight")){target="getWorldHeight";heights++;}else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("useChunk")){target="useChunk";use++;}if(target!=null)redirectHostCall(call,target);}
                    if(name.endsWith("MantleWriter")&&method.getName().equals("acquireChunk")){InvokeInstruction guard=new InvokeInstruction();guard.setType(InvocationType.SPECIAL);guard.setMethod(new MethodReference("studio.engine.terrain.WorkerCaveStorage","requirePrepared",ValueType.INTEGER,ValueType.INTEGER,ValueType.VOID));guard.setArguments(p.variableAt(1),p.variableAt(2));p.basicBlockAt(0).getFirstInstruction().insertPrevious(guard);}
                }
                if(name.endsWith("MantleWriter")){if(heights!=13||use!=1||constructors!=1)throw new IllegalStateException("Pinned writer host boundary changed: "+heights+","+use+","+constructors);replaceClass(cls,"java.util.concurrent.atomic.AtomicReferenceArray","studio.engine.WorkerReferenceArray");}
                else if(heights!=1)throw new IllegalStateException("Pinned transaction world-height boundary changed");
            }
            if(java.util.Set.of("art.arcane.iris.structure.object.IrisObjectPlacementRunner","art.arcane.iris.structure.object.IrisObjectShaping").contains(name))replaceClass(cls,"java.util.concurrent.locks.Lock","studio.engine.terrain.WorkerLock");
            if(name.equals("art.arcane.iris.structure.object.IrisObjectIO")){
                int streams=0,tiles=0;
                for(MethodHolder method:cls.getMethods()){
                    if(method.getName().equals("readTile")){unavailable(method,"Native object tile-entity payloads");tiles++;}
                    Program p=method.getProgram();if(p!=null)for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.io.FileInputStream")&&call.getMethod().getName().equals("<init>"))streams++;
                }
                if(streams!=3||tiles!=1)throw new IllegalStateException("Pinned native object IO boundary changed");
                replaceClass(cls,"java.io.FileInputStream","studio.engine.pack.MemoryObjectStream");
                replaceClass(cls,"java.util.concurrent.locks.Lock","studio.engine.terrain.WorkerLock");
            }
            if(name.equals("art.arcane.iris.structure.object.IrisObject")){
                replaceClass(cls,"java.util.concurrent.locks.Lock","studio.engine.terrain.WorkerLock");
                replaceClass(cls,"java.util.concurrent.locks.ReentrantReadWriteLock","studio.engine.terrain.WorkerReadWriteLock");
                replaceClass(cls,"java.util.concurrent.locks.ReentrantReadWriteLock$ReadLock","studio.engine.terrain.WorkerReadWriteLock$ReadLock");
                replaceClass(cls,"java.util.concurrent.locks.ReentrantReadWriteLock$WriteLock","studio.engine.terrain.WorkerReadWriteLock$WriteLock");
            }
            if(name.equals("art.arcane.iris.generation.stage.IrisCarveModifier")){
                int hostCalls=0,decorationCalls=0,lookups=0;
                for(MethodHolder method:cls.getMethods()){
                    if(method.getName().equals("existingMantleChunk")){
                        Program p=new Program();p.createVariable();Variable mantle=p.createVariable(),x=p.createVariable(),z=p.createVariable(),result=p.createVariable();BasicBlock block=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerCaveStorage","existingChunk",ValueType.object("art.arcane.volmlib.util.mantle.runtime.Mantle"),ValueType.INTEGER,ValueType.INTEGER,ValueType.object("art.arcane.volmlib.util.mantle.runtime.MantleChunk")));call.setArguments(mantle,x,z);call.setReceiver(result);block.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);block.add(exit);method.setProgram(p);lookups++;continue;
                    }
                    if(!java.util.Set.of("onModify","decorateNaturalCaves").contains(method.getName()))continue;Program p=method.getProgram();for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                        MethodReference ref=call.getMethod();String target=null;
                        if(ref.getClassName().equals("art.arcane.iris.generation.runtime.Engine")&&ref.getName().equals("getMantle"))target="engineMantle";
                        else if(ref.getClassName().equals("art.arcane.iris.generation.mantle.EngineMantle")&&ref.getName().equals("getMantle"))target="getMantle";
                        else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("useChunk"))target="useChunk";
                        else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("set")&&method.getName().equals("decorateNaturalCaves"))target="setMarker";
                        if(target!=null){redirectHostCall(call,target);if(method.getName().equals("onModify"))hostCalls++;else decorationCalls++;}
                    }
                }if(hostCalls!=3||decorationCalls!=5||lookups!=1)throw new IllegalStateException("Pinned native cave modifier storage calls changed");
            }

            if(java.util.Set.of("art.arcane.volmlib.util.hunk.bits.HashPalette","art.arcane.volmlib.util.hunk.bits.LinearPalette").contains(name))replaceClass(cls,"java.util.concurrent.atomic.AtomicReferenceArray","studio.engine.WorkerReferenceArray");
            if(java.util.Set.of("art.arcane.volmlib.util.hunk.bits.DataContainer","art.arcane.volmlib.util.hunk.bits.DataBits").contains(name)){
                replaceClass(cls,"java.util.concurrent.atomic.AtomicLongArray","studio.engine.WorkerLongArray");
                replaceDeclarations(cls,"java.util.concurrent.atomic.AtomicLongArray","studio.engine.WorkerLongArray");
            }
            if(name.equals("art.arcane.volmlib.util.hunk.bits.DataContainer")){
                replaceClass(cls,"java.util.concurrent.locks.Lock","studio.engine.terrain.WorkerLock");
                replaceClass(cls,"java.util.concurrent.locks.ReentrantReadWriteLock","studio.engine.terrain.WorkerReadWriteLock");
                replaceClass(cls,"java.util.concurrent.locks.ReentrantReadWriteLock$ReadLock","studio.engine.terrain.WorkerReadWriteLock$ReadLock");
                replaceClass(cls,"java.util.concurrent.locks.ReentrantReadWriteLock$WriteLock","studio.engine.terrain.WorkerReadWriteLock$WriteLock");
            }
            if(name.equals("art.arcane.iris.generation.mantle.IrisCaveCarver3D")){
                int mantle=0,chunks=0,heights=0;
                for(MethodHolder method:cls.getMethods()){
                    if(java.util.Set.of("classifyPassParallel","sampleLatticeParallel").contains(method.getName())){unavailable(method,"Parallel cave dispatch in a single worker");continue;}
                    if(method.getName().equals("runDensityTasks")){unavailable(method,"ForkJoin cave work dispatch in one browser worker");continue;}
                    Program p=method.getProgram();if(p==null)continue;
                    // An opaque nullable-array host boundary avoids TeaVM's null-only
                    // primitive-array GC local inference defect. Native fallback logic remains.
                    for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;){Instruction next=instruction.getNext();if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals(name)&&java.util.Set.of("classifyPassParallel","sampleLatticeParallel").contains(call.getMethod().getName())){call.setMethod(new MethodReference("studio.engine.terrain.WorkerCaveDispatch",call.getMethod().getName().equals("classifyPassParallel")?"classification":"lattice",call.getMethod().getReturnType()));call.setInstance(null);call.setArguments();call.setType(InvocationType.SPECIAL);}instruction=next;}
                    for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext())if(instruction instanceof InvokeInstruction call){
                        MethodReference ref=call.getMethod();String target=null;
                        if(ref.getClassName().equals("art.arcane.iris.generation.mantle.MantleWriter")&&ref.getName().equals("getMantle")){target="getMantle";mantle++;}
                        else if(ref.getClassName().equals("art.arcane.iris.generation.mantle.MantleWriter")&&ref.getName().equals("acquireChunk")){target="acquireChunk";chunks++;}
                        else if(ref.getClassName().equals("art.arcane.volmlib.util.mantle.runtime.Mantle")&&ref.getName().equals("getWorldHeight")){target="getWorldHeight";heights++;}
                        if(target!=null){java.util.List<Variable> args=new java.util.ArrayList<>();args.add(call.getInstance());args.addAll(call.getArguments());ValueType[] old=ref.getDescriptor().getSignature(),signature=new ValueType[old.length+1];signature[0]=ValueType.object(ref.getClassName());System.arraycopy(old,0,signature,1,old.length);call.setInstance(null);call.setArguments(args.toArray(Variable[]::new));call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerCaveStorage",new MethodDescriptor(target,signature)));}
                    }
                }if(mantle!=1||chunks!=2||heights!=1)throw new IllegalStateException("Pinned cave storage call sites changed: "+mantle+","+chunks+","+heights);
            }
            if(name.equals("art.arcane.volmlib.util.mantle.MantleChunkSupport")){
                replaceClass(cls,"java.util.concurrent.atomic.AtomicReferenceArray","studio.engine.WorkerReferenceArray");
                replaceClass(cls,"java.util.concurrent.Semaphore","studio.engine.terrain.WorkerSemaphore");
            }
            if(name.equals("art.arcane.iris.generation.mantle.CaveDensityGrid$Column"))replaceClass(cls,"java.util.concurrent.atomic.AtomicReferenceArray","studio.engine.WorkerReferenceArray");
            if(java.util.Set.of("art.arcane.volmlib.util.atomics.AtomicAverage","art.arcane.volmlib.util.atomics.AtomicRollingSequence").contains(name)){
                replaceClass(cls,"com.google.common.util.concurrent.AtomicDoubleArray","studio.engine.terrain.WorkerDoubleArray");
                replaceClass(cls,"java.util.concurrent.atomic.DoubleAdder","studio.engine.terrain.WorkerDoubleAdder");
            }
            if(name.equals("art.arcane.iris.generation.context.ChunkContext")){
                replaceClass(cls,"java.util.concurrent.CompletableFuture","studio.engine.terrain.WorkerFuture");
                for(MethodHolder method:cls.getMethods()){
                    if(method.getName().equals("shouldPrefillAsync")){Program p=new Program();for(int i=0;i<=method.parameterCount();i++)p.createVariable();Variable value=p.createVariable();BasicBlock block=p.createBasicBlock();IntegerConstantInstruction zero=new IntegerConstantInstruction();zero.setConstant(0);zero.setReceiver(value);block.add(zero);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(value);block.add(exit);method.setProgram(p);}
                    Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;){Instruction next=instruction.getNext();if(instruction instanceof GetFieldInstruction field&&field.getField().equals(new FieldReference("art.arcane.iris.generation.concurrent.MultiBurst","burst"))){NullConstantInstruction empty=new NullConstantInstruction();empty.setReceiver(field.getReceiver());instruction.replace(empty);}instruction=next;}
                }
            }
            if(name.equals("art.arcane.iris.generation.simd.SimdSupport"))for(MethodHolder method:cls.getMethods()){
                if(method.getName().equals("<clinit>")){Program p=new Program();p.createVariable();p.createBasicBlock().add(new ExitInstruction());method.setProgram(p);}
                else if(method.getName().equals("kernels")){Program p=new Program();p.createVariable();Variable value=p.createVariable();BasicBlock block=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerTerrainPlatform","scalarKernels",ValueType.object("art.arcane.iris.generation.simd.SimdKernels")));call.setReceiver(value);block.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(value);block.add(exit);method.setProgram(p);}
                else if(method.getProgram()!=null)unavailable(method,"JVM vector-module discovery");
            }
            if(java.util.Set.of("art.arcane.iris.generation.runtime.UpperDimensionContext","art.arcane.iris.generation.runtime.DimensionStackContext").contains(name))for(MethodHolder method:cls.getMethods())if(method.getProgram()!=null)unavailable(method,"Upper or stacked dimension runtime");
            if(name.equals("java.util.TemplateCollections$NEtriesMap")){
                FieldHolder data=cls.getField("data");ValueType entries=ValueType.arrayOf(ValueType.object("java.util.Map$Entry"));if(data==null||!data.getType().equals(entries))throw new IllegalStateException("Pinned immutable-map storage changed");int changed=0;
                for(MethodHolder method:cls.getMethods())if(method.getName().equals("get")){
                    Program p=new Program();Variable self=p.createVariable(),key=p.createVariable(),array=p.createVariable(),result=p.createVariable();BasicBlock block=p.createBasicBlock();
                    GetFieldInstruction field=new GetFieldInstruction();field.setInstance(self);field.setField(new FieldReference(name,"data"));field.setFieldType(entries);field.setReceiver(array);block.add(field);
                    InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference(WorkerCollections.class,"immutableGet",java.util.Map.Entry[].class,Object.class,Object.class));call.setArguments(array,key);call.setReceiver(result);block.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);block.add(exit);method.setProgram(p);changed++;
                }if(changed!=1)throw new IllegalStateException("Pinned immutable-map get method changed");
            }
            if(java.util.Set.of("art.arcane.iris.generation.hydrology.runtime.IrisHydrologyRuntime","art.arcane.iris.world.history.TransitionDisplacementField","art.arcane.iris.world.history.TransitionGenerationPlan","art.arcane.iris.generation.terrain.transform.TerrainTransformRuntime","art.arcane.iris.generation.runtime.HydrologyNoiseCacheBudget","art.arcane.iris.generation.runtime.EngineThreadState").contains(name))for(MethodHolder method:cls.getMethods())if(method.getProgram()!=null)unavailable(method,"Native hydrology, saved-world transition or transform runtime");
            if(java.util.Set.of("art.arcane.iris.generation.cache.ConcurrentClockCache","art.arcane.iris.generation.terrain.Terrain3DRuntime$Anchor","art.arcane.iris.generation.terrain.Terrain3DRuntime$BlockCache").contains(name))replaceClass(cls,"java.util.concurrent.atomic.AtomicReferenceArray","studio.engine.WorkerReferenceArray");
            if(java.util.Set.of("art.arcane.iris.generation.terrain.Terrain3DFragmentFilter$DensityColumn","art.arcane.iris.generation.terrain.Terrain3DFragmentFilter$Traversal").contains(name))replaceClass(cls,"java.util.concurrent.atomic.AtomicIntegerArray","studio.engine.WorkerIntegerArray");
            if(name.equals("art.arcane.iris.generation.stream.CachedStream2D"))replaceClass(cls,"art.arcane.volmlib.util.cache.WorldCache2D","studio.engine.terrain.WorkerWorldCache");
            if(name.equals("art.arcane.iris.generation.stream.CachedDoubleStream2D"))replaceClass(cls,"art.arcane.volmlib.util.cache.WorldCache2DDouble","studio.engine.terrain.WorkerWorldDoubleCache");
            if(java.util.Set.of("art.arcane.iris.generation.runtime.SharedCornerBounds","art.arcane.iris.generation.mantle.CaveDensityGrid","art.arcane.iris.generation.mantle.CaveDensityGrid$Column","art.arcane.volmlib.util.parallel.AtomicBooleanArray").contains(name)){
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
            if(java.util.Set.of("art.arcane.iris.generation.terrain.IrisDimensionCarvingResolver","art.arcane.iris.generation.terrain.IrisDimensionCarvingResolver$State").contains(name))for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext()){
                if(instruction instanceof ConstructInstruction construct&&construct.getType().equals("java.lang.ref.WeakReference"))construct.setType("studio.engine.terrain.NullableWeakReference");
                if(instruction instanceof InvokeInstruction call&&call.getMethod().getClassName().equals("java.lang.ref.WeakReference")&&call.getMethod().getName().equals("<init>"))call.setMethod(new MethodReference("studio.engine.terrain.NullableWeakReference",call.getMethod().getDescriptor()));
            }}
            if(name.equals("art.arcane.iris.platform.bukkit.BukkitBlockState"))for(MethodHolder method:cls.getMethods())if(method.getProgram()!=null)unavailable(method,"Bukkit block-state handles in a browser worker");
            if(name.equals("art.arcane.iris.pack.loading.IrisData"))for(MethodHolder method:cls.getMethods())if(method.getName().equals("customBiomeResourceKey"))unavailable(method,"Custom biome registry contributions and epoch contracts");
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
            if(java.util.Set.of("art.arcane.volmlib.util.cache.AtomicCache","art.arcane.iris.world.entity.IrisAttributeModifier","art.arcane.iris.pack.loading.ResourceLoader","art.arcane.iris.spi.IrisLogging","art.arcane.iris.pack.validation.ContentGate","art.arcane.iris.generation.mantle.MantleObjectComponent").contains(name)){
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
                for(FieldHolder field:cls.getFields()){ValueType mapped=replaced(field.getType(),original,replacement);if(!mapped.equals(field.getType())){field.setType(mapped);field.setGenericType(null);}}
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
    private static ValueType replaced(ValueType type,String original,String replacement){if(type instanceof ValueType.Array array)return ValueType.arrayOf(replaced(array.getItemType(),original,replacement));return type.equals(ValueType.object(original))?ValueType.object(replacement):type;}
    private static void redirectHostCall(InvokeInstruction call,String target){MethodReference ref=call.getMethod();java.util.List<Variable> args=new java.util.ArrayList<>();args.add(call.getInstance());args.addAll(call.getArguments());ValueType[] old=ref.getSignature(),signature=new ValueType[old.length+1];signature[0]=ValueType.object(ref.getClassName());System.arraycopy(old,0,signature,1,old.length);call.setInstance(null);call.setArguments(args.toArray(Variable[]::new));call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("studio.engine.terrain.WorkerCaveStorage",new MethodDescriptor(target,signature)));}
    private static void replaceDeclarations(ClassHolder cls,String original,String replacement){
        for(MethodHolder old:new java.util.ArrayList<>(cls.getMethods())){
            ValueType[] signature=old.getDescriptor().getSignature();boolean changed=false;for(int i=0;i<signature.length;i++){ValueType next=replaced(signature[i],original,replacement);changed|=!next.equals(signature[i]);signature[i]=next;}if(!changed)continue;
            MethodHolder method=new MethodHolder(new MethodDescriptor(old.getName(),signature));method.setLevel(old.getLevel());method.getModifiers().addAll(old.getModifiers());method.setProgram(old.getProgram());method.setThrownTypes(old.getThrownTypes());method.setAnnotationDefault(old.getAnnotationDefault());org.teavm.model.util.ModelUtils.copyAnnotations(old.getAnnotations(),method.getAnnotations());for(int i=0;i<old.parameterCount();i++)org.teavm.model.util.ModelUtils.copyAnnotations(old.parameterAnnotation(i),method.parameterAnnotation(i));cls.removeMethod(old);cls.addMethod(method);
        }
    }
    private static void replaceClass(ClassHolder cls,String original,String replacement){
        for(FieldHolder field:cls.getFields()){ValueType mapped=replaced(field.getType(),original,replacement);if(!mapped.equals(field.getType())){field.setType(mapped);field.setGenericType(null);}}
        for(MethodHolder method:cls.getMethods()){Program p=method.getProgram();if(p==null)continue;for(int b=0;b<p.basicBlockCount();b++)for(Instruction instruction=p.basicBlockAt(b).getFirstInstruction();instruction!=null;instruction=instruction.getNext()){
            if(instruction instanceof ConstructInstruction construct&&construct.getType().equals(original))construct.setType(replacement);
            if(instruction instanceof ConstructArrayInstruction array)array.setItemType(replaced(array.getItemType(),original,replacement));
            if(instruction instanceof GetFieldInstruction get)get.setFieldType(replaced(get.getFieldType(),original,replacement));
            if(instruction instanceof PutFieldInstruction put)put.setFieldType(replaced(put.getFieldType(),original,replacement));
            if(instruction instanceof CastInstruction cast)cast.setTargetType(replaced(cast.getTargetType(),original,replacement));
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
