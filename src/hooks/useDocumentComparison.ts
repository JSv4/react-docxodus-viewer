import { useCallback } from 'react';
import { PaginationMode } from 'docxodus/core';
import type { ConversionOptions, DocxDiffBatchCandidate, DocxDiffBatchResult, DocxDiffConsolidatedRevision, DocxDiffConsolidateSettings, DocxDiffConflict, DocxDiffProduct, DocxDiffProducts, DocxDiffReviewer, DocxDiffSettings } from 'docxodus/core';
import type { DocumentSource } from '../session';
import { useDocxodusApi } from './useDocxodusApi';
import { useAsyncOperation } from './useAsyncOperation';

export interface ComparisonResult extends DocxDiffProducts { html?: string }
export interface ConsolidationResult {
  document: Uint8Array;
  html: string;
  conflicts: DocxDiffConflict[];
  revisions: DocxDiffConsolidatedRevision[];
  editScript: string;
}
export const ALL_COMPARISON_PRODUCTS: DocxDiffProduct[] = ['redline', 'revisions', 'editScript', 'semanticChanges'];

export function useDocumentComparison(wasmBasePath?: string) {
  const { call } = useDocxodusApi({ wasmBasePath });
  const comparison = useAsyncOperation<ComparisonResult>();
  const batch = useAsyncOperation<DocxDiffBatchResult[]>();
  const consolidation = useAsyncOperation<ConsolidationResult>();
  const { run: runComparison } = comparison;
  const { run: runBatch } = batch;
  const { run: runConsolidation } = consolidation;

  const compare = useCallback((left: DocumentSource, right: DocumentSource, settings: DocxDiffSettings = {}, products = ALL_COMPARISON_PRODUCTS, conversionOptions: ConversionOptions = {}) =>
    runComparison(async () => {
      const result = await call('docxDiffCompareProducts', left, right, { preAcceptInputRevisions: true, ...settings }, products);
      const html = result.redline ? await call('convertDocxToHtml', result.redline, {
        paginationMode: PaginationMode.Paginated, stampAnchors: true, renderTrackedChanges: true, showDeletedContent: true, renderMoveOperations: true,
        renderFootnotesAndEndnotes: true, renderHeadersAndFooters: true, ...conversionOptions,
      }) : undefined;
      return { ...result, html };
    }), [call, runComparison]);

  const compareBatch = useCallback((baseline: DocumentSource, candidates: readonly DocxDiffBatchCandidate[], settings: DocxDiffSettings = {}, products = ALL_COMPARISON_PRODUCTS) =>
    runBatch(() => call('docxDiffCompareBatch', baseline, candidates, { preAcceptInputRevisions: true, ...settings }, products)), [call, runBatch]);

  const consolidate = useCallback((base: DocumentSource, reviewers: DocxDiffReviewer[], settings?: DocxDiffConsolidateSettings) =>
    runConsolidation(async () => {
      const document = await call('docxDiffConsolidate', base, reviewers, settings);
      const [html, conflicts, revisions, editScript] = await Promise.all([
        call('convertDocxToHtml', document, { paginationMode: PaginationMode.Paginated, stampAnchors: true, renderTrackedChanges: true, showDeletedContent: true, renderMoveOperations: true }),
        call('docxDiffGetConflicts', base, reviewers, settings),
        call('docxDiffGetConsolidatedRevisions', base, reviewers, settings),
        call('docxDiffGetConsolidatedEditScript', base, reviewers, settings),
      ]);
      return { document, html, conflicts, revisions, editScript };
    }), [call, runConsolidation]);

  return {
    result: comparison.data, batchResults: batch.data, consolidation: consolidation.data,
    isComparing: comparison.isRunning || batch.isRunning || consolidation.isRunning,
    error: comparison.error ?? batch.error ?? consolidation.error,
    compare, compareBatch, consolidate,
    getConflicts: (...args: Parameters<typeof import('docxodus/core').docxDiffGetConflicts>) => call('docxDiffGetConflicts', ...args),
    accept: (document: DocumentSource) => call('docxDiffAcceptRevisions', document),
    reject: (document: DocumentSource) => call('docxDiffRejectRevisions', document),
    clear: () => { comparison.reset(); batch.reset(); consolidation.reset(); },
    call,
  };
}
