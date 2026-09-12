import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { DocxSession, DocxSessionSettings } from 'docxodus/core';
import { DocxSessionController, EMPTY_SESSION_SNAPSHOT } from '../session';
import type { DocumentSource } from '../session';
import { useDocxodusRuntime } from '../runtime';

const noSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_SESSION_SNAPSHOT;

export function useSessionState(controller?: DocxSessionController | null) {
  return useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getSnapshot ?? emptySnapshot, emptySnapshot);
}

/** Reactive read-only projection over any native session query. */
export function useSessionQuery<T>(controller: DocxSessionController | null | undefined, selector: (session: DocxSession) => T) {
  const snapshot = useSessionState(controller);
  return useMemo(() => {
    if (!controller || !snapshot.session) return { data: null, error: null };
    try { return { data: controller.read(selector), error: null }; }
    catch (cause) { return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) }; }
  }, [controller, snapshot, selector]);
}

export interface UseDocxSessionOptions {
  wasmBasePath?: string;
  settings?: DocxSessionSettings;
}

/** Opens/replaces documents atomically and closes the owned native handle on unmount. */
export function useDocxSession(source?: DocumentSource | null, options: UseDocxSessionOptions = {}) {
  const [controller] = useState(() => new DocxSessionController());
  const runtime = useDocxodusRuntime({ wasmBasePath: options.wasmBasePath, enabled: false });
  const snapshot = useSessionState(controller);
  const settingsKey = JSON.stringify(options.settings ?? {});
  const open = useCallback((input: DocumentSource | 'blank', settings?: DocxSessionSettings) =>
    controller.open(input, settings ?? JSON.parse(settingsKey) as DocxSessionSettings, runtime.wasmBasePath),
  [controller, settingsKey, runtime.wasmBasePath]);

  useEffect(() => {
    if (source === undefined) return;
    if (source === null) { controller.close(); return; }
    void open(source).catch(() => { /* The controller exposes errors, retaining the previous document. */ });
  }, [source, open, controller]);
  useEffect(() => () => controller.close(), [controller]);

  return { ...snapshot, controller, open, create: () => open('blank'), close: controller.close };
}
