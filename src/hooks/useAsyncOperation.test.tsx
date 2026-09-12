import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsyncOperation } from './useAsyncOperation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
describe('asynchronous React operations', () => {
  it('keeps the newest result when superseded requests settle out of order', async () => {
    const { result } = renderHook(() => useAsyncOperation<string>());
    const first = deferred<string>(); const second = deferred<string>();
    let old!: Promise<string>; let newest!: Promise<string>; let firstSignal!: AbortSignal;
    act(() => { old = result.current.run(signal => { firstSignal = signal; return first.promise; }); });
    act(() => { newest = result.current.run(() => second.promise); });
    expect(firstSignal.aborted).toBe(true);
    await act(async () => { second.resolve('new'); await newest; });
    await act(async () => { first.resolve('old'); expect(await old).toBe('old'); });
    expect(result.current.data).toBe('new');
    expect(result.current.isRunning).toBe(false);
  });
  it('cancels on unmount and preserves machine-readable errors', async () => {
    const { result, unmount } = renderHook(() => useAsyncOperation<string>());
    const pending = deferred<string>(); let signal!: AbortSignal; let task!: Promise<string>;
    act(() => { task = result.current.run(value => { signal = value; return pending.promise; }); });
    unmount(); expect(signal.aborted).toBe(true);
    const failure = Object.assign(new Error('Native failure'), { code: 'revision_unsupported' });
    pending.reject(failure);
    await expect(task).rejects.toBe(failure);
  });
});
