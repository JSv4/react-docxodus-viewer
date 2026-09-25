/**
 * react-docxodus-viewer
 * A React component for viewing DOCX documents in the browser
 */

// Styles
import './styles/DocumentViewer.css';

// Main component
export { DocumentViewer } from './DocumentViewer';
export { DocumentEditor } from './DocumentEditor';
export type { DocumentEditorProps, DocumentEditorHandle, DocumentEditorChange } from './DocumentEditor';
export { EditorToolbar } from './components/EditorToolbar';
export type { EditorToolbarProps, EditorToolbarGroup } from './components/EditorToolbar';
export { ParagraphEditor } from './components/ParagraphEditor';
export type { ParagraphEditorProps, ParagraphEditorHandle } from './components/ParagraphEditor';
export { useDocumentEditor } from './hooks/useDocumentEditor';
export type { DocumentEditorState, UseDocumentEditorOptions, EditorSelection } from './hooks/useDocumentEditor';
export type { CanvasEditor, CanvasEditorSnapshot } from './editing/CanvasEditor';

// Types
export type {
  DocumentViewerProps,
  DocumentTextSelection,
  ViewerSettings,
  CommentMode,
  AnnotationMode,
  ViewMode,
  FitMode,
  ToolbarAction,
} from './types';

export { DEFAULT_SETTINGS } from './types';

// Re-export useful types from docxodus for convenience
export * from 'docxodus/core';
/** @deprecated Use RevisionListEntry. Native revision records changed in Docxodus 11. */
export type { RevisionListEntry as Revision } from 'docxodus/core';
export * from './worker';
export { DocxodusProvider } from './DocxodusProvider';
export { useDocxodusRuntime } from './runtime';
export type { DocxodusRuntime, DocxodusRuntimeOptions, DocxodusEngine } from './runtime';
export { DocxSessionController, documentBytes } from './session';
export type { DocxSessionSnapshot, DocumentSource } from './session';
export { useDocxSession, useSessionState, useSessionQuery } from './hooks/useDocxSession';
export type { UseDocxSessionOptions } from './hooks/useDocxSession';
export { useDocxodusApi, useDocxodusOperation } from './hooks/useDocxodusApi';
export type { DocxodusOperation, OperationArguments, OperationResult } from './hooks/useDocxodusApi';
export { useDocumentComparison, ALL_COMPARISON_PRODUCTS } from './hooks/useDocumentComparison';
export type { ComparisonResult, ConsolidationResult } from './hooks/useDocumentComparison';
export { useDocumentVerification } from './hooks/useDocumentVerification';
export { useDocumentExport, downloadDocument } from './hooks/useDocumentExport';
export type { PdfExporter, PdfExportResult, UseDocumentExportOptions } from './hooks/useDocumentExport';
export { loadBrowserExporter } from './browser-export-loader';
export { useDocumentHistory, createMemoryCheckpointJournal } from './hooks/useDocumentHistory';
export type { DocumentHistory, HistoryContext, UseDocumentHistoryOptions } from './hooks/useDocumentHistory';
export { RevisionPanel } from './components/RevisionPanel';
export type { RevisionPanelProps, ViewerRevision } from './components/RevisionPanel';
export { useSessionCommands, useDocumentComments, useSessionAnnotations, useDocumentImages, useContentControls, useDocumentProjection, useSelectionTarget } from './hooks/useSessionFeatures';
export type { SessionMethod, SelectionTarget } from './hooks/useSessionFeatures';
export { CommentsPanel } from './components/CommentsPanel';
export type { CommentsPanelProps, CommentContext } from './components/CommentsPanel';
export { SemanticChangesPanel } from './components/SemanticChangesPanel';
export { PaginatedDocument } from './components/PaginatedDocument';
export type { PaginatedDocumentProps } from './components/PaginatedDocument';
export { ComparisonPanel } from './components/ComparisonPanel';
export type { ComparisonPanelProps } from './components/ComparisonPanel';
export { ExportPanel } from './components/ExportPanel';
export type { ExportPanelProps } from './components/ExportPanel';
export { VerificationPanel } from './components/VerificationPanel';
export type { VerificationPanelProps } from './components/VerificationPanel';
export { HistoryPanel } from './components/HistoryPanel';
export type { HistoryPanelProps } from './components/HistoryPanel';
export { AnnotationsPanel } from './components/AnnotationsPanel';
export type { AnnotationsPanelProps } from './components/AnnotationsPanel';
export { useExternalAnnotations } from './hooks/useExternalAnnotations';
export { SessionEditorPanel } from './components/SessionEditorPanel';
export type { SessionEditorPanelProps } from './components/SessionEditorPanel';
