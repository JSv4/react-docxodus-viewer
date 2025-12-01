/**
 * react-docxodus-viewer
 * A React component for viewing DOCX documents in the browser
 */

// Styles
import './styles/DocumentViewer.css';

// Main component
export { DocumentViewer } from './DocumentViewer';

// Types
export type {
  DocumentViewerProps,
  ViewerSettings,
  CommentMode,
  AnnotationMode,
  ViewMode,
} from './types';

export { DEFAULT_SETTINGS } from './types';

// Re-export useful types from docxodus for convenience
export type { PaginationResult, Revision } from 'docxodus/react';
export { RevisionType, isInsertion, isDeletion, isMove, isFormatChange } from 'docxodus';
