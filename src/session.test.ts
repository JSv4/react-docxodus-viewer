import { afterEach, describe, expect, it, vi } from 'vitest';
import * as engine from 'docxodus/core';
import * as bridge from './nativeSession';
import type { DocxSession } from 'docxodus/core';
import { DocxSessionController } from './session';

class NativeSession {
  #version = 0;
  #batchVersion: number | null = null;
  private atomic: boolean;
  constructor(atomic = false) { this.atomic = atomic; }
  close = vi.fn();
  getVersion() { return this.#batchVersion ?? this.#version; }
  raw = { getXml: () => '<p />', replaceXml: (id: string) => this.replaceMatch({ enclosingAnchor: { id } }) };
  replaceText(_anchor: string, text: string) { this.#version++; return { success: true, text }; }
  replaceMatch(match: { enclosingAnchor: { id: string } }) {
    this.#version++;
    return { success: true, created: [], removed: [], modified: [match.enclosingAnchor] };
  }
  executeBatch(steps: { mutation: () => unknown }[]) {
    const before = this.#version;
    if (this.atomic) this.#batchVersion = before;
    try {
      const results = steps.map(step => step.mutation());
      if (!this.atomic) return results;
      this.#version = before + 1;
      return { mode: 'atomic', success: true, rolledBack: false, preview: false, baseVersion: before, resultVersion: this.#version };
    }
    catch (error) { this.#version = before; throw error; }
    finally { this.#batchVersion = null; }
  }
  setRevisionAuthor() {}
  setTrackedChanges() {}
  registerPageMap() { return { success: true }; }
  save() { return new Uint8Array([this.#version]); }
}

function nativeBridge(session: NativeSession): bridge.NativeSession {
  return { session: session as unknown as DocxSession, anchorIndex: () => ({}), renderBlocks: () => null };
}

afterEach(() => vi.restoreAllMocks());

describe('DocxSessionController', () => {
  it('reuses reads for unchanged paragraphs and invalidates unknown native changes', async () => {
    const native = new NativeSession();
    const getFormatting = vi.fn((id: string) => ({ anchorId: id, version: native.getVersion() }));
    const listStyles = vi.fn(() => []);
    const listRevisions = vi.fn(() => []);
    Object.assign(native, { getFormatting, listStyles, listRevisions });
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(native));
    const controller = new DocxSessionController();
    const owner = await controller.open(new Uint8Array([1]));
    const first = controller.getFormatting('p:body:a');
    const unchanged = controller.getFormatting('p:body:b');
    expect(controller.getFormatting('p:body:a')).toBe(first);
    controller.getStyles(); controller.getStyles(); controller.getRevisions();
    const match: Parameters<DocxSession['replaceMatch']>[0] = { enclosingAnchor: { id: 'p:body:a', kind: 'p', scope: 'body', unid: 'a' }, text: '', span: { start: 0, length: 0 }, fragments: [], contextBefore: '', contextAfter: '', groups: [] };
    owner.replaceMatch(match, 'edited');
    expect(controller.getFormatting('p:body:b')).toBe(unchanged);
    expect(controller.getFormatting('p:body:a')).not.toBe(first);
    controller.getStyles(); controller.getRevisions();
    expect(listStyles).toHaveBeenCalledTimes(1);
    expect(listRevisions).toHaveBeenCalledTimes(2);
    expect(getFormatting).toHaveBeenCalledTimes(3);
    // Read callbacks expose the original synchronous API; unobserved writes
    // must invalidate shared reads even before a React notification occurs.
    controller.read(s => s.replaceText('p:body:a', 'outside run'));
    expect(controller.getFormatting('p:body:b')).not.toBe(unchanged);
    controller.getStyles();
    expect(listStyles).toHaveBeenCalledTimes(2);
    controller.close();
    expect(() => controller.getFormatting('p:body:a')).toThrow('Open a document');
  });

  it('keeps document query snapshots stable on layout registration and refreshes settings', async () => {
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(new NativeSession()));
    const controller = new DocxSessionController();
    await controller.open(new Uint8Array([1]));
    const documentSnapshot = controller.getQuerySnapshot();
    const sessionSnapshot = controller.getSnapshot();
    controller.run(s => s.registerPageMap({} as Parameters<DocxSession['registerPageMap']>[0]));
    expect(controller.getQuerySnapshot()).toBe(documentSnapshot);
    expect(controller.getSnapshot()).not.toBe(sessionSnapshot);
    controller.run(s => s.setRevisionAuthor('Editor'));
    expect(controller.getQuerySnapshot()).toBe(controller.getSnapshot());
    expect(controller.getQuerySnapshot()).not.toBe(documentSnapshot);
  });

  it('reads atomic shadow changes without reusing cached base-version formatting', async () => {
    const native = new NativeSession(true);
    const getFormatting = vi.fn(() => ({ marker: 'before' }));
    Object.assign(native, { getFormatting });
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(native));
    const controller = new DocxSessionController();
    await controller.open(new Uint8Array([1]));
    const before = controller.getFormatting('p:body:a');
    controller.run(s => s.executeBatch([{ tool: 'test', action: 'shadow', mutation: () => {
      getFormatting.mockReturnValue({ marker: 'shadow' });
      expect(controller.getFormatting('p:body:a')).not.toBe(before);
      return s.replaceText('p:body:a', 'change');
    } }]));
    expect(controller.getFormatting('p:body:a')).toMatchObject({ marker: 'shadow' });
  });

  it('collects staged edits before atomic commit and treats raw mutations as a full-render boundary', async () => {
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(new NativeSession(true)));
    const controller = new DocxSessionController();
    const owner = await controller.open(new Uint8Array([1]));
    const match: Parameters<DocxSession['replaceMatch']>[0] = { enclosingAnchor: { id: 'p:body:a', kind: 'p', scope: 'body', unid: 'a' }, text: '', span: { start: 0, length: 0 }, fragments: [], contextBefore: '', contextAfter: '', groups: [] };
    controller.run(s => s.executeBatch([{ tool: 'test', action: 'local', mutation: () => {
      const edit = s.replaceMatch(match, 'one');
      expect(s.getVersion()).toBe(0); // The shadow's edits haven't committed yet.
      return edit;
    } }]));
    expect(controller.getRenderChanges(owner, 0)).toEqual(['p:body:a']);
    const raw = owner.raw;
    expect(raw.getXml).toBe(owner.raw.getXml);
    controller.run(s => s.executeBatch([{ tool: 'test', action: 'raw and local', mutation: () => {
      raw.replaceXml('p:body:b', '<p />');
      return s.replaceMatch(match, 'two');
    } }]));
    expect(controller.getRenderChanges(owner, 1)).toBeNull();
    expect(() => controller.run(s => s.executeBatch([{ tool: 'test', action: 'rollback', mutation: () => {
      s.replaceMatch(match, 'three'); throw new Error('rollback');
    } }]))).toThrow('rollback');
    expect(controller.getSnapshot().version).toBe(2);
    expect(controller.getRenderChanges(owner, 2)).toEqual([]);
    controller.close();
    expect(() => raw.getXml('p:body:a')).toThrow('closed or replaced');
  });
  it('journals local edits through nested batches, and invalidates unknown writes and replaced owners', async () => {
    const native = new NativeSession();
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(native));
    const controller = new DocxSessionController();
    const owner = await controller.open(new Uint8Array([1]));
    const match = (id: string): Parameters<DocxSession['replaceMatch']>[0] => ({ enclosingAnchor: { id, kind: 'p', scope: 'body', unid: id }, text: '', span: { start: 0, length: 0 }, fragments: [], contextBefore: '', contextAfter: '', groups: [] });
    controller.run(session => session.executeBatch([
      { tool: 'test', action: 'local', mutation: () => session.replaceMatch(match('p:body:a'), 'one') },
      { tool: 'test', action: 'local', mutation: () => session.replaceMatch(match('p:fn:b'), 'two') },
    ]));
    expect(controller.getRenderChanges(owner, 0)).toEqual(['p:body:a', 'p:fn:b']);
    controller.run(session => { session.replaceMatch(match('p:body:c'), 'three'); });
    expect(controller.getRenderChanges(owner, 0)).toEqual(['p:body:a', 'p:fn:b', 'p:body:c']);
    expect(controller.getRenderChanges(owner, 2)).toEqual(['p:body:c']);
    // An unobserved mutation inside run cannot masquerade as a local batch.
    controller.run(session => { native.replaceText('a', 'raw'); session.replaceMatch(match('p:body:a'), 'four'); });
    expect(controller.getRenderChanges(owner, 3)).toBeNull();
    controller.close();
    expect(controller.getRenderChanges(owner, 5)).toBeNull();
  });

  it('does not retain rolled-back local changes or reuse them for later versions', async () => {
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(new NativeSession()));
    const controller = new DocxSessionController();
    const owner = await controller.open(new Uint8Array([1]));
    const match: Parameters<DocxSession['replaceMatch']>[0] = { enclosingAnchor: { id: 'p:body:a', kind: 'p', scope: 'body', unid: 'a' }, text: '', span: { start: 0, length: 0 }, fragments: [], contextBefore: '', contextAfter: '', groups: [] };
    expect(() => controller.run(session => session.executeBatch([
      { tool: 'test', action: 'local', mutation: () => session.replaceMatch(match, 'one') },
      { tool: 'test', action: 'fail', mutation: () => { throw new Error('rollback'); } },
    ]))).toThrow('rollback');
    expect(controller.getSnapshot().version).toBe(0);
    expect(controller.getRenderChanges(owner, 0)).toEqual([]);
    owner.replaceText('p:body:a', 'unknown');
    expect(controller.getRenderChanges(owner, 0)).toBeNull();
    owner.replaceMatch(match, 'two');
    expect(controller.getRenderChanges(owner, 1)).toEqual(['p:body:a']);
    controller.close();
  });
  it('binds private native state, preserves synchronous returns, and observes mutations', async () => {
    const native = new NativeSession();
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(native));
    const controller = new DocxSessionController();
    const session = await controller.open(new Uint8Array([1]));
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(session.getVersion()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    expect(session.replaceText('p:body:a', 'edited')).toEqual({ success: true, text: 'edited' });
    expect(controller.getSnapshot().version).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.replaceText).toBe(session.replaceText);
    controller.run(s => { s.replaceText('a', 'one'); s.replaceText('a', 'two'); });
    expect(controller.getSnapshot().version).toBe(3);
    expect(listener).toHaveBeenCalledTimes(2);
    controller.close();
    expect(native.close).toHaveBeenCalledOnce();
  });

  it('preserves the open document on invalid replacement and closes it only after success', async () => {
    const first = new NativeSession();
    const second = new NativeSession();
    const factory = vi.spyOn(bridge, 'openNativeSession').mockReturnValueOnce(nativeBridge(first))
      .mockImplementationOnce(() => { throw new Error('Invalid document'); })
      .mockReturnValueOnce(nativeBridge(second));
    const controller = new DocxSessionController();
    const initial = new Uint8Array([1, 2]);
    const oldSession = await controller.open(initial);
    initial[0] = 99;
    expect(controller.originalBytes).toEqual(new Uint8Array([1, 2]));
    await expect(controller.open(new Uint8Array([0]))).rejects.toThrow('Invalid document');
    expect(controller.getSnapshot().session).toBe(oldSession);
    expect(first.close).not.toHaveBeenCalled();
    await controller.open(new Uint8Array([3]));
    expect(first.close).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledTimes(3);
    expect(() => oldSession.replaceText('a', 'stale')).toThrow('closed or replaced');
    controller.close();
    expect(second.close).toHaveBeenCalledOnce();
  });

  it('cancels a pending open on close without allocating a native handle', async () => {
    let ready!: () => void;
    vi.spyOn(engine, 'initialize').mockReturnValue(new Promise<void>(resolve => { ready = resolve; }));
    const factory = vi.spyOn(bridge, 'openNativeSession');
    const controller = new DocxSessionController();
    const opening = controller.open(new Uint8Array([1]));
    await Promise.resolve();
    controller.close();
    ready();
    await expect(opening).rejects.toMatchObject({ name: 'AbortError' });
    expect(factory).not.toHaveBeenCalled();
    expect(controller.getSnapshot().session).toBeNull();
  });

  it('observes nested configuration changes and rejects async callbacks before invoking them', async () => {
    vi.spyOn(bridge, 'openNativeSession').mockReturnValue(nativeBridge(new NativeSession()));
    const controller = new DocxSessionController();
    await controller.open(new Uint8Array([1]));
    const listener = vi.fn(); controller.subscribe(listener);
    controller.run(session => session.setRevisionAuthor('Reviewer'));
    expect(listener).toHaveBeenCalledOnce();
    controller.run(session => session.setTrackedChanges(engine.TrackedChangeMode.RenderInline));
    expect(controller.getSnapshot().trackedChanges).toBe(engine.TrackedChangeMode.RenderInline);
    controller.run(session => session.registerPageMap(engine.createUnavailablePageMap(0, 'test')));
    expect(listener).toHaveBeenCalledTimes(3);
    const invoked = vi.fn();
    expect(() => controller.run(async () => { invoked(); })).toThrow('synchronous');
    expect(invoked).not.toHaveBeenCalled();
    controller.close();
  });
});
