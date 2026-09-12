import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as engine from 'docxodus/core';
import type { DocxHistoryClient, DocxHistoryView } from 'docxodus/core';
import { useDocumentHistory } from './useDocumentHistory';

afterEach(() => vi.restoreAllMocks());

it('retains the native history handle until in-flight initialization reads finish', async () => {
  let resolveRead!: (value: null) => void;
  const read = vi.fn(() => new Promise<null>(resolve => { resolveRead = resolve; }));
  const close = vi.fn();
  const document = { read, listVersions: vi.fn() };
  vi.spyOn(engine, 'openDocxHistory').mockReturnValue({ document: () => document, close } as unknown as DocxHistoryClient);
  vi.spyOn(engine.HistoryCheckpoints, 'open').mockResolvedValue({} as engine.HistoryCheckpoints);
  const { unmount } = renderHook(() => useDocumentHistory({ documentId: 'lease-test' }));
  await waitFor(() => expect(read).toHaveBeenCalledOnce());
  unmount(); expect(close).not.toHaveBeenCalled();
  await act(async () => { resolveRead(null); });
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

it('returns an acknowledged checkpoint even if the following list refresh fails', async () => {
  const acknowledged = { version: { id: { digest: { value: 'saved-version' } } } } as DocxHistoryView;
  let saved = false;
  const read = vi.fn(async () => { if (saved) throw new Error('Storage temporarily unavailable'); return null; });
  const document = { read, listVersions: vi.fn() };
  const checkpoints = { save: vi.fn(async () => { saved = true; return acknowledged; }), pendingRequest: null, needsRefresh: false };
  vi.spyOn(engine, 'openDocxHistory').mockReturnValue({ document: () => document, close: vi.fn() } as unknown as DocxHistoryClient);
  vi.spyOn(engine.HistoryCheckpoints, 'open').mockResolvedValue(checkpoints as unknown as engine.HistoryCheckpoints);
  const { result } = renderHook(() => useDocumentHistory({ documentId: 'save-test' }));
  await waitFor(() => expect(result.current.canWrite).toBe(true));
  await act(async () => {
    expect(await result.current.save(new Uint8Array([1]), { author: 'Test', createdAt: '2026-09-12T00:00:00Z' })).toBe(acknowledged);
  });
  expect(result.current.view).toBe(acknowledged);
  expect(result.current.pendingRequest).toBeNull();
  expect(result.current.error?.message).toContain('Checkpoint saved');
});
