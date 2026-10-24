// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
/** Lowercase byte encoding used by the original native image hash accumulator. */
public final class WorkerImageHex {
    public static WorkerImageHex of(){return new WorkerImageHex();}
    public String formatHex(byte[] bytes){String digits="0123456789abcdef";StringBuilder result=new StringBuilder(bytes.length*2);for(byte value:bytes){result.append(digits.charAt((value>>>4)&15));result.append(digits.charAt(value&15));}return result.toString();}
}
