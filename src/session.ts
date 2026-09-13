import { initialize, createBlankDocx, TrackedChangeMode } from 'docxodus/core';
import type { DocxSession, DocxSessionSettings, EditResult, EditorRenderOptions } from 'docxodus/core';
import { openNativeSession } from './nativeSession';
import type { NativeSession } from './nativeSession';

interface RenderChange { from: number; to: number; anchors: string[] | null }
// During atomic callbacks getVersion() still reports the base version. Only
// explicitly read-only calls may pass through without invalidating local edits.
const READ_ONLY = new Set<string>([
  'project', 'projectAnchor', 'getVersion', 'getPackageManifest', 'getPageMapStatus', 'getPageCitation', 'checkPreconditions',
  'renderBlock', 'previewBatch', 'getTableMetadata', 'resolveTableCellAnchor', 'resolveTableCellCoordinate',
  'listComments', 'listHyperlinks', 'getImageCapabilities', 'listImages', 'listContentControls', 'listBookmarks', 'listRevisions',
  'grep', 'grepCrossBlock', 'findPlaceholders', 'getEditSummary', 'remainingPlaceholders', 'getDiff', 'getSemanticChanges', 'verifyDeliverable',
  'findByAnnotation', 'findByLabel', 'findByBookmark', 'exists', 'findByText', 'findAllByText', 'findByRegex', 'findByKind',
  'getAnchorInfo', 'getAnchorInfos', 'getBlockMetadata', 'getBlockMetadatas', 'getListMembership', 'getSectionInfo',
  'listStyles', 'getFormatting', 'listInlineSpans', 'listAnnotations', 'save',
] satisfies (keyof DocxSession)[]);
function covered(changes: RenderChange[], from: number, to: number): string[] | null {
  const anchors = new Set<string>();
  for (const change of changes) {
    if (change.from !== from || !change.anchors) return null;
    change.anchors.forEach(id => anchors.add(id)); from = change.to;
  }
  return from === to ? [...anchors] : null;
}

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
  private bridge: NativeSession | null = null;
  private journal: RenderChange[] = [];
  private pendingChanges: RenderChange[] = [];
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
      // Full-render fallbacks and saved checkpoints retain the live anchor identities.
      const bridge = openNativeSession(input, { persistAnchorIds: true, ...settings });
      const native = bridge.session;
      const previous = this.native;
      const methods = new Map<PropertyKey, unknown>();
      const observed = new Proxy(native, {
        get: (target, property) => {
          const value: unknown = Reflect.get(target, property, target);
          if (property === 'raw' && value && typeof value === 'object') {
            if (!methods.has(property)) {
              const rawMethods = new Map<PropertyKey, unknown>();
              methods.set(property, new Proxy(value, { get: (raw, key) => {
                const method: unknown = Reflect.get(raw, key, raw);
                if (typeof method !== 'function') return method;
                if (!rawMethods.has(key)) rawMethods.set(key, (...args: unknown[]) => {
                  if (target !== this.native) throw new Error('This document session has been closed or replaced.');
                  return this.invoke(() => Reflect.apply(method, raw, args), `raw.${String(key)}`);
                });
                return rawMethods.get(key);
              } }));
            }
            return methods.get(property);
          }
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
      this.bridge = bridge;
      this.journal = []; this.pendingChanges = [];
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
    const from = this.native?.getVersion() ?? 0;
    const start = this.pendingChanges.length;
    this.depth++;
    try {
      const result = operation();
      const to = this.native?.getVersion() ?? from;
      const edit = result as EditResult | undefined;
      const local = (name === 'replaceMatch' || name === 'applyFormat') && edit?.success &&
        edit.created?.length === 0 && edit.removed?.length === 0 && edit.modified?.length &&
        edit.modified.every(ref => /^(p|h|li):(body|fn|en):/.test(ref.id));
      const children = this.pendingChanges.slice(start);
      if (from !== to) {
        let anchors = local ? edit!.modified.map(ref => ref.id) :
          (name === 'run' || name === 'executeBatch' || name === 'runWithPreconditions') ? covered(children, from, to) : null;
        // Atomic callbacks edit a native shadow document. Its public version
        // remains at baseVersion until one successful transaction commit.
        const batch = result as ReturnType<DocxSession['executeBatch']> | undefined;
        if (name === 'executeBatch' && children.length && batch?.mode === 'atomic' && batch.success &&
          !batch.preview && !batch.rolledBack && batch.baseVersion === from && batch.resultVersion === to) {
          anchors ??= covered(children, from, from);
        }
        this.pendingChanges.splice(start, this.pendingChanges.length - start, { from, to, anchors });
      } else if (this.depth === 1 || (name === 'executeBatch' &&
        ((result as ReturnType<DocxSession['executeBatch']>)?.rolledBack || (result as ReturnType<DocxSession['executeBatch']>)?.preview))) {
        this.pendingChanges.splice(start);
      } else if (local || (!READ_ONLY.has(name) && !['run', 'executeBatch', 'runWithPreconditions'].includes(name))) {
        this.pendingChanges.splice(start, this.pendingChanges.length - start, { from, to, anchors: local ? edit!.modified.map(ref => ref.id) : null });
      }
      if (name === 'setTrackedChanges' || name === 'setRevisionAuthor' || name === 'registerPageMap') this.configurationChanged = true;
      if (result && typeof result === 'object' && 'then' in result) {
        throw new Error('Session callbacks must be synchronous. Await external work before calling run().');
      }
      if (this.depth === 1 && this.native) {
        const version = this.native.getVersion();
        this.journal.push(...this.pendingChanges.splice(0));
        this.journal = this.journal.slice(-128);
        if (version !== this.snapshot.version || this.configurationChanged) {
          this.publish({ version, change: this.snapshot.change + 1, lastResult: result, error: null, trackedChanges: this.trackedChanges });
        }
      }
      return result;
    } catch (cause) {
      const to = this.native?.getVersion() ?? from;
      this.pendingChanges.splice(start, this.pendingChanges.length - start, ...(to === from && this.depth === 1 ? [] : [{ from, to, anchors: null }]));
      if (this.depth === 1) {
        this.journal.push(...this.pendingChanges.splice(0));
        this.journal = this.journal.slice(-128);
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

  /** Lightweight native anchor inventory; avoids generating the Markdown projection. */
  getAnchorIndex() {
    if (!this.bridge) throw new Error('Open a document session first.');
    return this.bridge.anchorIndex();
  }

  /** Null requires a full render: unknown, structural, missing, or replaced history. */
  getRenderChanges(owner: DocxSession, fromVersion: number): string[] | null {
    if (owner !== this.snapshot.session || !this.native) return null;
    if (fromVersion === this.snapshot.version) return [];
    const start = this.journal.findIndex(change => change.from === fromVersion);
    return start < 0 ? null : covered(this.journal.slice(start), fromVersion, this.snapshot.version);
  }

  /** Uses the same live handle as mutations, including native comments/list context. */
  renderBlocks(ids: readonly string[], options: EditorRenderOptions) {
    if (!this.bridge) throw new Error('Open a document session first.');
    return this.bridge.renderBlocks(ids, options);
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
    this.bridge = null; this.journal = []; this.pendingChanges = [];
    this.original = null;
    this.publish({ ...EMPTY_SESSION_SNAPSHOT, change: this.snapshot.change + 1 });
  };
}
