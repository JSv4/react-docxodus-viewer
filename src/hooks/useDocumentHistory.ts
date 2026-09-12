import { useCallback, useEffect, useRef, useState } from 'react';
import { createMemoryHistoryStorage, HistoryCheckpoints, openDocxHistory, openDocxHistoryArchive, openIndexedDbHistoryStore } from 'docxodus/core';
import type { DocxHistoryClient, DocxHistoryReader, DocxHistoryDocument, DocxHistoryArchive, DocxHistoryView, DocxStoredVersion, DocxVersionMetadata, HistoryBlobReference, HistoryCheckpointJournal, HistoryCheckpointRequest, HistoryStorage, IndexedDbHistoryStore } from 'docxodus/core';
import { useDocxodusRuntime } from '../runtime';
import { documentBytes } from '../session';
import type { DocumentSource } from '../session';
import { toError, useAsyncOperation } from './useAsyncOperation';

/** Insert-only journal, with the same request-retention semantics as persistent storage. */
export function createMemoryCheckpointJournal(): HistoryCheckpointJournal {
  let pending: HistoryCheckpointRequest | null = null;
  return {
    read: async () => structuredClone(pending),
    put: async request => { pending ??= structuredClone(request); return structuredClone(pending); },
    remove: async id => { if (pending?.id === id) pending = null; },
  };
}

export interface UseDocumentHistoryOptions {
  documentId: string;
  storage?: HistoryStorage;
  journal?: HistoryCheckpointJournal;
  /** Explicit persistence. Without this or storage, history exists in memory only. */
  indexedDbName?: string;
  /** Open a portable archive read-only. Omit to use writable storage. */
  archive?: DocumentSource | null;
  wasmBasePath?: string;
  pageSize?: number;
}

export interface HistoryContext {
  reader: DocxHistoryReader;
  document: DocxHistoryDocument | null;
  client: DocxHistoryClient | null;
  checkpoints: HistoryCheckpoints | null;
}

interface OwnedHistory extends HistoryContext {
  alive: boolean;
  pending: number;
  dispose: () => void;
}

async function lease<T>(resource: OwnedHistory, operation: (context: HistoryContext) => Promise<T>): Promise<T> {
  if (!resource.alive) throw new Error('This history has been closed or replaced.');
  resource.pending++;
  try { return await operation(resource); }
  finally { resource.pending--; if (!resource.alive && resource.pending === 0) resource.dispose(); }
}

export function useDocumentHistory(options: UseDocumentHistoryOptions) {
  const { documentId, storage, journal, indexedDbName, archive, pageSize = 20 } = options;
  const runtime = useDocxodusRuntime({ wasmBasePath: options.wasmBasePath, enabled: false });
  const { initializeCore } = runtime;
  const [memoryStorage] = useState(() => createMemoryHistoryStorage());
  const [memoryJournals] = useState(() => new Map<string, HistoryCheckpointJournal>());
  const loadingCursor = useRef<HistoryBlobReference | null>(null);
  const [resource, setResource] = useState<OwnedHistory | null>(null);
  const [view, setView] = useState<DocxHistoryView | null>(null);
  const [versions, setVersions] = useState<DocxStoredVersion[]>([]);
  const [next, setNext] = useState<HistoryBlobReference | null>(null);
  const [initialError, setInitialError] = useState<Error | null>(null);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  const task = useAsyncOperation<unknown>();
  const { run: runTask } = task;

  useEffect(() => {
    let disposed = false;
    let owned: OwnedHistory | null = null;
    let database: IndexedDbHistoryStore | null = null;
    let archiveHandle: DocxHistoryArchive | null = null;
    let client: DocxHistoryClient | null = null;
    let closed = false;
    const dispose = () => {
      if (closed) return;
      closed = true;
      archiveHandle?.close(); client?.close(); database?.close();
    };
    const start = async () => {
      try {
        await Promise.resolve();
        if (disposed) return;
        setResource(null); setInitialError(null); setRefreshError(null); setView(null); setVersions([]); setNext(null);
        if (!documentId) throw new Error('A stable documentId is required for history.');
        if (storage && indexedDbName) throw new Error('Choose storage or indexedDbName, not both.');
        await initializeCore();
        if (disposed) return;
        let context: HistoryContext;
        if (archive) {
          archiveHandle = await openDocxHistoryArchive(await documentBytes(archive));
          context = { reader: archiveHandle, document: null, client: null, checkpoints: null };
        } else {
          if (indexedDbName) database = await openIndexedDbHistoryStore(indexedDbName);
          client = openDocxHistory(storage ?? database?.storage ?? memoryStorage);
          const document = client.document(documentId);
          if (!memoryJournals.has(documentId)) memoryJournals.set(documentId, createMemoryCheckpointJournal());
          const checkpoints = await HistoryCheckpoints.open(document, journal ?? database?.journal(documentId) ?? memoryJournals.get(documentId)!);
          context = { reader: document, document, client, checkpoints };
        }
        if (disposed) { dispose(); return; }
        owned = { ...context, alive: true, pending: 0, dispose };
        const { current, page } = await lease(owned, async context => {
          const current = await context.reader.read();
          const page = current ? await context.reader.listVersions(null, pageSize) : { versions: [], next: null };
          return { current, page };
        });
        if (disposed) return;
        setInitialError(null);
        setResource(owned);
        setView(current);
        setVersions(page.versions);
        setNext(page.next);
      } catch (cause) {
        dispose();
        if (!disposed) { setInitialError(toError(cause)); setResource(null); }
      }
    };
    void start();
    return () => {
      disposed = true;
      if (owned) { owned.alive = false; if (!owned.pending) owned.dispose(); }
    };
  }, [documentId, storage, journal, indexedDbName, archive, pageSize, memoryStorage, memoryJournals, initializeCore]);

  const execute = useCallback(<T,>(operation: (context: HistoryContext) => Promise<T>): Promise<T> => runTask(async () => {
    if (!resource?.alive) throw new Error('History is not ready.');
    return lease(resource, operation);
  }) as Promise<T>, [resource, runTask]);

  const reload = useCallback(async (context: HistoryContext, refreshCheckpoint = true) => {
    const current = refreshCheckpoint && context.checkpoints ? await context.checkpoints.refresh() : await context.reader.read();
    const page = current ? await context.reader.listVersions(null, pageSize) : { versions: [], next: null };
    if (resource?.alive) { setView(current); setVersions(page.versions); setNext(page.next); setRefreshError(null); }
    return current;
  }, [resource, pageSize]);

  const afterCheckpoint = useCallback(async (context: HistoryContext, acknowledged: DocxHistoryView) => {
    if (resource?.alive) {
      setView(acknowledged);
      setVersions(previous => [acknowledged.version, ...previous.filter(version => version.id.digest.value !== acknowledged.version.id.digest.value)]);
    }
    try { await reload(context, false); }
    catch (cause) {
      if (resource?.alive) setRefreshError(new Error(`Checkpoint saved; the history list could not refresh: ${toError(cause).message}`, { cause }));
    }
    return acknowledged;
  }, [resource, reload]);

  const save = useCallback((bytes: Uint8Array, metadata: DocxVersionMetadata) => execute(async context => {
    if (!context.checkpoints) throw new Error('This history archive is read-only.');
    const result = await context.checkpoints.save(bytes, metadata);
    // Preserve the acknowledged checkpoint; a later refresh may observe another tab's head.
    return afterCheckpoint(context, result);
  }), [execute, afterCheckpoint]);

  const restore = useCallback((target: HistoryBlobReference, metadata: DocxVersionMetadata) => execute(async context => {
    if (!context.checkpoints) throw new Error('This history archive is read-only.');
    const result = await context.checkpoints.restore(target, metadata);
    return afterCheckpoint(context, result);
  }), [execute, afterCheckpoint]);

  const retry = useCallback(() => execute(async context => {
    if (!context.checkpoints) throw new Error('This history archive is read-only.');
    const result = await context.checkpoints.retry();
    return afterCheckpoint(context, result);
  }), [execute, afterCheckpoint]);

  const loadMore = useCallback(() => execute(async context => {
    if (!next || loadingCursor.current === next) return;
    loadingCursor.current = next;
    try {
      const page = await context.reader.listVersions(next, pageSize);
      if (resource?.alive) { setVersions(previous => [...previous, ...page.versions]); setNext(page.next); }
    } finally { if (loadingCursor.current === next) loadingCursor.current = null; }
  }), [execute, next, pageSize, resource]);

  return {
    documentId: resource?.reader.documentId ?? documentId,
    view, versions, nextCursor: next,
    isLoading: !resource?.alive && !initialError,
    isBusy: task.isRunning,
    error: initialError ?? task.error ?? refreshError,
    canWrite: !!resource?.alive && !!resource.checkpoints,
    pendingRequest: resource?.checkpoints?.pendingRequest ?? null,
    needsRefresh: resource?.checkpoints?.needsRefresh ?? false,
    execute, save, restore, retry, loadMore,
    refresh: () => execute(context => reload(context)),
    preview: (version?: HistoryBlobReference) => execute(context => context.reader.exportDocx(version)),
    compare: (before: HistoryBlobReference, after: HistoryBlobReference) => execute(context => context.reader.compareVersions(before, after)),
    exportArchive: () => execute(context => context.reader.exportHistoryArchive()),
    importArchive: (bytes: Uint8Array) => execute(async context => {
      if (!context.client) throw new Error('Open writable history to import an archive.');
      const result = await context.client.importHistoryArchive(bytes);
      if (result.archive.documentId === context.reader.documentId) await reload(context);
      return result;
    }),
    resolveTime: (cutoff: string) => execute(context => context.reader.resolveSequenceAtTime(cutoff)),
    materialize: (sequence: string) => execute(context => context.reader.materialize(sequence)),
    replay: (sequence: string) => execute(context => context.reader.replay(sequence)),
    readChangesSince: (...args: Parameters<DocxHistoryReader['readChangesSince']>) => execute(context => context.reader.readChangesSince(...args)),
    readOperationsSince: (...args: Parameters<DocxHistoryReader['readOperationsSince']>) => execute(context => context.reader.readOperationsSince(...args)),
    getOperation: (id: HistoryBlobReference) => execute(context => context.reader.getOperation(id)),
    exportOperationProposal: (id: HistoryBlobReference) => execute(context => context.reader.exportOperationProposal(id)),
  };
}

export type DocumentHistory = ReturnType<typeof useDocumentHistory>;
