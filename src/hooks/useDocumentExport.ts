import { useCallback } from 'react';
import type { PaginatedHtmlOptions, PaginatedHtmlResult, PaginatedRenderMetadata } from 'docxodus/core';
import type { DocumentSource } from '../session';
import { documentBytes } from '../session';
import { useDocxodusRuntime } from '../runtime';
import { useAsyncOperation } from './useAsyncOperation';
import { loadBrowserExporter } from '../browser-export-loader';

export interface PdfExportResult extends PaginatedRenderMetadata { pdf: Uint8Array }
/** Connect this to a host's export service; Node apps can use the /server entry directly. */
export type PdfExporter = (document: Uint8Array, options: PaginatedHtmlOptions) => Promise<PdfExportResult>;

export function downloadDocument(data: Uint8Array | string, filename: string, mimeType: string) {
  const payload = typeof data === 'string' ? data : data.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([payload], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface UseDocumentExportOptions {
  wasmBasePath?: string;
  pdfExporter?: PdfExporter;
  /** Static, unmodified dist/export-browser.bundle.js from Docxodus 12.6.1. */
  browserModuleUrl?: string;
}

export function useDocumentExport(options: UseDocumentExportOptions = {}) {
  const runtime = useDocxodusRuntime({ wasmBasePath: options.wasmBasePath, enabled: false });
  const html = useAsyncOperation<PaginatedHtmlResult>();
  const pdf = useAsyncOperation<PdfExportResult>();
  const { run: runHtml } = html;
  const { run: runPdf } = pdf;
  const { pdfExporter, browserModuleUrl } = options;
  const exportHtml = useCallback((document: DocumentSource, requested: PaginatedHtmlOptions) => runHtml(async signal => {
    const wasmPath = requested.wasmBasePath ?? runtime.wasmBasePath ?? './wasm/';
    const moduleUrl = browserModuleUrl ?? new URL('../export-browser.bundle.js', new URL(wasmPath.endsWith('/') ? wasmPath : `${wasmPath}/`, globalThis.document.baseURI)).href;
    const module = await loadBrowserExporter(moduleUrl);
    return module.convertDocxToPaginatedHtml(document, {
      ...requested, wasmBasePath: requested.wasmBasePath ?? runtime.wasmBasePath,
      signal: requested.signal ? AbortSignal.any([signal, requested.signal]) : signal,
    });
  }), [runHtml, runtime.wasmBasePath, browserModuleUrl]);

  const exportPdf = useCallback((document: DocumentSource, requested: PaginatedHtmlOptions) => runPdf(async signal => {
    if (!pdfExporter) throw new Error('Configure a pdfExporter to export PDF, or use react-docxodus-viewer/server in Node.');
    return pdfExporter(await documentBytes(document), {
      ...requested, signal: requested.signal ? AbortSignal.any([signal, requested.signal]) : signal,
    });
  }), [runPdf, pdfExporter]);

  return {
    html: html.data, pdf: pdf.data, error: html.error ?? pdf.error,
    isExporting: html.isRunning || pdf.isRunning,
    canExportPdf: !!options.pdfExporter,
    exportHtml, exportPdf,
    cancel: () => { html.cancel(); pdf.cancel(); },
    clear: () => { html.reset(); pdf.reset(); },
  };
}
