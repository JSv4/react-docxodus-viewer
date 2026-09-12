/** Composable editing primitives; no demo navigation or application shell. */
import './styles/DocumentViewer.css';

export { DocxodusProvider } from './DocxodusProvider';
export { DocumentEditor } from './DocumentEditor';
export type { DocumentEditorProps, DocumentEditorHandle, DocumentEditorChange } from './DocumentEditor';
export { EditorToolbar } from './components/EditorToolbar';
export type { EditorToolbarProps, EditorToolbarGroup } from './components/EditorToolbar';
export { ParagraphEditor } from './components/ParagraphEditor';
export type { ParagraphEditorProps, ParagraphEditorHandle } from './components/ParagraphEditor';
export { useDocumentEditor } from './hooks/useDocumentEditor';
export type { DocumentEditorState, UseDocumentEditorOptions, EditorSelection } from './hooks/useDocumentEditor';
export type { CanvasEditor, CanvasEditorSnapshot } from './editing/CanvasEditor';
export { DocxSessionController } from './session';
export { useDocxSession, useSessionState, useSessionQuery } from './hooks/useDocxSession';
export { useSessionCommands } from './hooks/useSessionFeatures';
export { SessionEditorPanel } from './components/SessionEditorPanel';
export type { DocxSessionSnapshot, DocumentSource } from './session';
export type { UseDocxSessionOptions } from './hooks/useDocxSession';
export type { SessionEditorPanelProps } from './components/SessionEditorPanel';
export type { DocxSession, DocxSessionSettings, FormatOp, ParagraphFormatOp, CharSpan } from 'docxodus/core';
