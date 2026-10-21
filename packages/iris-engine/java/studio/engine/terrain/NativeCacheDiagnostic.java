// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import art.arcane.volmlib.util.cache.WorldCache2DDouble;
import com.google.gson.stream.JsonWriter;
import java.io.StringWriter;
import java.io.IOException;

/** Small fixed development probe shared by JVM and Wasm; no terrain or state enumeration. */
public final class NativeCacheDiagnostic {
    private static long key(int x,int z){return((long)x<<32)|(z&0xffffffffL);}
    private static String bits(double value){String hex=Long.toHexString(Double.doubleToRawLongBits(value));return "0000000000000000".substring(hex.length())+hex;}
    public static String run()throws IOException {
        int[] scalar={0},batch={0};WorldCache2DDouble cache=new WorldCache2DDouble((x,z)->{scalar[0]++;return -0D;},4);
        long[] coordinates={key(0,0),key(-1,4),key(-1,4),key(Integer.MIN_VALUE,Integer.MAX_VALUE)};double[] values=new double[4];cache.get(0,0);
        WorldCache2DDouble.BatchResolver resolver=(missing,count,target)->{batch[0]++;if(count!=2)throw new IllegalStateException("Expected two unique misses");target[0]=Double.longBitsToDouble(0x7ff8000000000023L);target[1]=Double.NEGATIVE_INFINITY;};
        cache.getBatch(coordinates,4,values,resolver);cache.getBatch(coordinates,4,values,resolver);
        WorldCache2DDouble failures=new WorldCache2DDouble((x,z)->99D,4);long[] retry={key(2,3),key(-7,-9)};double[] recovered=new double[2];boolean failed=false;
        try{failures.getBatch(retry,2,recovered,(missing,count,target)->{target[0]=42D;throw new IllegalStateException("fixed diagnostic failure");});}catch(IllegalStateException expected){failed=true;}
        int[] retryCount={0};failures.getBatch(retry,2,recovered,(missing,count,target)->{retryCount[0]=count;target[0]=1D;target[1]=2D;});
        WorldCache2DDouble winner=new WorldCache2DDouble((x,z)->17D,4);double[] published=new double[1];winner.getBatch(new long[]{key(7,-4)},1,published,(missing,count,target)->{winner.get(7,-4);target[0]=19D;});
        WorldCache2DDouble throwingScalar=new WorldCache2DDouble((x,z)->{if(scalar[0]++==1)throw new IllegalStateException("fixed scalar failure");return 23D;},1);boolean scalarFailed=false;try{throwingScalar.get(4,4);}catch(IllegalStateException expected){scalarFailed=true;}double scalarRetry=throwingScalar.get(4,4);
        int guards=0;try{cache.getBatch(new long[1],-1,new double[1],resolver);}catch(IndexOutOfBoundsException expected){guards++;}try{cache.getBatch(new long[1],2,new double[2],resolver);}catch(IndexOutOfBoundsException expected){guards++;}try{cache.getBatch(new long[4097],4097,new double[4097],resolver);}catch(IllegalArgumentException expected){guards++;}try{cache.getBatch(new long[0],0,new double[0],null);}catch(NullPointerException expected){guards++;}
        StringWriter output=new StringWriter();try(JsonWriter json=new JsonWriter(output)){
            json.beginObject();json.name("values").beginArray();for(double value:values)json.value(bits(value));json.endArray();json.name("batchCalls").value(batch[0]);json.name("batchFailure").value(failed);json.name("retryUniqueMisses").value(retryCount[0]);json.name("recovered").beginArray();for(double value:recovered)json.value(bits(value));json.endArray();json.name("publishedWinner").value(bits(published[0]));json.name("scalarFailure").value(scalarFailed);json.name("scalarRetry").value(bits(scalarRetry));json.name("guards").value(guards);json.name("retainedCells").value(cache.getSize());json.endObject();
        }return output.toString();
    }
    public static void main(String[] args)throws IOException{System.out.println(run());}
}
