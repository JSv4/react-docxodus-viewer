import { useCallback } from 'react';
import type * as engine from 'docxodus/core';
import { useDocxodusRuntime } from '../runtime';
import type { DocxodusRuntimeOptions } from '../runtime';
import { useAsyncOperation } from './useAsyncOperation';

type Engine = typeof engine;
export type DocxodusOperation = {
  [K in keyof Engine]: Engine[K] extends (...args: never[]) => unknown ? K : never
}[keyof Engine];
export type OperationArguments<K extends DocxodusOperation> = Parameters<Engine[K]>;
export type OperationResult<K extends DocxodusOperation> = Awaited<ReturnType<Engine[K]>>;

/** Every exported engine function is callable with initialization and its original types. */
export function useDocxodusApi(options: DocxodusRuntimeOptions = {}) {
  const runtime = useDocxodusRuntime({ ...options, enabled: false });
  const { initializeCore } = runtime;
  const call = useCallback(async <K extends DocxodusOperation>(name: K, ...args: OperationArguments<K>): Promise<OperationResult<K>> => {
    const api = await initializeCore();
    const operation = api[name];
    return await Reflect.apply(operation, undefined, args) as OperationResult<K>;
  }, [initializeCore]);
  return { ...runtime, call };
}

/** Typed result, loading/error state, and stale-result suppression for any engine operation. */
export function useDocxodusOperation<K extends DocxodusOperation>(name: K, options: DocxodusRuntimeOptions = {}) {
  const { call } = useDocxodusApi(options);
  const task = useAsyncOperation<OperationResult<K>>();
  const { run } = task;
  const execute = useCallback((...args: OperationArguments<K>) => run(() => call(name, ...args)), [call, name, run]);
  return { ...task, execute };
}
