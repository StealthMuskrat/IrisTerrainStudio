// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine;

import art.arcane.volmlib.util.math.RNG;
import art.arcane.volmlib.util.noise.CNG;
import com.google.gson.stream.JsonWriter;
import java.io.*;

/** Owned Math-call probes plus three original CNG.fit entry points; JVM runs without the compiler plugin. */
public final class NativeRoundingDiagnostic {
    public static String sample(String binary64,String binary32)throws IOException{
        if(binary64==null||!binary64.matches("[0-9a-f]{16}")||binary32==null||!binary32.matches("[0-9a-f]{8}"))throw new IllegalArgumentException("Rounding diagnostics require exact hexadecimal IEEE bit patterns");
        double d=Double.longBitsToDouble((Long.parseLong(binary64.substring(0,8),16)<<32)|Long.parseLong(binary64.substring(8),16));float f=Float.intBitsToFloat((int)Long.parseLong(binary32,16));
        StringWriter text=new StringWriter();try(JsonWriter writer=new JsonWriter(text)){
            writer.beginObject();writer.name("doubleBits").value(binary64);writer.name("floatBits").value(binary32);
            writer.name("doubleRound").value(Long.toString(Math.round(d)));writer.name("floatRound").value(Math.round(f));
            writer.name("nativeCngEqualRange");
            if(Double.isFinite(d)&&Math.abs(d)<=2147483648D){var cng=new CNG(new RNG(1));writer.beginArray().value(cng.fit(d,d,new double[]{0,0})).value(cng.fit(d,d,0D,0D)).value(cng.fit(d,d,0D,0D,0D)).endArray();}else writer.nullValue();
            writer.endObject();
        }return text.toString();
    }
}
