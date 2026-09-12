import { useState } from 'react';
import { AnnotationLabelMode, PaginationMode, DocumentViewer, createAnnotationFromSearch, downloadDocument, useExternalAnnotations } from '../../src';

export function AnnotationViewer() {
  const annotations = useExternalAnnotations();
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('Important');
  const [html, setHtml] = useState<string | null>(null);
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>) => {
    try { setError(null); await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const add = () => run(async () => {
    const set = annotations.annotationSet;
    if (!set || !file) return;
    const annotation = createAnnotationFromSearch(crypto.randomUUID(), label, set.content, search);
    if (!annotation) throw new Error('No matching text was found.');
    const updated = { ...set, labelledText: [...set.labelledText, annotation], textLabels: { ...set.textLabels, [label]: { id: label, text: label, color: '#ffeb3b', description: '', icon: '', labelType: 'text' as const } } };
    annotations.setAnnotationSet(updated);
    setReport(await annotations.validate(file, updated));
    setHtml(await annotations.project(file, { paginationMode: PaginationMode.Paginated, annotationLabelMode: AnnotationLabelMode.Above }, undefined, updated));
  });
  return <section className="rdv-feature-panel" aria-label="External annotations"><h2>External annotations</h2><p>Keep labels and text offsets in a separate JSON file, project highlights, and export OpenContracts data.</p>
    <label>Document<input type="file" accept=".docx" onChange={event => { const selected = event.target.files?.[0] ?? null; setFile(selected); setHtml(null); setReport(null); annotations.setAnnotationSet(null); if (selected) void run(() => annotations.create(selected, selected.name)); }} /></label>
    {annotations.annotationSet && <><div className="rdv-form-grid"><label>Exact text<input value={search} onChange={event => setSearch(event.target.value)} /></label><label>Label<input value={label} onChange={event => setLabel(event.target.value)} /></label></div><div className="rdv-review-actions"><button type="button" disabled={!search || !label || annotations.isBusy} onClick={add}>Add highlight</button><button type="button" onClick={() => downloadDocument(JSON.stringify(annotations.annotationSet, null, 2), 'annotations.json', 'application/json')}>Download annotations</button><button type="button" onClick={() => file && run(async () => downloadDocument(JSON.stringify(await annotations.exportOpenContracts(file), null, 2), 'opencontracts.json', 'application/json'))}>Export OpenContracts</button></div>
    <label>Load annotation JSON<input type="file" accept=".json" onChange={event => { const json = event.target.files?.[0]; if (json && file) void run(async () => { const set = JSON.parse(await json.text()); setReport(await annotations.validate(file, set)); annotations.setAnnotationSet(set); setHtml(await annotations.project(file, { paginationMode: PaginationMode.Paginated }, undefined, set)); }); }} /></label></>}
    {(error || annotations.error) && <p role="alert">{error ?? annotations.error?.message}</p>}
    {report != null && <details><summary>Validation report</summary><pre>{JSON.stringify(report, null, 2)}</pre></details>}
    {html && <DocumentViewer html={html} showUploadButton={false} />}
  </section>;
}
