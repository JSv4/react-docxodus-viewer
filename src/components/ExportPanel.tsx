import { useState } from 'react';
import type { CommentProfile, PaginatedHtmlOptions, ReviewProfile } from 'docxodus/core';
import type { DocumentSource } from '../session';
import { useDocumentExport, downloadDocument } from '../hooks/useDocumentExport';
import type { PdfExporter } from '../hooks/useDocumentExport';

export interface ExportPanelProps {
  document: DocumentSource | null;
  options?: Partial<PaginatedHtmlOptions>;
  pdfExporter?: PdfExporter;
  browserModuleUrl?: string;
  filename?: string;
}

export function ExportPanel({ document, options = {}, pdfExporter, browserModuleUrl, filename = 'document' }: ExportPanelProps) {
  const exporter = useDocumentExport({ wasmBasePath: options.wasmBasePath, pdfExporter, browserModuleUrl });
  const [review, setReview] = useState<ReviewProfile>(options.reviewProfile ?? 'final');
  const [comments, setComments] = useState<CommentProfile>(options.commentProfile ?? 'hidden');
  const [strict, setStrict] = useState(options.unsupportedContent === 'strict');
  const [strictFonts, setStrictFonts] = useState(options.strictFonts ?? false);
  const exportFile = async (format: 'html' | 'pdf') => {
    if (!document) return;
    try {
      const requested = { ...options, reviewProfile: review, commentProfile: comments, unsupportedContent: strict ? 'strict' as const : 'warn' as const, strictFonts };
      if (format === 'html') { const result = await exporter.exportHtml(document, requested); downloadDocument(result.html, `${filename}.html`, 'text/html'); }
      else { const result = await exporter.exportPdf(document, requested); downloadDocument(result.pdf, `${filename}.pdf`, 'application/pdf'); }
    } catch { /* The hook retains the structured error and failed render report. */ }
  };
  const report = exporter.pdf ?? exporter.html;
  return <section className="rdv-feature-panel" aria-label="Export document">
    <h3>Export document</h3><div className="rdv-form-grid">
      <label>Tracked changes<select value={review} onChange={event => setReview(event.target.value as ReviewProfile)}><option value="final">Final</option><option value="original">Original</option><option value="markup">Show markup</option></select></label>
      <label>Comments<select value={comments} onChange={event => setComments(event.target.value as CommentProfile)}>{(['hidden', 'inline', 'endnotes', 'margin'] as const).map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <label className="rdv-checkbox"><input type="checkbox" checked={strict} onChange={event => setStrict(event.target.checked)} />Require supported content</label>
    <label className="rdv-checkbox"><input type="checkbox" checked={strictFonts} onChange={event => setStrictFonts(event.target.checked)} />Require exact fonts</label>
    <div className="rdv-review-actions"><button type="button" disabled={!document || exporter.isExporting} onClick={() => void exportFile('html')}>Download standalone HTML</button>
      {exporter.canExportPdf && <button type="button" disabled={!document || exporter.isExporting} onClick={() => void exportFile('pdf')}>Download PDF</button>}
      {exporter.isExporting && <button type="button" onClick={exporter.cancel}>Cancel export</button>}
    </div>
    {exporter.error && <p role="alert">{exporter.error.message}</p>}
    {report && <details><summary>Render report and page map</summary><button type="button" onClick={() => downloadDocument(JSON.stringify({ pageMap: report.pageMap, renderReport: report.renderReport }, null, 2), `${filename}-render.json`, 'application/json')}>Download report</button><pre>{JSON.stringify(report.renderReport, null, 2)}</pre></details>}
  </section>;
}
