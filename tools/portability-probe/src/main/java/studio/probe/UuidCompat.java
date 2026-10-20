// SPDX-License-Identifier: GPL-3.0-or-later
package studio.probe;

import java.util.UUID;
import java.util.Arrays;
import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/** Missing JDK UUID-v3 operations for TeaVM, checked independently against the native JDK. */
public final class UuidCompat {
    private static final int[] SHIFTS = {
        7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
        5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
        4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
        6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
    };
    private static final int[] CONSTANTS = {
        0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
        0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
        0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
        0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
        0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
        0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
        0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
        0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
    };

    public static UUID nameUUIDFromBytes(byte[] bytes) {
        byte[] digest = md5(bytes);
        digest[6] = (byte) ((digest[6] & 0x0f) | 0x30);
        digest[8] = (byte) ((digest[8] & 0x3f) | 0x80);
        StringBuilder out = new StringBuilder();
        String hex = "0123456789abcdef";
        for (int i = 0; i < digest.length; i++) {
            if (i == 4 || i == 6 || i == 8 || i == 10) out.append('-');
            out.append(hex.charAt((digest[i] >>> 4) & 15)).append(hex.charAt(digest[i] & 15));
        }
        return UUID.fromString(out.toString());
    }

    public static long getMostSignificantBits(UUID uuid) { return half(uuid, 0); }
    public static long getLeastSignificantBits(UUID uuid) { return half(uuid, 16); }

    public static byte[] utf8(String value, Charset charset) {
        if (!charset.equals(StandardCharsets.UTF_8)) throw new IllegalArgumentException("Only the pinned RNG UTF-8 call is supported");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int i = 0; i < value.length(); i++) {
            int c = value.charAt(i);
            if (c < 0x80) out.write(c);
            else if (c < 0x800) { out.write(0xc0 | (c >>> 6)); out.write(0x80 | (c & 63)); }
            else if (c >= 0xd800 && c <= 0xdbff && i + 1 < value.length() &&
                    value.charAt(i + 1) >= 0xdc00 && value.charAt(i + 1) <= 0xdfff) {
                int codepoint = 0x10000 + ((c - 0xd800) << 10) + value.charAt(++i) - 0xdc00;
                out.write(0xf0 | (codepoint >>> 18)); out.write(0x80 | ((codepoint >>> 12) & 63));
                out.write(0x80 | ((codepoint >>> 6) & 63)); out.write(0x80 | (codepoint & 63));
            } else if (c >= 0xd800 && c <= 0xdfff) out.write('?');
            else { out.write(0xe0 | (c >>> 12)); out.write(0x80 | ((c >>> 6) & 63)); out.write(0x80 | (c & 63)); }
        }
        return out.toByteArray();
    }

    private static long half(UUID uuid, int start) {
        String value = uuid.toString().replace("-", "");
        long out = 0;
        for (int i = start; i < start + 16; i++) {
            char c = value.charAt(i);
            out = (out << 4) | (c <= '9' ? c - '0' : c - 'a' + 10);
        }
        return out;
    }

    // RFC 1321 integer operations; constants are fixed, never recomputed through floating point.
    private static byte[] md5(byte[] bytes) {
        int h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;
        long blocks = (bytes.length + 8L) / 64 + 1;
        long lengthStart = blocks * 64 - 8;
        long bitLength = bytes.length * 8L;
        int[] words = new int[16];
        for (long block = 0; block < blocks; block++) {
            for (int word = 0; word < 16; word++) {
                int value = 0;
                for (int offset = 0; offset < 4; offset++) {
                    long position = block * 64 + word * 4 + offset;
                    int b = position < bytes.length ? bytes[(int) position] & 255 : position == bytes.length ? 128 :
                        position >= lengthStart ? (int) (bitLength >>> ((position - lengthStart) * 8)) & 255 : 0;
                    value |= b << (offset * 8);
                }
                words[word] = value;
            }
            int a = h0, b = h1, c = h2, d = h3;
            for (int i = 0; i < 64; i++) {
                int f, index;
                if (i < 16) { f = (b & c) | (~b & d); index = i; }
                else if (i < 32) { f = (d & b) | (~d & c); index = (5 * i + 1) & 15; }
                else if (i < 48) { f = b ^ c ^ d; index = (3 * i + 5) & 15; }
                else { f = c ^ (b | ~d); index = (7 * i) & 15; }
                int previousD = d;
                d = c;
                c = b;
                b += Integer.rotateLeft(a + f + CONSTANTS[i] + words[index], SHIFTS[i]);
                a = previousD;
            }
            h0 += a; h1 += b; h2 += c; h3 += d;
        }
        byte[] digest = new byte[16];
        int[] state = { h0, h1, h2, h3 };
        for (int i = 0; i < 16; i++) digest[i] = (byte) (state[i / 4] >>> ((i & 3) * 8));
        return digest;
    }

    public static void verifyAgainstNativeJdk() {
        for (int size = 0; size <= 256; size++) {
            byte[] input = new byte[size];
            for (int i = 0; i < size; i++) input[i] = (byte) (i * 37 + size);
            UUID expected = UUID.nameUUIDFromBytes(input);
            UUID actual = nameUUIDFromBytes(input);
            if (!expected.toString().equals(actual.toString()) || expected.getMostSignificantBits() != getMostSignificantBits(actual)
                    || expected.getLeastSignificantBits() != getLeastSignificantBits(actual)) {
                throw new IllegalStateException("UUID compatibility mismatch at byte length " + size);
            }
        }
        System.err.println("UUID compatibility: 257 independent native JDK cases passed");
        for (int c = 0; c <= 0xffff; c++) verifyEncoding(String.valueOf((char) c));
        for (int high : new int[] {0xd800, 0xd801, 0xdbfe, 0xdbff}) {
            for (int low : new int[] {0xdc00, 0xdc01, 0xdffe, 0xdfff}) verifyEncoding(new String(new char[] {(char) high, (char) low}));
        }
        for (String value : new String[] {"", "Iris World Generator", "洞窟🌲", "é", "e\u0301", "line\n\u0000seed", "\uD800x\uDC00", "\uD800\uD800"}) verifyEncoding(value);
        System.err.println("UTF-8 compatibility: 65560 independent native JDK cases passed");
    }

    private static void verifyEncoding(String value) {
        if (!Arrays.equals(value.getBytes(StandardCharsets.UTF_8), utf8(value, StandardCharsets.UTF_8))) {
            throw new IllegalStateException("UTF-8 compatibility mismatch");
        }
    }
}
