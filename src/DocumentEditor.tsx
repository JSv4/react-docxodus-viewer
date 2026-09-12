import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { DocxSessionSettings } from 'docxodus/core';
import { DocumentViewer } from './DocumentViewer';
import { EditorToolbar } from './components/EditorToolbar';
import type { EditorToolbarGroup } from './components/EditorToolbar';
import { ParagraphEditor } from './components/ParagraphEditor';
import type { ParagraphEditorHandle } from './components/ParagraphEditor';
import { Icon } from './components/Icon';
import { useDocxSession } from './hooks/useDocxSession';
import { useDocumentEditor } from './hooks/useDocumentEditor';
import { downloadDocument } from './hooks/useDocumentExport';
import type { DocxSessionController, DocumentSource } from './session';
import type { DocumentTextSelection, DocumentViewerProps } from './types';

export interface DocumentEditorChange { version: number; controller: DocxSessionController; getDocument: () => Uint8Array }
export interface DocumentEditorHandle { controller: DocxSessionController; getDocument: () => Uint8Array; focusText: () => void; commit: () => boolean }
export interface DocumentEditorProps {
  /** Replacement source. Omit to start a blank document, or pass null to start empty. */
  document?: DocumentSource | null;
  /** A host-owned session takes precedence over document and is never closed by this component. */
  session?: DocxSessionController;
  sessionSettings?: DocxSessionSettings;
  wasmBasePath?: string;
  filename?: string;
  readOnly?: boolean;
  showHeader?: boolean;
  showFormattingToolbar?: boolean;
  defaultTextEditorOpen?: boolean;
  toolbarGroups?: EditorToolbarGroup[];
  toolbarChildren?: ReactNode;
  viewerProps?: Omit<DocumentViewerProps, 'file' | 'document' | 'session' | 'html' | 'canvasEditor' | 'onAnchorSelect' | 'selectedAnchorId' | 'onTextSelectionChange' | 'allowRevisionResolution'>;
  /** Fires for committed native edits, not every keystroke in a paragraph draft. */
  onChange?: (change: DocumentEditorChange) => void;
  onReady?: (controller: DocxSessionController) => void;
  /** Overrides the default DOCX download. Your application chooses where to store the bytes. */
  onSave?: (bytes: Uint8Array, filename: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}

/** Embeddable document canvas with direct typing and native formatting controls. */
export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(function DocumentEditor({
  document, session, sessionSettings, wasmBasePath, filename, readOnly = false,
  showHeader = true, showFormattingToolbar = true, defaultTextEditorOpen = false,
  toolbarGroups, toolbarChildren, viewerProps, onChange, onReady, onSave, onError, className = '', style,
}, ref) {
  const owned = useDocxSession(session ? undefined : document === undefined ? 'blank' : document, { wasmBasePath, settings: sessionSettings });
  const controller = session ?? owned.controller;
  const editor = useDocumentEditor(controller, { readOnly, onError });
  const editorRef = useRef(editor);
  const callbacks = useRef({ onChange, onReady, onSave, onError });
  useEffect(() => { editorRef.current = editor; callbacks.current = { onChange, onReady, onSave, onError }; });
  const [textOpen, setTextOpen] = useState(defaultTextEditorOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const textEditor = useRef<ParagraphEditorHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const previous = useRef<{ session: object | null; version: number } | null>(null);
  const name = filename ?? (typeof File !== 'undefined' && document instanceof File ? document.name : 'Untitled document.docx');
  const commit = () => editor.canvasEditor.commit() && (textEditor.current?.commit() ?? true);
  const showText = () => { setTextOpen(true); requestAnimationFrame(() => textEditor.current?.focus()); };
  useImperativeHandle(ref, () => ({ controller, getDocument: () => {
    if (!commit()) throw new Error('Resolve the paragraph draft before saving the document.');
    return controller.save();
  }, focusText: showText, commit }));
  useEffect(() => {
    const current = { session: editor.state.session, version: editor.state.version };
    const before = previous.current; previous.current = current;
    if (!current.session) return;
    if (before?.session === current.session) {
      if (before.version !== current.version) callbacks.current.onChange?.({ version: current.version, controller, getDocument: () => controller.save() });
    } else callbacks.current.onReady?.(controller);
  }, [controller, editor.state.session, editor.state.version]);
  useEffect(() => {
    const current = editor.state.session;
    if (!current) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || controller.getSnapshot().session !== current) return;
      const anchors = controller.read(session => session.project().anchorIndex);
      const first = Object.entries(anchors).find(([, anchor]) => anchor.scope === 'body' && ['p', 'h', 'li'].includes(anchor.kind));
      if (first) editorRef.current.selectAnchor(first[0]);
    });
    return () => { cancelled = true; };
  }, [controller, editor.state.session]);
  const reportError = (cause: unknown) => { const failure = cause instanceof Error ? cause : new Error(String(cause)); setError(failure); callbacks.current.onError?.(failure); };
  const save = async () => {
    if (!editor.ready || saving || !commit()) return;
    setSaving(true); setError(null);
    try {
      const bytes = controller.save();
      if (callbacks.current.onSave) await callbacks.current.onSave(bytes, name);
      else downloadDocument(bytes, /\.docx$/i.test(name) ? name : `${name}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } catch (cause) { reportError(cause); }
    finally { setSaving(false); }
  };
  const selectAnchor = (anchor: string) => { if (commit()) editor.selectAnchor(anchor); };
  const selectText = (selection: DocumentTextSelection | null) => { if (commit()) editor.selectText(selection); };
  const failure = error ?? editor.error ?? editor.state.error;
  return <div ref={root} className={`rdv-editor ${className}`} style={style} role="region" aria-label={readOnly ? 'Document viewer block' : 'Document editor block'} onKeyDown={event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || (event.target as Element).closest('dialog')) return;
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); void save(); return; }
    if (readOnly) return;
    if (key === 'z' && (event.target as Element).tagName === 'TEXTAREA' && textEditor.current?.isDirty()) return;
    const command = key === 'b' ? () => editor.toggleFormat('bold') : key === 'i' ? () => editor.toggleFormat('italic') : key === 'u' ? () => editor.toggleFormat('underline') : key === 'z' ? event.shiftKey ? editor.redo : editor.undo : key === 'y' ? editor.redo : null;
    if (command) { event.preventDefault(); if (commit()) command(); }
  }}>
    {showHeader && <header className="rdv-editor-header"><div><Icon name="document" size={18} /><strong>{name.replace(/\.docx$/i, '')}</strong><span>{readOnly ? 'Read only' : 'Editor'}</span></div><button type="button" className="rdv-editor-primary" aria-label="Save document" disabled={!editor.ready || saving} onClick={() => void save()}><Icon name="download" size={15} />{saving ? 'Saving…' : onSave ? 'Save' : 'Download DOCX'}</button></header>}
    {!readOnly && showFormattingToolbar && <EditorToolbar editor={editor} groups={toolbarGroups} beforeAction={commit} onEditText={showText}>{toolbarChildren}</EditorToolbar>}
    {failure && <div className="rdv-editor-error" role="alert"><span>{failure.message}</span>{editor.canvasState.conflict && <button type="button" onClick={() => { editor.canvasEditor.discard(); editor.clearError(); }}>Reload document text</button>}<button type="button" aria-label="Dismiss editor error" onClick={() => { setError(null); editor.clearError(); }}><Icon name="close" size={14} /></button></div>}
    <div className="rdv-editor-canvas"><DocumentViewer {...viewerProps} session={controller} canvasEditor={readOnly ? undefined : editor.canvasEditor} wasmBasePath={wasmBasePath ?? viewerProps?.wasmBasePath} rendererFingerprint={viewerProps?.rendererFingerprint ?? `rdv-editor-${id}`} showUploadButton={false} fitMode={viewerProps?.fitMode ?? 'page-width'} selectedAnchorId={readOnly ? undefined : editor.selection?.anchorId} onAnchorSelect={readOnly ? undefined : selectAnchor} onTextSelectionChange={readOnly ? undefined : selectText} allowRevisionResolution={false} onError={cause => { reportError(cause); viewerProps?.onError?.(cause); }} defaultSettings={{ commentMode: 'disabled', annotationMode: 'disabled', showDeletedContent: false, ...viewerProps?.defaultSettings }} /></div>
    {textOpen && !readOnly && <ParagraphEditor ref={textEditor} editor={editor} onClose={() => setTextOpen(false)} />}
    <footer className="rdv-editor-status" aria-live="polite"><span>{editor.state.isLoading ? 'Opening document…' : readOnly ? 'Viewing document' : editor.selection?.span?.length ? `${editor.selection.span.length} characters selected` : editor.canvasState.pending ? 'Editing document…' : 'Click on the page to type'}</span><span>{editor.busy ? 'Inserting image…' : readOnly ? '' : editor.notice || 'Your changes stay in the document'}</span></footer>
  </div>;
});
