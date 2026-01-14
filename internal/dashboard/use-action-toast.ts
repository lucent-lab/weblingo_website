"use client";

import { useEffect, useRef } from "react";

import { toast } from "sonner";

type ActionResult = {
  ok: boolean;
  message?: string;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

export function useActionToast<T extends ActionResult>(options: {
  formAction: (formData: FormData) => void;
  state: T;
  pending: boolean;
  loading: string;
  success: string;
  error: string;
}): (formData: FormData) => void {
  const { formAction, state, pending, loading, success, error } = options;
  const deferredRef = useRef<Deferred<T> | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (pending && !deferredRef.current) {
      const deferred = createDeferred<T>();
      deferredRef.current = deferred;
      toastIdRef.current = toast.promise(deferred.promise, {
        loading,
        success: (result) => result.message || success,
        error: (err) => (err instanceof Error ? err.message : error),
      });
      return;
    }
    if (!pending && deferredRef.current) {
      const deferred = deferredRef.current;
      deferredRef.current = null;
      toastIdRef.current = null;
      if (state.ok) {
        deferred.resolve(state);
        return;
      }
      const message = state.message?.trim();
      deferred.reject(new Error(message || error));
    }
  }, [pending, state, error, loading, success]);

  useEffect(() => {
    return () => {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
      }
      toastIdRef.current = null;
      deferredRef.current = null;
    };
  }, []);

  return formAction;
}
