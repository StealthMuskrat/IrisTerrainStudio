// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.image;
/** Synchronous SHA-256 platform service for the original native image hash accumulator (FIPS 180-4). */
public final class WorkerImageDigest {
    private static final int[] K={0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
    private final byte[] block=new byte[64];private final int[] words=new int[64],state=new int[8];private int used;private long length;
    private WorkerImageDigest(){reset();}
    public static WorkerImageDigest getInstance(String algorithm){if(!"SHA-256".equals(algorithm))throw new IllegalArgumentException("Only native image SHA-256 is linked");return new WorkerImageDigest();}
    private void reset(){int[] initial={0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};System.arraycopy(initial,0,state,0,8);used=0;length=0;}
    public void update(byte value){block[used++]=value;length++;if(used==64){compress();used=0;}}
    public void update(byte[] bytes){for(byte value:bytes)update(value);}
    public byte[] digest(){long bits=length*8;update((byte)0x80);while(used!=56)update((byte)0);for(int i=7;i>=0;i--)update((byte)(bits>>>(8*i)));byte[] result=new byte[32];for(int i=0;i<8;i++)for(int n=0;n<4;n++)result[i*4+n]=(byte)(state[i]>>>(24-8*n));reset();return result;}
    private static int rotate(int value,int n){return Integer.rotateRight(value,n);}
    private void compress(){
        for(int i=0;i<16;i++){int at=i*4;words[i]=((block[at]&255)<<24)|((block[at+1]&255)<<16)|((block[at+2]&255)<<8)|(block[at+3]&255);}
        for(int i=16;i<64;i++){int a=words[i-15],b=words[i-2];words[i]=words[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+words[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10));}
        int a=state[0],b=state[1],c=state[2],d=state[3],e=state[4],f=state[5],g=state[6],h=state[7];
        for(int i=0;i<64;i++){int first=h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+words[i];int second=(rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c));h=g;g=f;f=e;e=d+first;d=c;c=b;b=a;a=first+second;}
        state[0]+=a;state[1]+=b;state[2]+=c;state[3]+=d;state[4]+=e;state[5]+=f;state[6]+=g;state[7]+=h;
    }
}
