// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.registry;
/** The exact exported native solidity flag, including the native default-state lookup. */
public final class RotationPredicates {
    public static boolean isSolid(RotationState state){return(state.state.flags&2)!=0;}
}
