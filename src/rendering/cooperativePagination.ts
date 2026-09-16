import type { PaginationEngine } from 'docxodus/core';
import { createCooperativePagination } from './cooperativePagination.generated.js';

/** Yield a real browser task, allowing input and paint between layout slices. */
export async function yieldToBrowser() {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { postTask?: (callback: () => void, options: { priority: 'background' }) => Promise<void> } }).scheduler;
  // scheduler.yield() boosts continuation priority and can starve commit timers.
  // Background tasks let input, timers, React updates and paint run first.
  if (scheduler?.postTask) await scheduler.postTask(() => {}, { priority: 'background' });
  else await new Promise<void>(resolve => setTimeout(resolve, 0));
}

/** Uses the native algorithm/state; only traversal scheduling is asynchronous. */
export function cooperativePagination(engine: PaginationEngine, check: () => void, idle: () => Promise<void>) {
  let deadline = performance.now() + 8;
  return createCooperativePagination(engine, () => {
    check();
    if (performance.now() < deadline) return;
    return (async () => {
      await yieldToBrowser();
      check();
      await idle();
      check();
      deadline = performance.now() + 8;
    })();
  });
}
