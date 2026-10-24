// SPDX-License-Identifier: GPL-3.0-or-later
package art.arcane.iris.probe;

import art.arcane.volmlib.nativelib.minecraft26_2.modded.NativeBlockProperties;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Pattern;

/** Capture the unchanged pinned placement method once per exact input-equivalence pair. */
public final class NativePlacementGroups {
    // The proof below applies to this exact source only. Changed upstream code must refuse,
    // rather than silently use an incomplete key or fall back to a quadratic native sweep.
    public static final String SOURCE_SHA256="64d583bb5256c374d5931b1b481f7d8dfc453da04ae0943d74a57f7ac8284cc3";
    private record Inputs(int identity,boolean foliage,boolean plantable,boolean leaves,boolean solid){}
    private record Group(Block representative,List<Integer> members){}
    public record Result(byte[] bits,long allowed,int groups,long evaluations,String sourceSha256){}

    @SuppressWarnings("unchecked")
    public static Result capture(List<Block> blocks,Path source)throws Exception{
        byte[] bytes=Files.readAllBytes(source);
        if(!HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)).equals(SOURCE_SHA256))throw new IllegalStateException("Native placement source changed; review its input-equivalence proof before exporting");
        String text=new String(bytes,java.nio.charset.StandardCharsets.UTF_8);
        String method=text.substring(text.indexOf("public static boolean canPlaceOnto(Block mat, Block onto)"));
        // In this pinned method every conditional reads only: Blocks identity, the
        // following three sets, or isSolid(mat.defaultBlockState()). Capture all of them
        // for BOTH parameters. Over-partitioning is harmless and keeps the proof simple.
        var identities=new IdentityHashMap<Block,Integer>();
        var names=new TreeSet<String>();var matcher=Pattern.compile("\\bBlocks\\.([A-Z][A-Z_0-9]*)").matcher(method);
        while(matcher.find())names.add(matcher.group(1));
        for(String name:names){Block block=(Block)Blocks.class.getField(name).get(null);if(!identities.containsKey(block))identities.put(block,identities.size());}
        Map<String,Set<Block>> sets=new HashMap<>();
        for(var field:NativeBlockProperties.class.getDeclaredFields())if(Set.class.isAssignableFrom(field.getType())&&Pattern.compile("\\b"+field.getName()+"\\b").matcher(method).find()){
            field.setAccessible(true);sets.put(field.getName(),(Set<Block>)field.get(null));
        }
        if(names.isEmpty()||!sets.keySet().equals(Set.of("FOLIAGE","FOLIAGE_PLANTABLE_MATERIAL","PLACE_ONTO_LEAVES")))throw new IllegalStateException("Pinned placement input shape changed");
        if(blocks.isEmpty()||blocks.size()>8192)throw new IllegalArgumentException("Invalid placement block count");
        Set<Block> unique=Collections.newSetFromMap(new IdentityHashMap<>());
        var indexed=new LinkedHashMap<Inputs,Group>();
        for(int index=0;index<blocks.size();index++){
            Block block=Objects.requireNonNull(blocks.get(index));if(!unique.add(block))throw new IllegalArgumentException("Duplicate placement block identity");
            Inputs key=new Inputs(identities.getOrDefault(block,-1),sets.get("FOLIAGE").contains(block),sets.get("FOLIAGE_PLANTABLE_MATERIAL").contains(block),sets.get("PLACE_ONTO_LEAVES").contains(block),NativeBlockProperties.isSolid(block.defaultBlockState()));
            indexed.computeIfAbsent(key,ignored->new Group(block,new ArrayList<>())).members.add(index);
        }
        List<Group> groups=new ArrayList<>(indexed.values());
        if(groups.size()>128)throw new IllegalStateException("Native placement groups exceed the reviewed export budget");
        int count=blocks.size();byte[] placement=new byte[(count*count+7)/8];long allowed=0,evaluations=0;
        for(Group material:groups)for(Group onto:groups){
            boolean value=NativeBlockProperties.canPlaceOnto(material.representative,onto.representative);evaluations++;
            if(!value)continue;
            allowed+=(long)material.members.size()*onto.members.size();
            for(int from:material.members)for(int to:onto.members){int bit=from*count+to;placement[bit>>>3]|=(byte)(1<<(bit&7));}
        }
        return new Result(placement,allowed,groups.size(),evaluations,SOURCE_SHA256);
    }
}
