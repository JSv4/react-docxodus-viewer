import { initialize, openDocxSession, createBlankDocx, TrackedChangeMode } from 'docxodus/core';
import type { DocxSession, DocxSessionSettings } from 'docxodus/core';

export type DocumentSource = File | Uint8Array;

export interface DocxSessionSnapshot {
  session: DocxSession | null;
  version: number;
  change: number;
  isLoading: boolean;
  error: Error | null;
  lastResult: unknown;
  trackedChanges: TrackedChangeMode;
}

export const EMPTY_SESSION_SNAPSHOT: DocxSessionSnapshot = {
  session: null, version: 0, change: 0, isLoading: false, error: null, lastResult: null, trackedChanges: TrackedChangeMode.Accept,
};

export async function documentBytes(source: DocumentSource): Promise<Uint8Array> {
  return source instanceof Uint8Array ? source.slice() : new Uint8Array(await source.arrayBuffer());
}

/**
 * Owns a native session and observes its complete API without changing its synchronous
 * contracts. Atomic batch callbacks and preconditions retain their upstream semantics.
 */
export class DocxSessionController {
  private native: DocxSession | null = null;
  private snapshot: DocxSessionSnapshot = EMPTY_SESSION_SNAPSHOT;
  private listeners = new Set<() => void>();
  private generation = 0;
  private depth = 0;
  private configurationChanged = false;
  private trackedChanges = TrackedChangeMode.Accept;
  private original: Uint8Array | null = null;
  private settings: DocxSessionSettings = {};
  private wasmBasePath?: string;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snapshot;

  private publish(update: Partial<DocxSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    for (const listener of this.listeners) listener();
  }

  /** Original bytes stay detached from both caller buffers and session mutations. */
  get originalBytes(): Uint8Array | null { return this.original?.slice() ?? null; }

  async open(source: DocumentSource | 'blank', settings: DocxSessionSettings = this.settings, wasmBasePath = this.wasmBasePath): Promise<DocxSession> {
    const generation = ++this.generation;
    this.publish({ isLoading: true, error: null });
    try {
      const bytes = source === 'blank' ? null : await documentBytes(source);
      await initialize(wasmBasePath);
      if (generation !== this.generation) throw new DOMException('Document open was superseded', 'AbortError');
      const input = bytes ?? createBlankDocx();
      // The React viewer renders saved snapshots, so identities must survive that round trip.
      const native = openDocxSession(input, { persistAnchorIds: true, ...settings });
      const previous = this.native;
      const methods = new Map<PropertyKey, unknown>();
      const observed = new Proxy(native, {
        get: (target, property) => {
          const value: unknown = Reflect.get(target, property, target);
          if (typeof value !== 'function' || property === 'constructor') return value;
          if (!methods.has(property)) {
            methods.set(property, (...args: unknown[]) => {
              if (target !== this.native) throw new Error('This document session has been closed or replaced.');
              if (property === 'close') { this.close(); return; }
              return this.invoke(() => {
                const result = Reflect.apply(value, target, args);
                if (property === 'setTrackedChanges') this.trackedChanges = args[0] as TrackedChangeMode;
                return result;
              }, String(property));
            });
          }
          return methods.get(property);
        },
      });
      this.native = native;
      this.original = input.slice();
      this.settings = { ...settings };
      this.wasmBasePath = wasmBasePath;
      this.trackedChanges = settings.trackedChanges === 'render_inline' ? TrackedChangeMode.RenderInline : settings.trackedChanges === 'strip_deletions' ? TrackedChangeMode.StripDeletions : TrackedChangeMode.Accept;
      previous?.close();
      this.publish({ session: observed, version: native.getVersion(), change: this.snapshot.change + 1, isLoading: false, lastResult: null, trackedChanges: this.trackedChanges });
      return observed;
    } catch (cause) {
      if (generation === this.generation) this.publish({ isLoading: false, error: cause instanceof Error ? cause : new Error(String(cause)) });
      throw cause;
    }
  }

  private invoke<T>(operation: () => T, name = 'run'): T {
    this.depth++;
    try {
      const result = operation();
      if (name === 'setTrackedChanges' || name === 'setRevisionAuthor' || name === 'registerPageMap') this.configurationChanged = true;
      if (result && typeof result === 'object' && 'then' in result) {
        throw new Error('Session callbacks must be synchronous. Await external work before calling run().');
      }
      if (this.depth === 1 && this.native) {
        const version = this.native.getVersion();
        if (version !== this.snapshot.version || this.configurationChanged) {
          this.publish({ version, change: this.snapshot.change + 1, lastResult: result, error: null, trackedChanges: this.trackedChanges });
        }
      }
      return result;
    } catch (cause) {
      if (this.depth === 1) {
        this.publish({
          version: this.native?.getVersion() ?? this.snapshot.version,
          change: this.snapshot.change + 1,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        });
      }
      throw cause;
    } finally {
      this.depth--;
      if (!this.depth) this.configurationChanged = false;
    }
  }

  /** Full typed API access; nested mutations produce one React notification. */
  run<T>(operation: (session: DocxSession) => T): T {
    if (operation.constructor.name === 'AsyncFunction') throw new Error('Session callbacks must be synchronous. Await external work before calling run().');
    const session = this.snapshot.session;
    if (!session) throw new Error('Open a document session first.');
    return this.invoke(() => operation(session));
  }

  save(): Uint8Array {
    if (!this.native) throw new Error('Open a document session first.');
    return this.native.save();
  }

  /** Read-only selectors run without emitting mutation notifications. */
  read<T>(selector: (session: DocxSession) => T): T {
    if (!this.native) throw new Error('Open a document session first.');
    return selector(this.native);
  }

  close = () => {
    ++this.generation;
    this.native?.close();
    this.native = null;
    this.original = null;
    this.publish({ ...EMPTY_SESSION_SNAPSHOT, change: this.snapshot.change + 1 });
  };
}
