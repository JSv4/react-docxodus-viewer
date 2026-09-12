/** Composable editing primitives; no demo navigation or application shell. */
import './styles/DocumentViewer.css';

export { DocxodusProvider } from './DocxodusProvider';
export { DocxSessionController } from './session';
export { useDocxSession, useSessionState, useSessionQuery } from './hooks/useDocxSession';
export { useSessionCommands } from './hooks/useSessionFeatures';
export { SessionEditorPanel } from './components/SessionEditorPanel';
export type { DocxSessionSnapshot, DocumentSource } from './session';
export type { UseDocxSessionOptions } from './hooks/useDocxSession';
export type { SessionEditorPanelProps } from './components/SessionEditorPanel';
export type { DocxSession, DocxSessionSettings, FormatOp, ParagraphFormatOp, CharSpan } from 'docxodus/core';
