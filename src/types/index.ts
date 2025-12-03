/**
 * react-docxodus-viewer types
 */

export type CommentMode = 'disabled' | 'endnote' | 'inline' | 'margin';
export type AnnotationMode = 'disabled' | 'above' | 'inline' | 'tooltip' | 'none';
export type ViewMode = 'document' | 'revisions';

export interface ViewerSettings {
  /** Zoom scale (0.3 - 2.0) */
  paginationScale: number;
  /** Show page numbers on pages */
  showPageNumbers: boolean;
  /** Render footnotes and endnotes */
  renderFootnotesAndEndnotes: boolean;
  /** Render headers and footers */
  renderHeadersAndFooters: boolean;
  /** Comment rendering mode */
  commentMode: CommentMode;
  /** Annotation rendering mode */
  annotationMode: AnnotationMode;
  /** Show tracked changes */
  renderTrackedChanges: boolean;
  /** Show deleted content in tracked changes */
  showDeletedContent: boolean;
  /** Distinguish move operations in tracked changes */
  renderMoveOperations: boolean;
  /** Page title for converted HTML */
  pageTitle: string;
  /** CSS class prefix for generated elements */
  cssPrefix: string;
  /** Generate CSS classes for styling */
  fabricateClasses: boolean;
  /** Additional CSS to inject */
  additionalCss: string;
  /** CSS class prefix for comments */
  commentCssClassPrefix: string;
  /** CSS class prefix for annotations */
  annotationCssClassPrefix: string;
}

export interface DocumentViewerProps {
  /** File to display (controlled mode) */
  file?: File | null;
  /** Pre-converted HTML content (skip conversion) */
  html?: string | null;

  /** Callback when file changes */
  onFileChange?: (file: File | null) => void;
  /** Callback when conversion starts */
  onConversionStart?: () => void;
  /** Callback when conversion completes successfully */
  onConversionComplete?: (html: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Callback when visible page changes */
  onPageChange?: (page: number, total: number) => void;
  /** Callback when revisions are extracted from document */
  onRevisionsExtracted?: (revisions: import('docxodus').Revision[]) => void;

  /** Initial/controlled viewer settings */
  settings?: Partial<ViewerSettings>;
  /** Default settings (used for uncontrolled mode) */
  defaultSettings?: Partial<ViewerSettings>;
  /** Callback when settings change */
  onSettingsChange?: (settings: ViewerSettings) => void;

  /** Additional CSS class for the root element */
  className?: string;
  /** Inline styles for the root element */
  style?: React.CSSProperties;
  /** Toolbar position */
  toolbar?: 'top' | 'bottom' | 'none';
  /** Show settings button in toolbar */
  showSettingsButton?: boolean;
  /** Show revisions tab when document has tracked changes */
  showRevisionsTab?: boolean;
  /** Placeholder text when no document is loaded */
  placeholder?: string;

  /**
   * Base path for WASM files.
   * Leave undefined for auto-detection (recommended for most setups).
   * Only specify if hosting WASM files at a custom location.
   */
  wasmBasePath?: string;
  /**
   * Use Web Worker for document conversion (keeps UI responsive).
   * Default: true
   */
  useWorker?: boolean;
}

export const DEFAULT_SETTINGS: ViewerSettings = {
  paginationScale: 0.8,
  showPageNumbers: true,
  renderFootnotesAndEndnotes: true,
  renderHeadersAndFooters: true,
  commentMode: 'disabled',
  annotationMode: 'disabled',
  renderTrackedChanges: false,
  showDeletedContent: true,
  renderMoveOperations: true,
  pageTitle: 'Document',
  cssPrefix: 'docx-',
  fabricateClasses: true,
  additionalCss: '',
  commentCssClassPrefix: 'comment-',
  annotationCssClassPrefix: 'annot-',
};
