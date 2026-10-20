// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
/** Single-worker diagnostic counter. */
public final class WorkerDoubleAdder {
    private double value;
    public void add(double amount){value+=amount;}
    public double sum(){return value;}
}
