import { afterEach, describe, expect, it, vi } from 'vitest';
import * as engine from 'docxodus/core';
import type { DocxSession } from 'docxodus/core';
import { DocxSessionController } from './session';

class NativeSession {
  #version = 0;
  close = vi.fn();
  getVersion() { return this.#version; }
  replaceText(_anchor: string, text: string) { this.#version++; return { success: true, text }; }
  setRevisionAuthor() {}
  setTrackedChanges() {}
  registerPageMap() { return { success: true }; }
  save() { return new Uint8Array([this.#version]); }
}

afterEach(() => vi.restoreAllMocks());

describe('DocxSessionController', () => {
  it('binds private native state, preserves synchronous returns, and observes mutations', async () => {
    const native = new NativeSession();
    vi.spyOn(engine, 'openDocxSession').mockReturnValue(native as unknown as DocxSession);
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
    const factory = vi.spyOn(engine, 'openDocxSession').mockReturnValueOnce(first as unknown as DocxSession)
      .mockImplementationOnce(() => { throw new Error('Invalid document'); })
      .mockReturnValueOnce(second as unknown as DocxSession);
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
    const factory = vi.spyOn(engine, 'openDocxSession');
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
    vi.spyOn(engine, 'openDocxSession').mockReturnValue(new NativeSession() as unknown as DocxSession);
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
