// SPDX-License-Identifier: GPL-3.0-or-later
package studio.engine.hydrology;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;

/** Serial worker completion ABI. It never waits for another thread or simulates a completed plan. */
public final class WorkerHydrologyCompletion<T> {
    private boolean done;private T value;private Throwable failure;
    private final List<BiConsumer<? super T,? super Throwable>> listeners=new ArrayList<>();
    public static <T>WorkerHydrologyCompletion<T> completedFuture(T value){var completion=new WorkerHydrologyCompletion<T>();completion.complete(value);return completion;}
    public static <T>WorkerHydrologyCompletion<T> failedFuture(Throwable failure){var completion=new WorkerHydrologyCompletion<T>();completion.completeExceptionally(failure);return completion;}
    public boolean complete(T result){if(done)return false;done=true;value=result;publish();return true;}
    public boolean completeExceptionally(Throwable error){Objects.requireNonNull(error);if(done)return false;done=true;failure=error;publish();return true;}
    private void publish(){var pending=new ArrayList<>(listeners);listeners.clear();for(var listener:pending)listener.accept(value,failure);}
    public boolean isDone(){return done;}
    public T get()throws InterruptedException,ExecutionException{requireDone();if(failure!=null)throw new ExecutionException(failure);return value;}
    public T join(){requireDone();if(failure!=null)throw new studio.engine.cache.WorkerPlanCompletionException(failure);return value;}
    private void requireDone(){if(!done)throw studio.engine.UnsupportedPlatform.unavailable("Waiting for another hydrology worker");}
    public WorkerHydrologyCompletion<T> whenComplete(BiConsumer<? super T,? super Throwable> action){
        Objects.requireNonNull(action);var next=new WorkerHydrologyCompletion<T>();
        BiConsumer<T,Throwable> listener=(result,error)->{Throwable thrown=null;try{action.accept(result,error);}catch(Throwable problem){thrown=problem;}if(error!=null)next.completeExceptionally(error);else if(thrown!=null)next.completeExceptionally(thrown);else next.complete(result);};
        if(done)listener.accept(value,failure);else listeners.add(listener);return next;
    }
    public <U>WorkerHydrologyCompletion<U> handle(BiFunction<? super T,Throwable,? extends U> action){
        Objects.requireNonNull(action);var next=new WorkerHydrologyCompletion<U>();
        whenComplete((result,error)->{try{next.complete(action.apply(result,error));}catch(Throwable failure){next.completeExceptionally(failure);}});return next;
    }
    public static WorkerHydrologyCompletion<Object> anyOf(WorkerHydrologyCompletion<?>... values){
        Objects.requireNonNull(values);var result=new WorkerHydrologyCompletion<Object>();
        for(var value:values)Objects.requireNonNull(value);
        for(var value:values)value.whenComplete((completed,error)->{if(error==null)result.complete(completed);else result.completeExceptionally(error);});
        return result;
    }
    public static WorkerHydrologyCompletion<Void> allOf(WorkerHydrologyCompletion<?>... values){
        Objects.requireNonNull(values);for(var value:values)Objects.requireNonNull(value);
        var result=new WorkerHydrologyCompletion<Void>();if(values.length==0){result.complete(null);return result;}
        int[] remaining={values.length};Throwable[] failure={null};
        for(var value:values)value.whenComplete((completed,error)->{if(failure[0]==null)failure[0]=error;if(--remaining[0]==0){if(failure[0]==null)result.complete(null);else result.completeExceptionally(failure[0]);}});
        return result;
    }
}
