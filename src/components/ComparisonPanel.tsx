import { useState } from 'react';
import { ConflictResolution } from 'docxodus/core';
import type { DocxDiffConsolidateSettings, DocxDiffProduct, DocxDiffProducts } from 'docxodus/core';
import { useDocumentComparison, ALL_COMPARISON_PRODUCTS } from '../hooks/useDocumentComparison';
import { documentBytes } from '../session';
import { downloadDocument } from '../hooks/useDocumentExport';
import { DocumentViewer } from '../DocumentViewer';
import { RevisionPanel } from './RevisionPanel';
import { SemanticChangesPanel } from './SemanticChangesPanel';
import { Icon } from './Icon';

export interface ComparisonPanelProps { wasmBasePath?: string; settings?: DocxDiffConsolidateSettings }
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Pairwise, fan-out and N-way review without an imperative editor. */
export function ComparisonPanel({ wasmBasePath, settings = {} }: ComparisonPanelProps) {
  const comparison = useDocumentComparison(wasmBasePath);
  const [baseline, setBaseline] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<File[]>([]);
  const [mode, setMode] = useState<'compare' | 'batch' | 'consolidate'>('compare');
  const [policy, setPolicy] = useState(settings.conflictResolution ?? ConflictResolution.BaseWins);
  const [products, setProducts] = useState<DocxDiffProduct[]>(ALL_COMPARISON_PRODUCTS);
  const [advanced, setAdvanced] = useState('{}');
  const [preserve, setPreserve] = useState(settings.preserveInputRevisions ?? false);
  const [selected, setSelected] = useState<DocxDiffProducts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (operation: () => Promise<unknown>) => {
    try { setError(null); await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const start = () => run(async () => {
    if (!baseline || !candidates.length) return;
    const parsed: unknown = JSON.parse(advanced);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Comparison options must be a JSON object.');
    const options = { ...settings, preserveInputRevisions: preserve, ...parsed };
    comparison.clear(); setSelected(null);
    if (mode === 'compare') await comparison.compare(baseline, candidates[0], options, products);
    else if (mode === 'batch') await comparison.compareBatch(baseline, candidates.map(document => ({ name: document.name, document })), options, products);
    else await comparison.consolidate(baseline, await Promise.all(candidates.map(async file => ({ author: file.name.replace(/\.docx$/i, ''), document: await documentBytes(file) }))), { ...options, conflictResolution: policy });
  });
  const output = selected ?? comparison.result;
  const redline = comparison.consolidation?.document ?? output?.redline;
  const revisions = comparison.consolidation?.revisions ?? output?.revisions;
  const semantic = output?.semanticChanges;
  const editScript = comparison.consolidation?.editScript ?? output?.editScript;
  return <section className="rdv-feature-panel" aria-label="Compare documents">
    <h2>Compare documents</h2>
    <div className="rdv-form-grid">
      <label className="rdv-file-drop"><Icon name="document" size={27} /><span>BASELINE DOCUMENT</span><strong>{baseline?.name ?? 'Choose the original'}</strong><small>Click to select a Word document</small><input aria-label="Baseline document" type="file" accept=".docx" onChange={event => { comparison.clear(); setSelected(null); setBaseline(event.target.files?.[0] ?? null); }} /></label>
      <label className="rdv-file-drop"><Icon name="compare" size={27} /><span>REVISED DOCUMENTS</span><strong>{candidates.length ? candidates.map(file => file.name).join(', ') : 'Bring in the next version'}</strong><small>Choose one draft or multiple reviewers</small><input aria-label="Revised documents" type="file" accept=".docx" multiple onChange={event => { comparison.clear(); setSelected(null); setCandidates(Array.from(event.target.files ?? [])); }} /></label>
      <label>Comparison mode<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="compare">Compare first revised document</option><option value="batch">Compare each to baseline</option><option value="consolidate">Consolidate all reviewers</option></select></label>
      {mode === 'consolidate' && <label>Conflicting edits<select value={policy} onChange={event => setPolicy(Number(event.target.value))}><option value={ConflictResolution.BaseWins}>Keep baseline at conflicts</option><option value={ConflictResolution.FirstReviewerWins}>Prefer first reviewer</option><option value={ConflictResolution.StackAll}>Keep every variant</option></select></label>}
    </div>
    <label className="rdv-checkbox"><input type="checkbox" checked={preserve} onChange={event => setPreserve(event.target.checked)} />Preserve existing tracked revisions</label>
    {mode !== 'consolidate' && <fieldset><legend>Comparison products</legend>{ALL_COMPARISON_PRODUCTS.map(product => <label className="rdv-checkbox" key={product}><input type="checkbox" checked={products.includes(product)} onChange={event => setProducts(previous => event.target.checked ? [...previous, product] : previous.filter(value => value !== product))} />{product}</label>)}</fieldset>}
    <details><summary>Advanced comparison options</summary><label>DocxDiffSettings JSON<textarea value={advanced} onChange={event => setAdvanced(event.target.value)} spellCheck={false} /></label><p>All 12.4.1 comparison settings are supported, including move detection, formatting policy, granularity, headers and footers, and cross-paragraph differences.</p></details>
    <button className="rdv-primary-action" type="button" disabled={!baseline || !candidates.length || (mode !== 'consolidate' && !products.length) || comparison.isComparing} onClick={start}>{comparison.isComparing ? 'Comparing…' : 'Run comparison'}<Icon name="arrow" size={15} /></button>
    {(error || comparison.error) && <p role="alert">{error ?? comparison.error?.message}</p>}
    {comparison.batchResults && <ul>{comparison.batchResults.map((result, index) => <li key={index}>{result.error ? <span>{result.name}: {result.error}</span> : <button type="button" onClick={() => setSelected(result)}>Review {result.name}</button>}</li>)}</ul>}
    {comparison.consolidation && <section aria-label="Conflicts"><h3>Conflicts ({comparison.consolidation.conflicts.length})</h3>{comparison.consolidation.conflicts.map(conflict => <article key={conflict.id}><strong>Conflict {conflict.id}</strong><ul>{conflict.competitors.map((variant, i) => <li key={i}>{variant.author}: {variant.resultText}</li>)}</ul></article>)}</section>}
    {redline && <><div className="rdv-review-actions">
      <button type="button" onClick={() => downloadDocument(redline, 'redline.docx', docxMime)}>Download redline</button>
      <button type="button" onClick={() => run(async () => downloadDocument(await comparison.accept(redline), 'accepted.docx', docxMime))}>Download accepted version</button>
      <button type="button" onClick={() => run(async () => downloadDocument(await comparison.reject(redline), 'original.docx', docxMime))}>Download rejected version</button>
    </div><DocumentViewer document={redline} wasmBasePath={wasmBasePath} showUploadButton={false} showRevisionsTab={false} style={{ height: 600 }} defaultSettings={{ renderTrackedChanges: true }} /></>}
    {revisions && <RevisionPanel revisions={revisions} />}
    {semantic && <SemanticChangesPanel changes={semantic} />}
    {editScript && <details><summary>Edit script</summary><button type="button" onClick={() => downloadDocument(typeof editScript === 'string' ? editScript : JSON.stringify(editScript, null, 2), 'edit-script.json', 'application/json')}>Download edit script</button><pre>{typeof editScript === 'string' ? editScript : JSON.stringify(editScript, null, 2)}</pre></details>}
  </section>;
}
