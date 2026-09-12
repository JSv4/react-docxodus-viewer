import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { DocumentEditorState } from '../hooks/useDocumentEditor';
import { Icon } from './Icon';

export interface ParagraphEditorHandle { commit: () => boolean; focus: () => void; isDirty: () => boolean }
export interface ParagraphEditorProps { editor: DocumentEditorState; onClose?: () => void; className?: string }

/** Text authoring for one paragraph; formatting commands remain native document operations. */
export const ParagraphEditor = forwardRef<ParagraphEditorHandle, ParagraphEditorProps>(function ParagraphEditor({ editor, onClose, className = '' }, ref) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<{ owner: object; anchor: string; before: string; value: string } | null>(null);
  const anchor = editor.selection?.anchorId;
  const live = editor.details?.text ?? '';
  const current = draft?.owner === editor.state.session && draft.anchor === anchor ? draft : null;
  const value = current?.value ?? live;
  const dirty = value !== live;
  const conflict = !!current && current.before !== live;
  const commit = () => {
    if (!dirty) return true;
    if (conflict || !anchor || !editor.canEdit) return false;
    const span = { start: input.current?.selectionStart ?? 0, length: (input.current?.selectionEnd ?? 0) - (input.current?.selectionStart ?? 0) };
    // Pane authoring owns focus; an earlier canvas selection must not reclaim it
    // while the native text update and its selection guards are running.
    if (!editor.select(anchor)) return false;
    if (!editor.replaceText(current?.before ?? live, value)) return false;
    editor.select(anchor, span); setDraft(null); return true;
  };
  useImperativeHandle(ref, () => ({ commit, focus: () => input.current?.focus(), isDirty: () => dirty }));
  useLayoutEffect(() => editor.canvasEditor.guardSelection(commit));
  return <section className={`rdv-paragraph-editor ${className}`} aria-label="Paragraph text editor">
    <header><div><strong>Paragraph text</strong><span>{conflict ? 'The paragraph changed elsewhere. Copy your draft or reload.' : dirty ? 'Draft · apply to update the page' : 'Select text here or on the page to format it.'}</span></div>{onClose && <button type="button" aria-label="Close text editor" onClick={() => { if (commit()) onClose(); }}><Icon name="close" size={16} /></button>}</header>
    <textarea ref={input} aria-label="Paragraph text" placeholder="Choose a paragraph on the page…" value={value} disabled={!editor.canEdit} onChange={event => { if (editor.state.session && anchor) setDraft({ owner: editor.state.session, anchor, before: current?.before ?? live, value: event.target.value }); }} onSelect={event => {
      if (!dirty && anchor) editor.select(anchor, { start: event.currentTarget.selectionStart, length: event.currentTarget.selectionEnd - event.currentTarget.selectionStart });
    }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); commit(); } }} />
    <footer><span>{editor.selection?.span?.length ? `${editor.selection.span.length} characters selected` : 'Formatting applies to the paragraph'}{dirty && ' · Ctrl / ⌘ Enter to apply'}</span><button type="button" disabled={!current} onClick={() => setDraft(null)}>Reload text</button><button type="button" className="rdv-editor-primary" disabled={!dirty || conflict || !editor.canEdit} onClick={commit}>Apply text<Icon name="check" size={14} /></button></footer>
  </section>;
});
