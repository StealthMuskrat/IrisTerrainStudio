/*
 * Copyright (c) 1994, 2025, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */
// SPDX-License-Identifier: GPL-2.0-only WITH Classpath-exception-2.0
// Adapted from pinned OpenJDK 25 Math.round(float/double); full corresponding source is bundled.
package studio.engine.expression;
public final class WorkerJdkRound {
    private WorkerJdkRound(){}
    public static int round(float value){
        int bits=Float.floatToRawIntBits(value);
        int exponent=(bits&0x7f800000)>>23;
        int shift=(24-2+127)-exponent;
        if((shift&-32)==0){int significand=(bits&0x007fffff)|0x00800000;if(bits<0)significand=-significand;return ((significand>>shift)+1)>>1;}
        return (int)value;
    }
    public static long round(double value){
        long bits=Double.doubleToRawLongBits(value);
        long exponent=(bits&0x7ff0000000000000L)>>52;
        long shift=(53-2+1023)-exponent;
        if((shift&-64)==0){long significand=(bits&0x000fffffffffffffL)|0x0010000000000000L;if(bits<0)significand=-significand;return ((significand>>shift)+1)>>1;}
        return (long)value;
    }
}
