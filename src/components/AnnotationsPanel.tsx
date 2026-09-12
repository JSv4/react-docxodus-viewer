import { useState } from 'react';
import type { DocxSessionController } from '../session';
import type { EditResult } from 'docxodus/core';
import { useSessionAnnotations } from '../hooks/useSessionFeatures';

export interface AnnotationsPanelProps { session: DocxSessionController; anchorId?: string; author?: string; onSelect?: (anchorId: string) => void }
export function AnnotationsPanel({ session, anchorId, author = 'Reviewer', onSelect }: AnnotationsPanelProps) {
  const annotations = useSessionAnnotations(session);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#ffeb3b');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apply = (operation: () => EditResult) => {
    try { const result = operation(); if (!result.success) throw new Error(result.error?.message ?? 'Annotation change failed.'); setError(null); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const submit = () => {
    if (editing) { if (apply(() => annotations.updateAnnotation(editing, { label, color }))) { setEditing(null); setLabel(''); } }
    else if (anchorId) {
      const id = crypto.randomUUID();
      if (apply(() => annotations.addAnnotation(anchorId, null, { id, labelId: label, label, color, author, created: new Date().toISOString(), bookmarkName: '' }))) setLabel('');
    }
  };
  return <section className="rdv-feature-panel" aria-label="Annotations"><h3>Annotations</h3>
    {(error || annotations.error) && <p role="alert">{error ?? annotations.error?.message}</p>}
    <ul>{annotations.annotations.map(annotation => <li key={annotation.id}><strong style={{ borderLeft: `4px solid ${annotation.color}`, paddingLeft: 8 }}>{annotation.label}</strong><p>{annotation.annotatedText}</p><div className="rdv-review-actions">
      {onSelect && <button type="button" onClick={() => { const target = annotations.findByAnnotation(annotation.id)[0]; if (target) onSelect(target.id); }}>Show annotation</button>}
      <button type="button" onClick={() => { setEditing(annotation.id); setLabel(annotation.label); setColor(annotation.color); }}>Edit label</button>
      {anchorId && <button type="button" onClick={() => apply(() => annotations.moveAnnotation(annotation.id, anchorId, null))}>Move to selected block</button>}
      <button type="button" onClick={() => apply(() => annotations.removeAnnotation(annotation.id))}>Remove annotation</button>
    </div></li>)}</ul>
    <form onSubmit={event => { event.preventDefault(); submit(); }}><label>Annotation label<input value={label} onChange={event => setLabel(event.target.value)} /></label><label>Highlight color<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label><button type="submit" disabled={!label || (!anchorId && !editing)}>{editing ? 'Save label' : 'Annotate selected block'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setLabel(''); }}>Cancel</button>}</form>
    {!anchorId && !editing && <p>Select a document block to add an annotation.</p>}
  </section>;
}
