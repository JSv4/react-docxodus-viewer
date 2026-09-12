import { useCallback, useEffect, useRef, useState } from 'react';

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Latest-request state, with cancellation and protection against updates after unmount. */
export function useAsyncOperation<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isRunning, setRunning] = useState(false);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    request.current++;
    controller.current?.abort();
    controller.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => {
    request.current++;
    controller.current?.abort();
  }, []);

  const run = useCallback(async (operation: (signal: AbortSignal) => T | Promise<T>): Promise<T> => {
    const id = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError(null);
    try {
      const result = await operation(abort.signal);
      if (id === request.current) setData(result);
      return result;
    } catch (cause) {
      const failure = toError(cause);
      if (id === request.current) setError(failure);
      throw failure;
    } finally {
      if (id === request.current) {
        setRunning(false);
        controller.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setData(null);
    setError(null);
  }, [cancel]);

  return { data, error, isRunning, run, cancel, reset };
}
