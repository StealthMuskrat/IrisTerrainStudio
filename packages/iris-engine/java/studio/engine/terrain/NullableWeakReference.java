// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.terrain;
import java.lang.ref.WeakReference;

/** Preserve weak ownership while avoiding TeaVM passing null to JavaScript WeakRef. */
public final class NullableWeakReference<T> extends WeakReference<T> {
    private static final Object EMPTY=new Object();
    @SuppressWarnings("unchecked") public NullableWeakReference(T value){super(value==null?(T)EMPTY:value);}
    @Override public T get(){T value=super.get();return value==EMPTY?null:value;}
}
