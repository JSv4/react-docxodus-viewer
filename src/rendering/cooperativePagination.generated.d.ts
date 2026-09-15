import type { PaginationEngine, PaginationResult, PageMap } from 'docxodus/core';

/** Internal scheduling adapter generated from the pinned native implementation. */
export function createCooperativePagination(engine: PaginationEngine, checkpoint: () => void | Promise<void>): {
  paginate(): Promise<PaginationResult>;
  normalizePageMapFragmentIdentities(): Promise<void>;
  materializePageMap(version: number, fingerprint: string): Promise<PageMap>;
};
