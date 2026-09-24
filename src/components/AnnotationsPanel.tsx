import { useEffect, useRef, useState } from 'react';
import type { DocxSessionController } from '../session';
import type { CharSpan, EditResult } from 'docxodus/core';
import { useSelectionTarget, useSessionAnnotations } from '../hooks/useSessionFeatures';

export interface AnnotationsPanelProps {
  session: DocxSessionController;
  anchorId?: string;
  /** Selected text inside `anchorId`. Omit or pass an empty span to annotate the whole block. */
  span?: CharSpan | null;
  author?: string;
  /** Change this value to move keyboard focus to the label field. */
  focusRequest?: number;
  onSelect?: (anchorId: string) => void;
}
export function AnnotationsPanel({ session, anchorId, span, author = 'Reviewer', focusRequest, onSelect }: AnnotationsPanelProps) {
  const annotations = useSessionAnnotations(session);
  const target = useSelectionTarget(session, anchorId, span);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#ffeb3b');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusRequest) input.current?.focus(); }, [focusRequest]);
  const apply = (operation: () => EditResult) => {
    try { const result = operation(); if (!result.success) throw new Error(result.error?.message ?? 'Annotation change failed.'); setError(null); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const submit = () => {
    if (editing) { if (apply(() => annotations.updateAnnotation(editing, { label, color }))) { setEditing(null); setLabel(''); } }
    else if (target) {
      const id = crypto.randomUUID();
      if (apply(() => annotations.addAnnotation(target.anchorId, target.span, { id, labelId: label, label, color, author, created: new Date().toISOString(), bookmarkName: '' }))) setLabel('');
    }
  };
  return <section className="rdv-feature-panel" aria-label="Annotations"><div className="rdv-panel-heading"><span>MARK WHAT MATTERS</span><h3>Annotations</h3><p>Give key passages a label, a color, and a place in your workflow.</p></div>
    {(error || annotations.error) && <p role="alert">{error ?? annotations.error?.message}</p>}
    <ul>{annotations.annotations.map(annotation => <li key={annotation.id}><strong style={{ borderLeft: `4px solid ${annotation.color}`, paddingLeft: 8 }}>{annotation.label}</strong><p>{annotation.annotatedText}</p><div className="rdv-review-actions">
      {onSelect && <button type="button" onClick={() => { const found = annotations.findByAnnotation(annotation.id)[0]; if (found) onSelect(found.id); }}>Show annotation</button>}
      <button type="button" onClick={() => { setEditing(annotation.id); setLabel(annotation.label); setColor(annotation.color); input.current?.focus(); }}>Edit label</button>
      {target && <button type="button" onClick={() => apply(() => annotations.moveAnnotation(annotation.id, target.anchorId, target.span))}>{target.span ? 'Move to selection' : 'Move to selected block'}</button>}
      <button type="button" onClick={() => apply(() => annotations.removeAnnotation(annotation.id))}>Remove annotation</button>
    </div></li>)}</ul>
    <form onSubmit={event => { event.preventDefault(); submit(); }}>
      {target && !editing && <blockquote className="rdv-selection-target" aria-label={target.span ? 'Selected text' : 'Selected block'}><span>{target.span ? 'Selected text' : 'Selected block'}</span>{target.text || 'Empty paragraph'}</blockquote>}
      <label>Annotation label<input ref={input} value={label} placeholder="e.g. Key decision" onChange={event => setLabel(event.target.value)} /></label><label>Highlight color<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label><button className="rdv-primary-action" type="submit" disabled={!label || (!target && !editing)}>{editing ? 'Save label' : target?.span ? 'Annotate selection' : 'Annotate selected block'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setLabel(''); }}>Cancel</button>}
    </form>
    {!target && !editing && <p>Select text or a document block to add an annotation.</p>}
  </section>;
}
