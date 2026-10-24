// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.cache;
/** Native cache counters confined to one serialized worker. */
public final class WorkerPlanCounter {private long value;public void increment(){value++;}public long sum(){return value;}}
