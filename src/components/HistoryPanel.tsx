import { useId, useState } from 'react';
import type { DocxStoredVersion, DocxVersionMetadata } from 'docxodus/core';
import type { DocumentHistory } from '../hooks/useDocumentHistory';
import { documentBytes } from '../session';
import { downloadDocument } from '../hooks/useDocumentExport';
import { Icon } from './Icon';

export interface HistoryPanelProps {
  history: DocumentHistory;
  getDocument?: () => Uint8Array | Promise<Uint8Array>;
  author?: string;
  onPreview?: (document: Uint8Array, version: DocxStoredVersion) => void | Promise<void>;
  /** Called only after an acknowledged restore/retry, with the captured saved version. */
  onRestore?: (document: Uint8Array, version: DocxStoredVersion) => void | Promise<void>;
}
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function displayTime(value: string) { const time = new Date(value); return Number.isNaN(time.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(time); }

export function HistoryPanel({ history, getDocument, author = 'Reviewer', onPreview, onRestore }: HistoryPanelProps) {
  const [label, setLabel] = useState('');
  const [selection, setSelected] = useState<DocxStoredVersion | null>(null);
  const selected = selection?.record.documentId === history.documentId ? selection : null;
  const group = useId();
  const [sequence, setSequence] = useState('0');
  const [cutoff, setCutoff] = useState('');
  const [details, setDetails] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const metadata = (): DocxVersionMetadata => ({ author, createdAt: new Date().toISOString(), label: label || undefined });
  const run = async (operation: () => Promise<unknown>) => {
    try { setError(null); await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const restore = () => run(async () => {
    if (!selected) return;
    const acknowledged = await history.restore(selected.id, metadata());
    if (onRestore) await onRestore(await history.preview(acknowledged.version.id), acknowledged.version);
  });
  const retry = () => run(async () => {
    const kind = history.pendingRequest?.kind;
    const acknowledged = await history.retry();
    if (kind === 'restore' && onRestore) await onRestore(await history.preview(acknowledged.version.id), acknowledged.version);
  });
  const disabled = history.isLoading || history.isBusy;
  return <section className="rdv-feature-panel" aria-label="Document history"><div className="rdv-panel-heading"><span>EVERY DRAFT HAS A STORY</span><h3>Document history</h3><p>Save a moment. Try another direction. Come back whenever you need to.</p></div>
    {history.isLoading && <p role="status">Opening history…</p>}
    {(error || history.error) && <p role="alert">{error ?? history.error?.message}</p>}
    {history.pendingRequest && <div role="status"><p>A {history.pendingRequest.kind} request awaits acknowledgement. Retry preserves its original document and metadata.</p><button type="button" disabled={disabled} onClick={retry}>Retry pending checkpoint</button></div>}
    {history.needsRefresh && <p>History changed elsewhere. Refresh before the next checkpoint.</p>}
    <label>Checkpoint label<input value={label} placeholder="Give this version a name…" onChange={event => setLabel(event.target.value)} /></label>
    <div className="rdv-review-actions">
      {getDocument && history.canWrite && <button className="rdv-primary-action" type="button" disabled={disabled || !!history.pendingRequest || history.needsRefresh} onClick={() => run(async () => { await history.save(await getDocument(), metadata()); })}><Icon name="plus" size={14} />Save checkpoint</button>}
      <button type="button" disabled={disabled || !!history.pendingRequest} onClick={() => run(history.refresh)}>Refresh history</button>
      <button type="button" disabled={disabled || !history.view} onClick={() => run(async () => downloadDocument(await history.exportArchive(), 'document.docxhistory', 'application/octet-stream'))}>Download history archive</button>
    </div>
    {history.canWrite && <label>Import history archive<input type="file" accept=".docxhistory,.zip" disabled={disabled || !!history.pendingRequest} onChange={event => { const file = event.target.files?.[0]; if (file) void run(async () => { setDetails(await history.importArchive(await documentBytes(file))); }); event.target.value = ''; }} /></label>}
    {!history.isLoading && !history.versions.length && <div className="rdv-panel-empty"><Icon name="history" size={28} /><p>Your history starts here.</p><small>Save your first checkpoint before the next edit.</small></div>}
    <ol className="rdv-history-list">{history.versions.map(version => <li key={version.id.digest.value}>
      <label className="rdv-checkbox"><input type="radio" name={`history-version-${group}`} checked={selected?.id.digest.value === version.id.digest.value} onChange={() => setSelected(version)} /><strong>{version.record.metadata.label || `Version ${version.record.sequence}`}</strong></label>
      <p className="rdv-version-meta">{version.record.metadata.author} · <time dateTime={version.record.metadata.createdAt} title={version.record.metadata.createdAt}>{displayTime(version.record.metadata.createdAt)}</time>{version.record.restoredFrom && <span className="rdv-status-pill">Restored checkpoint</span>}</p>
      <div className="rdv-review-actions">
        {onPreview && <button type="button" disabled={disabled} onClick={() => run(async () => onPreview(await history.preview(version.id), version))}>Preview checkpoint</button>}
        <button type="button" disabled={disabled} onClick={() => run(async () => downloadDocument(await history.preview(version.id), `version-${version.record.sequence}.docx`, docxMime))}>Download checkpoint</button>
        {selected && selected.id.digest.value !== version.id.digest.value && <button type="button" disabled={disabled} onClick={() => run(async () => downloadDocument(await history.compare(selected.id, version.id), 'history-comparison.docx', docxMime))}>Compare from selected</button>}
      </div>
    </li>)}</ol>
    {history.nextCursor && <button type="button" disabled={disabled} onClick={() => run(history.loadMore)}>Load older checkpoints</button>}
    {selected && history.canWrite && <div><p>Restore “{selected.record.metadata.label || selected.record.sequence}” as a new checkpoint. Previous checkpoints remain available.</p><button type="button" disabled={disabled || !!history.pendingRequest || history.needsRefresh} onClick={restore}>Restore selected checkpoint</button></div>}
    {history.view && <details><summary>History timeline and operations</summary>
      <label>Sequence<input value={sequence} onChange={event => setSequence(event.target.value)} inputMode="numeric" /></label>
      <div className="rdv-review-actions"><button type="button" disabled={disabled} onClick={() => run(async () => downloadDocument(await history.materialize(sequence), `sequence-${sequence}.docx`, docxMime))}>Download sequence</button><button type="button" disabled={disabled} onClick={() => run(async () => downloadDocument(await history.replay(sequence), `replay-${sequence}.docx`, docxMime))}>Replay sequence</button></div>
      <label>Time cutoff (ISO 8601)<input value={cutoff} onChange={event => setCutoff(event.target.value)} placeholder="2026-09-11T12:00:00Z" /></label>
      <button type="button" disabled={disabled || !cutoff} onClick={() => run(async () => setSequence(await history.resolveTime(cutoff)))}>Find sequence at time</button>
      <div className="rdv-review-actions"><button type="button" disabled={disabled} onClick={() => run(async () => setDetails(await history.readChangesSince(null)))}>Read changes</button><button type="button" disabled={disabled} onClick={() => run(async () => setDetails(await history.readOperationsSince(null)))}>Read operations</button></div>
      {details != null && <pre>{JSON.stringify(details, null, 2)}</pre>}
    </details>}
  </section>;
}
