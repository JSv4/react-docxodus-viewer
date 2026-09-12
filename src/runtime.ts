import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as engine from 'docxodus/core';
import { createWorkerDocxodus, isWorkerSupported } from 'docxodus/worker';
import type { WorkerDocxodus } from 'docxodus/worker';
import { toError } from './hooks/useAsyncOperation';

export interface DocxodusRuntimeOptions {
  wasmBasePath?: string;
  /** Use the worker for supported operations. Full sessions initialize core on demand. */
  useWorker?: boolean;
  warmup?: boolean;
  enabled?: boolean;
}

export type DocxodusEngine = typeof engine;

export function useRuntimeController({ wasmBasePath, useWorker = true, warmup = false, enabled = true }: DocxodusRuntimeOptions) {
  const workerMode = useWorker && isWorkerSupported();
  const key = `${wasmBasePath ?? ''}:${workerMode}:${enabled}`;
  const [state, setState] = useState<{ key: string; worker: WorkerDocxodus | null; ready: boolean; error: Error | null }>({
    key: '', worker: null, ready: false, error: null,
  });
  const initializeCore = useCallback(async () => {
    await engine.initialize(wasmBasePath);
    return engine;
  }, [wasmBasePath]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let owned: WorkerDocxodus | null = null;
    const abort = new AbortController();
    const start = async () => {
      try {
        if (workerMode) owned = await createWorkerDocxodus({ wasmBasePath, signal: abort.signal });
        else await initializeCore();
        if (disposed) owned?.terminate();
        else setState({ key, worker: owned, ready: true, error: null });
      } catch (cause) {
        if (!disposed) setState({ key, worker: null, ready: false, error: toError(cause) });
      }
    };
    void start();
    return () => { disposed = true; abort.abort(); owned?.terminate(); };
  }, [enabled, workerMode, wasmBasePath, initializeCore, key]);

  const current = state.key === key;
  const worker = current ? state.worker : null;
  useEffect(() => {
    if (warmup && worker) void worker.prepare().catch(() => { /* Optional warmup. */ });
  }, [warmup, worker]);

  const convertToHtml = useCallback(async (document: File | Uint8Array, options?: engine.ConversionOptions) => {
    if (worker) return worker.convertDocxToHtml(document, options);
    return (await initializeCore()).convertDocxToHtml(document, options);
  }, [worker, initializeCore]);

  const getRevisions = useCallback(async (document: File | Uint8Array) => {
    if (worker) return worker.getRevisions(document);
    return (await initializeCore()).getRevisions(document);
  }, [worker, initializeCore]);

  const getDocumentMetadata = useCallback(async (document: File | Uint8Array) => {
    if (worker) return worker.getDocumentMetadata(document);
    return (await initializeCore()).getDocumentMetadata(document);
  }, [worker, initializeCore]);

  return useMemo(() => ({
    api: engine,
    worker,
    wasmBasePath,
    isReady: enabled && current && state.ready,
    isLoading: enabled && (!current || (!state.ready && !state.error)),
    error: current ? state.error : null,
    initializeCore,
    convertToHtml,
    getRevisions,
    getDocumentMetadata,
  }), [worker, wasmBasePath, enabled, current, state, initializeCore, convertToHtml, getRevisions, getDocumentMetadata]);
}

export type DocxodusRuntime = ReturnType<typeof useRuntimeController>;
export const RuntimeContext = createContext<DocxodusRuntime | null>(null);

/** Share a provider's runtime, or own one when used independently. */
export function useDocxodusRuntime(options: DocxodusRuntimeOptions = {}): DocxodusRuntime {
  const provided = useContext(RuntimeContext);
  const local = useRuntimeController({ ...options, enabled: !provided && options.enabled !== false });
  return provided ?? local;
}
