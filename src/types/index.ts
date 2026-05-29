/**
 * react-docxodus-viewer types
 */

export type CommentMode = 'disabled' | 'endnote' | 'inline' | 'margin';
export type AnnotationMode = 'disabled' | 'above' | 'inline' | 'tooltip' | 'none';
export type ViewMode = 'document' | 'revisions';
/**
 * Automatic zoom-fit mode.
 * - `manual` (default): user controls zoom via the toolbar.
 * - `page-width`: scale so a page's width fills the viewer.
 * - `page`: scale so an entire page fits in the viewer (width and height).
 * Recomputes on initial render and on viewer resize.
 */
export type FitMode = 'manual' | 'page-width' | 'page';

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
  /**
   * Show placeholders for unsupported content (WMF/EMF images, math equations, form fields, etc.)
   * When enabled, unsupported content displays as styled placeholders instead of being silently dropped.
   */
  renderUnsupportedContentPlaceholders: boolean;
  /**
   * Override the document's default language for the HTML lang attribute.
   * If empty, the language is auto-detected from document settings.
   * Examples: "en-US", "fr-FR", "de-DE", "ja-JP"
   */
  documentLanguage: string;
  /**
   * Fixed width for the page container.
   * Accepts a number (pixels) or CSS length string (e.g., "80vw", "100%", "50rem").
   * When set, the viewer maintains this width regardless of content or zoom level,
   * providing pdf.js-like stable sizing behavior. The pages will be centered within
   * this container, and the container will scroll horizontally if content exceeds it.
   * Set to undefined/null for flexible sizing that adapts to content.
   * @example 816 // pixels
   * @example "80vw" // viewport width
   * @example "100%" // percentage of parent
   */
  stableWidth?: number | string;
  /**
   * Fixed minimum height for the page container.
   * Accepts a number (pixels) or CSS length string (e.g., "60vh", "500px", "100%").
   * When set, the viewer reserves this much vertical space regardless of content,
   * preventing layout shifts during loading. Set to undefined/null for flexible sizing.
   * @example 600 // pixels
   * @example "70vh" // viewport height
   * @example "100%" // percentage of parent
   */
  stableHeight?: number | string;
}

/**
 * A custom action button that can be injected into the viewer's toolbar.
 * Renders as an icon button on the right side of the toolbar (before the
 * settings gear), styled to match the built-in toolbar buttons.
 */
export interface ToolbarAction {
  /** Stable React key for this action. */
  key: string;
  /**
   * The icon to render inside the button. Accepts any React node — an inline
   * SVG, an icon-library component, an emoji, or a single character. Sized
   * via the parent button (~16px).
   */
  icon: React.ReactNode;
  /**
   * Accessible label, also shown as a tooltip on hover.
   */
  label: string;
  /** Click handler. */
  onClick: () => void;
  /** Disable the button. */
  disabled?: boolean;
  /**
   * Visual variant.
   * - `default`: matches existing toolbar buttons.
   * - `primary`: filled accent color, useful for the main action (e.g. Download).
   */
  variant?: 'default' | 'primary';
  /** Optional extra className appended to the button. */
  className?: string;
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
  /**
   * Convenience shortcut for the initial zoom level (uncontrolled mode).
   * Equivalent to `defaultSettings.paginationScale`. Range 0.3 – 2.0.
   * Ignored if `fitMode` is set to anything other than `'manual'`,
   * since the auto-fit logic will override the initial scale.
   * @example 1   // 100%
   * @example 0.75 // 75%
   */
  defaultZoom?: number;
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
   * Custom icon-button actions to render in the toolbar's right section,
   * just before the settings button. Useful for hosting apps that want to
   * surface document-level actions (Download, Share, Print, Open Ticket, ...)
   * inside the viewer's chrome rather than awkwardly above it.
   */
  toolbarActions?: ToolbarAction[];

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
  /**
   * Eagerly pre-warm the docxodus comparison code path as soon as the worker
   * is ready, before any user action.
   *
   * Creating the worker only warms the conversion runtime; the .NET WASM
   * comparison assemblies stay unloaded until the first compare, which then
   * pays ~3s of assembly-load latency. When `warmup` is true the viewer calls
   * docxodus's `prepare()` on mount so that cost is paid up front and the first
   * comparison is instant. The call is idempotent and fire-and-forget.
   *
   * Only applies in worker mode (`useWorker` is true, the default); it is a
   * no-op when `useWorker={false}`.
   * Default: false
   */
  warmup?: boolean;
  /**
   * Automatic zoom-fit mode. When set to `page-width` or `page`, the viewer
   * picks a zoom level that fits the rendered page in the viewer on initial
   * render and on viewer resize. Defaults to `manual` (user-controlled zoom).
   */
  fitMode?: FitMode;
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
  renderUnsupportedContentPlaceholders: true,
  documentLanguage: '',
};
