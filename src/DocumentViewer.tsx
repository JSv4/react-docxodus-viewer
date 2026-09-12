import { useState, useCallback, useRef, useEffect, useMemo, useId, useSyncExternalStore } from 'react';
import { PaginatedDocument } from './components/PaginatedDocument';
import type { PaginationResult, RevisionListEntry as Revision, DocumentMetadata, DocxSession } from 'docxodus/core';
import { CommentRenderMode, PaginationMode, AnnotationLabelMode } from 'docxodus/core';
import { useDocxodusRuntime } from './runtime';
import { useSessionState, useSessionQuery } from './hooks/useDocxSession';
import type { DocumentSource } from './session';
import { reconcileSourceAnchors } from './rendering/anchors';
import type {
  DocumentViewerProps,
  ViewerSettings,
  CommentMode,
  AnnotationMode,
  ViewMode,
  FitMode,
  ToolbarAction,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import { RevisionPanel } from './components/RevisionPanel';
import { Icon } from './components/Icon';
const noSubscribe = () => () => {};
const notEditing = () => false;

const OpenDocumentIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

function getCommentRenderMode(mode: CommentMode): CommentRenderMode {
  switch (mode) {
    case 'endnote': return CommentRenderMode.EndnoteStyle;
    case 'inline': return CommentRenderMode.Inline;
    case 'margin': return CommentRenderMode.Margin;
    default: return CommentRenderMode.Disabled;
  }
}

function getAnnotationLabelMode(mode: AnnotationMode): AnnotationLabelMode | undefined {
  switch (mode) {
    case 'above': return AnnotationLabelMode.Above;
    case 'inline': return AnnotationLabelMode.Inline;
    case 'tooltip': return AnnotationLabelMode.Tooltip;
    case 'none': return AnnotationLabelMode.None;
    default: return undefined;
  }
}

function toCssLength(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

const PAGE_PT_TO_PX = 96 / 72;
const FIT_PADDING_PX = 40;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;

function computeFitScale(
  mode: Exclude<FitMode, 'manual'>,
  containerWidth: number,
  containerHeight: number,
  pageWidthPt: number,
  pageHeightPt: number,
): number {
  const pageWidthPx = pageWidthPt * PAGE_PT_TO_PX;
  const pageHeightPx = pageHeightPt * PAGE_PT_TO_PX;
  const widthScale = (containerWidth - FIT_PADDING_PX) / pageWidthPx;
  const heightScale = (containerHeight - FIT_PADDING_PX) / pageHeightPx;
  const raw = mode === 'page-width' ? widthScale : Math.min(widthScale, heightScale);
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
  return Math.round(clamped * 100) / 100;
}

export function DocumentViewer({
  file: controlledFile,
  document: controlledDocument,
  session: sessionController,
  canvasEditor,
  revisions: controlledRevisions,
  conversionOptions,
  rendererFingerprint,
  layoutToken: suppliedLayoutToken,
  citation,
  onPageMap,
  onPaginationComplete,
  onRevisionSelect,
  onAnchorSelect,
  onTextSelectionChange,
  selectedAnchorId,
  allowRevisionResolution = true,
  html: controlledHtml,
  onFileChange,
  onConversionStart,
  onConversionComplete,
  onError,
  onPageChange,
  onRevisionsExtracted,
  settings: controlledSettings,
  defaultSettings,
  defaultZoom,
  onSettingsChange,
  className,
  style,
  toolbar = 'top',
  showSettingsButton = true,
  showUploadButton = true,
  showRevisionsTab = true,
  placeholder = 'Open a DOCX file to view',
  wasmBasePath,
  useWorker = true,
  warmup = false,
  fitMode = 'manual',
  theme = 'classic',
  toolbarActions,
}: DocumentViewerProps) {
  // Merge default settings. `defaultZoom` is a convenience shortcut for
  // `defaultSettings.paginationScale`; explicit `defaultSettings` wins if both
  // are provided.
  const mergedDefaults = useMemo(() => {
    const base: ViewerSettings = { ...DEFAULT_SETTINGS };
    if (defaultZoom !== undefined) {
      base.paginationScale = Math.max(0.3, Math.min(2.0, defaultZoom));
    }
    return { ...base, ...defaultSettings };
  }, [defaultSettings, defaultZoom]);

  // Internal state (uncontrolled mode)
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [internalHtml, setInternalHtml] = useState<string | null>(null);
  const [renderedLayoutToken, setRenderedLayoutToken] = useState<DocumentViewerProps['layoutToken']>();
  const [renderedOwner, setRenderedOwner] = useState<DocxSession | null>(null);
  const [internalSettings, setInternalSettings] = useState<ViewerSettings>(mergedDefaults);

  // Determine which values to use (controlled vs uncontrolled)
  const sessionState = useSessionState(sessionController);
  const editingSuspended = useSyncExternalStore(canvasEditor?.subscribe ?? noSubscribe,
    canvasEditor ? () => canvasEditor.getSnapshot().suspended : notEditing, notEditing);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const [sessionDocument, setSessionDocument] = useState<{ bytes: Uint8Array; version: number; anchors: string[]; owner: DocxSession } | null>(null);
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => {
      if (!current || editingSuspended) return;
      const snapshot = sessionController?.getSnapshot();
      setSessionDocument(snapshot?.session && sessionController ? {
        bytes: sessionController.save(), version: snapshot.version, owner: snapshot.session,
        anchors: sessionController.read(session => Object.keys(session.project().anchorIndex)),
      } : null);
    }).catch(cause => { if (current) onErrorRef.current?.(cause instanceof Error ? cause : new Error(String(cause))); });
    return () => { current = false; };
  }, [sessionController, sessionState.session, sessionState.version, editingSuspended]);
  const file = sessionController ? sessionDocument?.bytes ?? null : controlledDocument !== undefined ? controlledDocument : controlledFile !== undefined ? controlledFile : internalFile;
  const html = controlledHtml !== undefined ? controlledHtml : internalHtml;
  const settings = useMemo(
    () => controlledSettings
      ? { ...mergedDefaults, ...controlledSettings }
      : internalSettings,
    [controlledSettings, mergedDefaults, internalSettings]
  );

  const runtime = useDocxodusRuntime({ wasmBasePath, useWorker, warmup, enabled: controlledHtml === undefined });
  const { isReady, isLoading, error: initError } = runtime;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const conversionGeneration = useRef(0);
  const conversionAbort = useRef<AbortController | null>(null);

  // Local UI state
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('document');
  const [internalRevisions, setRevisions] = useState<Revision[]>([]);
  const selectRevisions = useCallback((session: DocxSession) => session.listRevisions(), []);
  const sessionRevisions = useSessionQuery(sessionController, selectRevisions);
  const onRevisionsRef = useRef(onRevisionsExtracted);
  useEffect(() => { onRevisionsRef.current = onRevisionsExtracted; }, [onRevisionsExtracted]);
  useEffect(() => { if (sessionRevisions.data) onRevisionsRef.current?.(sessionRevisions.data); }, [sessionRevisions.data]);
  const revisions = controlledRevisions ?? sessionRevisions.data ?? internalRevisions;
  const layoutToken = useMemo(() => suppliedLayoutToken ?? (sessionState.session && rendererFingerprint
    ? { documentVersion: sessionDocument?.version ?? sessionState.version, rendererFingerprint } : undefined),
  [suppliedLayoutToken, sessionState.session, sessionState.version, sessionDocument, rendererFingerprint]);
  const [isExtractingRevisions, setIsExtractingRevisions] = useState(false);

  // Document metadata for progressive loading placeholders
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata | null>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const paginatedContainerRef = useRef<HTMLDivElement>(null);
  const documentRootRef = useRef<HTMLElement | null>(null);
  const pendingRevisionAnchor = useRef<string | undefined>(undefined);

  // Inter-page gap read from --rdv-page-gap CSS variable (defaults to 20)
  const [pageGap, setPageGap] = useState(20);
  useEffect(() => {
    const readGap = () => {
      const el = viewerRef.current;
      if (!el) return;
      const value = getComputedStyle(el).getPropertyValue('--rdv-page-gap').trim();
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) setPageGap(parsed);
    };
    readGap();
    window.addEventListener('resize', readGap);
    return () => window.removeEventListener('resize', readGap);
  }, []);

  // Build conversion options from settings
  const getConvertOptions = useCallback(() => ({
    commentRenderMode: getCommentRenderMode(settings.commentMode),
    pageTitle: settings.pageTitle,
    cssPrefix: settings.cssPrefix,
    fabricateClasses: settings.fabricateClasses,
    additionalCss: settings.additionalCss || undefined,
    commentCssClassPrefix: settings.commentCssClassPrefix,
    paginationMode: PaginationMode.Paginated,
    paginationScale: settings.paginationScale,
    renderAnnotations: settings.annotationMode !== 'disabled',
    annotationLabelMode: getAnnotationLabelMode(settings.annotationMode),
    annotationCssClassPrefix: settings.annotationCssClassPrefix,
    renderFootnotesAndEndnotes: settings.renderFootnotesAndEndnotes,
    renderHeadersAndFooters: settings.renderHeadersAndFooters,
    renderTrackedChanges: settings.renderTrackedChanges,
    showDeletedContent: settings.showDeletedContent,
    renderMoveOperations: settings.renderMoveOperations,
    renderUnsupportedContentPlaceholders: settings.renderUnsupportedContentPlaceholders,
    documentLanguage: settings.documentLanguage || undefined,
    stampAnchors: settings.stampAnchors,
    ...conversionOptions,
  }), [settings, conversionOptions]);

  const convert = useCallback(async (fileToConvert: DocumentSource) => {
    if (!isReady) return;
    const generation = ++conversionGeneration.current;
    conversionAbort.current?.abort();
    const abort = new AbortController(); conversionAbort.current = abort;
    const current = () => generation === conversionGeneration.current;
    setIsConverting(true);
    setError(null);
    setRevisions([]);
    setViewMode('document');
    setDocumentMetadata(null);
    setFileName(fileToConvert instanceof Uint8Array ? 'Document.docx' : fileToConvert.name);
    onConversionStart?.();
    void runtime.getDocumentMetadata(fileToConvert).then(metadata => {
      if (current()) setDocumentMetadata(metadata);
    }).catch(() => { /* Metadata is optional. */ });
    try {
      let result = await runtime.convertToHtml(fileToConvert, getConvertOptions());
      if (canvasEditor) await canvasEditor.whenIdle(abort.signal);
      if (!current()) return;
      if (canvasEditor && sessionDocument && (sessionDocument.owner !== sessionController?.getSnapshot().session || sessionDocument.version !== sessionController.getSnapshot().version)) return;
      if (sessionDocument?.bytes === fileToConvert) result = reconcileSourceAnchors(result, sessionDocument.anchors);
      if (controlledHtml === undefined) { setInternalHtml(result); setRenderedLayoutToken(layoutToken); setRenderedOwner(sessionDocument?.owner ?? null); }
      onConversionComplete?.(result);
      if (showRevisionsTab && !controlledRevisions && !sessionController) {
        setIsExtractingRevisions(true);
        try {
          const extracted = await runtime.getRevisions(fileToConvert);
          if (current()) { setRevisions(extracted); onRevisionsExtracted?.(extracted); }
        } catch (cause) {
          if (current()) onError?.(cause instanceof Error ? cause : new Error(String(cause)));
        } finally { if (current()) setIsExtractingRevisions(false); }
      }
    } catch (cause) {
      if (!current()) return;
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      onError?.(failure);
    } finally { if (current()) setIsConverting(false); }
  }, [isReady, runtime, getConvertOptions, controlledHtml, onConversionStart, onConversionComplete,
    showRevisionsTab, controlledRevisions, sessionController, sessionDocument, onRevisionsExtracted, onError, layoutToken, canvasEditor]);

  const convertRef = useRef(convert);
  const conversionOptionsKey = JSON.stringify(conversionOptions ?? {});
  const invalidateConversion = useCallback(() => { conversionGeneration.current++; conversionAbort.current?.abort(); }, []);
  useEffect(() => { convertRef.current = convert; });
  useEffect(() => {
    if (isReady && file && controlledHtml === undefined) void convertRef.current(file);
    if (!file) {
      void Promise.resolve().then(() => {
        setIsConverting(false); setIsExtractingRevisions(false); setRevisions([]);
        setFileName(''); setDocumentMetadata(null); setTotalPages(0);
        if (controlledHtml === undefined) setInternalHtml(null);
      });
    }
    return invalidateConversion;
  }, [isReady, file, controlledHtml, conversionOptionsKey, invalidateConversion]);

  // Handle file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFileName(selectedFile.name);
      setError(null);
      setCurrentPage(1);
      setTotalPages(0);
      setDocumentMetadata(null); // Reset metadata from previous file
      setRevisions([]); // Reset revisions
      setViewMode('document');

      if (sessionController) {
        try { await sessionController.open(selectedFile); }
        catch (cause) { const failure = cause instanceof Error ? cause : new Error(String(cause)); setError(failure); onErrorRef.current?.(failure); }
      } else if (controlledFile === undefined && controlledDocument === undefined) {
        setInternalFile(selectedFile);
        setInternalHtml(null);
      }
      onFileChange?.(selectedFile);

      // Fetch metadata first for placeholders, then convert
      // Conversion follows the selected/controlled source in the effect above.
    }
  };

  // Reconvert with current settings
  const reconvert = useCallback(async () => {
    if (file) {
      if (controlledHtml === undefined) {
        setInternalHtml(null);
      }
      await convert(file);
    }
  }, [file, convert, controlledHtml]);

  // Clear document
  const handleClear = () => {
    conversionGeneration.current++;
    setIsConverting(false);
    setIsExtractingRevisions(false);
    if (controlledFile === undefined) {
      setInternalFile(null);
    }
    if (controlledHtml === undefined) {
      setInternalHtml(null);
    }
    setError(null);
    setFileName('');
    setCurrentPage(1);
    setTotalPages(0);
    setRevisions([]);
    setViewMode('document');
    setDocumentMetadata(null);
    onFileChange?.(null);

    if (inputRef.current) inputRef.current.value = '';
    sessionController?.close();
  };

  // Update settings
  const updateSettings = useCallback((updates: Partial<ViewerSettings>) => {
    const newSettings = { ...settings, ...updates };
    if (controlledSettings === undefined) {
      setInternalSettings(newSettings);
    }
    onSettingsChange?.(newSettings);
  }, [settings, controlledSettings, onSettingsChange]);

  // Zoom controls
  const manualZoom = useRef(false);
  useEffect(() => { manualZoom.current = false; }, [fitMode]);
  const handleZoomChange = (value: number) => {
    manualZoom.current = true;
    updateSettings({ paginationScale: Math.max(0.3, Math.min(2.0, value)) });
  };
  const handleZoomIn = () => handleZoomChange(settings.paginationScale + 0.1);
  const handleZoomOut = () => handleZoomChange(settings.paginationScale - 0.1);

  // Auto-fit: when fitMode is not 'manual', pick a scale that fits the page
  // into the viewer on initial render and whenever the viewer resizes.
  // settingsRef avoids putting `settings` in this effect's deps, which would
  // re-create the ResizeObserver on every scale change and cause loops.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });
  useEffect(() => {
    if (fitMode === 'manual' || !documentMetadata || !html) return;
    const container = paginatedContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const section = documentMetadata.sections[0];
    const pageWidthPt = section?.pageWidthPt ?? 612;
    const pageHeightPt = section?.pageHeightPt ?? 792;

    const applyFit = () => {
      // An explicit zoom remains in effect through edits and layout changes.
      // A new host fitMode re-enables automatic fitting.
      if (manualZoom.current) return;
      // Hidden tabs have no measurable layout; preserve their current zoom.
      if (!container.clientWidth || !container.clientHeight) return;
      const scale = computeFitScale(
        fitMode,
        container.clientWidth,
        container.clientHeight,
        pageWidthPt,
        pageHeightPt,
      );
      if (Math.abs(settingsRef.current.paginationScale - scale) < 0.005) return;
      const newSettings = { ...settingsRef.current, paginationScale: scale };
      if (controlledSettings === undefined) {
        setInternalSettings(newSettings);
      }
      onSettingsChange?.(newSettings);
    };

    applyFit();
    const ro = new ResizeObserver(applyFit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitMode, documentMetadata, html, controlledSettings, onSettingsChange]);

  // Page navigation
  const goToPage = (pageNum: number) => {
    const container = documentRootRef.current;
    if (!container || pageNum < 1 || pageNum > totalPages) return;
    const pageElement = container.querySelector(`[data-page-number="${pageNum}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToPreviousPage = () => currentPage > 1 && goToPage(currentPage - 1);
  const goToNextPage = () => currentPage < totalPages && goToPage(currentPage + 1);

  // Handle page visibility changes
  const handlePageVisible = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    onPageChange?.(pageNumber, totalPages);
  };

  // Handle footnote/anchor clicks
  useEffect(() => {
    const container = paginatedContainerRef.current;
    if (!container) return;

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      e.preventDefault();
      const targetId = href.substring(1);
      const targetElement = container.querySelector(`[id="${targetId}"], [name="${targetId}"]`);

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('rdv-footnote-highlight');
        setTimeout(() => targetElement.classList.remove('rdv-footnote-highlight'), 2000);
      }
    };

    container.addEventListener('click', handleAnchorClick);
    return () => container.removeEventListener('click', handleAnchorClick);
  }, [html]);

  // Notify parent of page changes when totalPages updates
  useEffect(() => {
    if (totalPages > 0) {
      onPageChange?.(currentPage, totalPages);
    }
  }, [totalPages, currentPage, onPageChange]);

  const isProcessing = isConverting || isLoading;

  // Settings Modal
  const renderSettingsModal = () => (
    <div className="rdv-settings-overlay" onClick={() => setShowSettings(false)}>
      <div className="rdv-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rdv-settings-header">
          <h3>Viewer Settings</h3>
          <button className="rdv-settings-close" onClick={() => setShowSettings(false)}>×</button>
        </div>
        <div className="rdv-settings-body">
          <div className="rdv-settings-section">
            <h4>Display Options</h4>
            <label className="rdv-settings-checkbox"><input type="checkbox" checked={settings.fragmentParagraphs} onChange={event => updateSettings({ fragmentParagraphs: event.target.checked })} /><span>Split long paragraphs across pages</span></label>
            <label className="rdv-settings-checkbox"><input type="checkbox" checked={settings.stampAnchors} onChange={event => updateSettings({ stampAnchors: event.target.checked })} /><span>Enable document anchors and citations</span></label>
            <label className="rdv-settings-checkbox">
              <input
                type="checkbox"
                checked={settings.renderFootnotesAndEndnotes}
                onChange={(e) => updateSettings({ renderFootnotesAndEndnotes: e.target.checked })}
              />
              <span>Show footnotes and endnotes</span>
            </label>
            <label className="rdv-settings-checkbox">
              <input
                type="checkbox"
                checked={settings.renderHeadersAndFooters}
                onChange={(e) => updateSettings({ renderHeadersAndFooters: e.target.checked })}
              />
              <span>Show headers and footers</span>
            </label>
            <label className="rdv-settings-checkbox">
              <input
                type="checkbox"
                checked={settings.showPageNumbers}
                onChange={(e) => updateSettings({ showPageNumbers: e.target.checked })}
              />
              <span>Show page numbers</span>
            </label>
          </div>

          <div className="rdv-settings-section">
            <h4>Comment Rendering</h4>
            <div className="rdv-settings-radio-group">
              {(['disabled', 'endnote', 'inline', 'margin'] as CommentMode[]).map((mode) => (
                <label key={mode} className="rdv-settings-radio">
                  <input
                    type="radio"
                    name={`${inputId}-commentMode`}
                    checked={settings.commentMode === mode}
                    onChange={() => updateSettings({ commentMode: mode })}
                  />
                  <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}{mode === 'endnote' ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rdv-settings-section">
            <h4>Annotation Rendering</h4>
            <div className="rdv-settings-radio-group">
              {(['disabled', 'above', 'inline', 'tooltip', 'none'] as AnnotationMode[]).map((mode) => (
                <label key={mode} className="rdv-settings-radio">
                  <input
                    type="radio"
                    name={`${inputId}-annotationMode`}
                    checked={settings.annotationMode === mode}
                    onChange={() => updateSettings({ annotationMode: mode })}
                  />
                  <span>{mode === 'none' ? 'Highlight Only' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rdv-settings-section">
            <h4>Tracked Changes</h4>
            <label className="rdv-settings-checkbox">
              <input
                type="checkbox"
                checked={settings.renderTrackedChanges}
                onChange={(e) => updateSettings({ renderTrackedChanges: e.target.checked })}
              />
              <span>Show tracked changes</span>
            </label>
            {settings.renderTrackedChanges && (
              <div className="rdv-settings-subsection">
                <label className="rdv-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.showDeletedContent}
                    onChange={(e) => updateSettings({ showDeletedContent: e.target.checked })}
                  />
                  <span>Show deleted content</span>
                </label>
                <label className="rdv-settings-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.renderMoveOperations}
                    onChange={(e) => updateSettings({ renderMoveOperations: e.target.checked })}
                  />
                  <span>Distinguish move operations</span>
                </label>
              </div>
            )}
          </div>

          <div className="rdv-settings-section">
            <h4>Advanced</h4>
            <label className="rdv-settings-checkbox">
              <input
                type="checkbox"
                checked={settings.renderUnsupportedContentPlaceholders}
                onChange={(e) => updateSettings({ renderUnsupportedContentPlaceholders: e.target.checked })}
              />
              <span>Show placeholders for unsupported content</span>
            </label>
            <p className="rdv-settings-hint">
              Display visual indicators for WMF/EMF images, math equations, form fields, and other unsupported elements
            </p>
            <label className="rdv-settings-input-label">
              <span>Document language override</span>
              <input
                type="text"
                className="rdv-settings-text-input"
                value={settings.documentLanguage}
                onChange={(e) => updateSettings({ documentLanguage: e.target.value })}
                placeholder="Auto-detect (e.g., en-US, fr-FR)"
              />
            </label>
          </div>
        </div>
        <div className="rdv-settings-footer">
          <button className="rdv-settings-apply" onClick={() => { reconvert(); setShowSettings(false); }}>
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );

  const hasRevisions = revisions.length > 0;

  // Render a single custom toolbar action button
  const renderToolbarAction = (action: ToolbarAction) => {
    const variantClass = action.variant === 'primary' ? 'rdv-toolbar-icon-btn--primary' : '';
    const classes = [
      'rdv-toolbar-btn',
      'rdv-toolbar-icon-btn',
      variantClass,
      action.className,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={action.key}
        type="button"
        className={classes}
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.label}
        aria-label={action.label}
      >
        {action.icon}
      </button>
    );
  };

  // Toolbar component
  const renderToolbar = () => (
    <div className="rdv-toolbar">
      <div className="rdv-toolbar-left">
        {showUploadButton && <><label
          htmlFor={inputId}
          className="rdv-toolbar-btn rdv-toolbar-icon-btn rdv-toolbar-open-btn"
          title="Open Document"
          aria-label="Open Document"
        >
          <OpenDocumentIcon />
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".docx"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="rdv-file-input"
        /></>}
        {fileName && (
          <span className="rdv-toolbar-filename" title={fileName}>
            {fileName}
          </span>
        )}
        {showUploadButton && fileName && (
          <button
            className="rdv-toolbar-btn rdv-toolbar-icon-btn rdv-toolbar-clear"
            onClick={handleClear}
            disabled={isProcessing}
            title="Clear Document"
            aria-label="Clear Document"
          >
            ×
          </button>
        )}
        {showRevisionsTab && hasRevisions && html && (
          <>
            <div className="rdv-toolbar-separator" />
            <div className="rdv-view-tabs">
              <button
                className={`rdv-view-tab ${viewMode === 'document' ? 'rdv-view-tab--active' : ''}`}
                onClick={() => setViewMode('document')}
                title="View Document"
              >
                Document
              </button>
              <button
                className={`rdv-view-tab ${viewMode === 'revisions' ? 'rdv-view-tab--active' : ''}`}
                onClick={() => setViewMode('revisions')}
                title="View Tracked Changes"
              >
                Changes ({revisions.length})
              </button>
            </div>
          </>
        )}
        {showRevisionsTab && isExtractingRevisions && (
          <span className="rdv-extracting-indicator" title="Extracting tracked changes...">
            ...
          </span>
        )}
      </div>

      <div className="rdv-toolbar-right">
        {html && totalPages > 0 && viewMode === 'document' && (
          <>
            <button
              className="rdv-toolbar-btn rdv-toolbar-icon-btn"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              title="Previous Page"
              aria-label="Previous Page"
            >
              <Icon name="chevronLeft" size={15} />
            </button>
            <div className="rdv-page-input-group">
              <input
                type="number"
                className="rdv-page-input"
                aria-label="Page number"
                value={currentPage}
                min={1}
                max={totalPages}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (!isNaN(page)) goToPage(page);
                }}
              />
              <span className="rdv-page-total">/ {totalPages}</span>
            </div>
            <button
              className="rdv-toolbar-btn rdv-toolbar-icon-btn"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              title="Next Page"
              aria-label="Next Page"
            >
              <Icon name="chevron" size={15} />
            </button>

            <div className="rdv-toolbar-separator" />

            <div className="rdv-zoom-group">
              <button
                className="rdv-toolbar-btn rdv-toolbar-icon-btn rdv-zoom-btn"
                onClick={handleZoomOut}
                disabled={settings.paginationScale <= 0.3}
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                −
              </button>
              <select
                className="rdv-zoom-select"
                value={settings.paginationScale}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                aria-label="Zoom level"
              >
                {![0.5, 0.75, 0.8, 0.9, 1, 1.25, 1.5, 2].includes(settings.paginationScale) && (
                  <option value={settings.paginationScale}>{Math.round(settings.paginationScale * 100)}%</option>
                )}
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="0.8">80%</option>
                <option value="0.9">90%</option>
                <option value="1">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
              </select>
              <button
                className="rdv-toolbar-btn rdv-toolbar-icon-btn rdv-zoom-btn"
                onClick={handleZoomIn}
                disabled={settings.paginationScale >= 2.0}
                title="Zoom In"
                aria-label="Zoom In"
              >
                +
              </button>
            </div>
          </>
        )}
        {toolbarActions && toolbarActions.length > 0 && (
          <>
            {html && totalPages > 0 && viewMode === 'document' && (
              <div className="rdv-toolbar-separator" />
            )}
            {toolbarActions.map(renderToolbarAction)}
          </>
        )}
        {showSettingsButton && (
          <>
            {(toolbarActions?.length || (html && totalPages > 0 && viewMode === 'document')) && (
              <div className="rdv-toolbar-separator" />
            )}
            <button
              className="rdv-toolbar-btn rdv-toolbar-icon-btn rdv-toolbar-settings"
              onClick={() => setShowSettings(true)}
              title="Settings"
              aria-label="Settings"
            >
              <Icon name="settings" size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );

  const rootClassName = ['rdv-viewer', theme === 'studio' && 'rdv-viewer--studio', className].filter(Boolean).join(' ');

  return (
    <div ref={viewerRef} className={rootClassName} style={style}>
      {toolbar === 'top' && renderToolbar()}

      <div className="rdv-content">
        {initError && (
          <div className="rdv-message rdv-message--error">
            <p>Failed to initialize: {initError.message}</p>
          </div>
        )}

        {!initError && (isLoading || isConverting) && !(canvasEditor && html) && (
          documentMetadata && isConverting ? (
            // Show page placeholders while converting - matches actual page dimensions for stable layout
            <div
              className="rdv-pages rdv-pages--loading"
              style={{
                // Apply stable dimensions to match rendered state - prevents layout shift
                ...(settings.stableWidth && { '--rdv-stable-width': toCssLength(settings.stableWidth) }),
                ...(settings.stableHeight && { minHeight: toCssLength(settings.stableHeight) }),
              } as React.CSSProperties}
            >
              <div className="rdv-page-placeholders" style={{ backgroundColor: 'var(--rdv-background, #525659)' }}>
                {Array.from({ length: documentMetadata.estimatedPageCount || 1 }).map((_, index) => {
                  // Get section for this page (approximate - use first section if not enough)
                  const section = documentMetadata.sections[
                    Math.min(index, documentMetadata.sections.length - 1)
                  ];
                  // Calculate scaled dimensions (points to pixels, then apply scale)
                  const scale = settings.paginationScale;
                  const width = Math.round((section?.pageWidthPt || 612) * (96 / 72) * scale);
                  const height = Math.round((section?.pageHeightPt || 792) * (96 / 72) * scale);

                  return (
                    <div
                      key={index}
                      className="rdv-page-placeholder"
                      style={{
                        width: `${width}px`,
                        height: `${height}px`,
                      }}
                    >
                      <div className="rdv-page-placeholder__shimmer" />
                      {index === 0 && (
                        <div className="rdv-page-placeholder__info">
                          <div className="rdv-spinner rdv-spinner--small"></div>
                          <span>Converting document...</span>
                          <span className="rdv-page-placeholder__count">
                            ~{documentMetadata.estimatedPageCount} page{documentMetadata.estimatedPageCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      <div className="rdv-page-placeholder__number">{index + 1}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rdv-message">
              <div className="rdv-spinner"></div>
              <p>
                {isLoading && file
                  ? 'Loading engine & preparing document...'
                  : isLoading
                  ? 'Loading document engine...'
                  : 'Processing document...'}
              </p>
            </div>
          )
        )}

        {!isLoading && !initError && !html && !isConverting && !file && (
          <div
            className="rdv-message"
            style={{
              // Apply stable dimensions for consistent sizing across all states
              ...(settings.stableWidth && { width: toCssLength(settings.stableWidth), maxWidth: '100%' }),
              ...(settings.stableHeight && { minHeight: toCssLength(settings.stableHeight) }),
            }}
          >
            <div className="rdv-message__icon">📄</div>
            <p>{placeholder}</p>
          </div>
        )}

        {error && !isConverting && (
          <div className="rdv-message rdv-message--error">
            <p>Error: {error.message}</p>
          </div>
        )}

        {viewMode === 'document' && html && (!isConverting || canvasEditor) && (
          <div
            ref={paginatedContainerRef}
            className="rdv-pages"
            style={{
              // Apply stable dimensions if provided - provides pdf.js-like sizing behavior
              ...(settings.stableWidth && { '--rdv-stable-width': toCssLength(settings.stableWidth) }),
              ...(settings.stableHeight && { minHeight: toCssLength(settings.stableHeight) }),
            } as React.CSSProperties}
          >
            <PaginatedDocument
              html={html}
              canvasEditor={canvasEditor}
              canvasOwner={renderedOwner}
              scale={settings.paginationScale}
              showPageNumbers={settings.showPageNumbers}
              fragmentParagraphs={settings.fragmentParagraphs}
              layoutToken={controlledHtml !== undefined ? layoutToken : renderedLayoutToken && {
                documentVersion: renderedLayoutToken.documentVersion,
                rendererFingerprint: layoutToken?.rendererFingerprint ?? renderedLayoutToken.rendererFingerprint,
              }}
              citation={citation}
              onRootChange={root => { documentRootRef.current = root; }}
              onError={onError}
              onAnchorSelect={onAnchorSelect}
              onTextSelectionChange={onTextSelectionChange}
              selectedAnchorId={selectedAnchorId}
              pageGap={pageGap}
              backgroundColor="var(--rdv-background, #525659)"
              className="rdv-paginated-document"
              onPaginationComplete={(result: PaginationResult) => {
                setTotalPages(result.totalPages);
                if (result.pageMap) {
                  if (sessionController && rendererFingerprint && result.pageMap.documentVersion === sessionController.getSnapshot().version) {
                    const registration = sessionController.run(session => session.registerPageMap(result.pageMap!, rendererFingerprint));
                    if (!registration.success) onError?.(new Error(registration.message));
                  }
                  onPageMap?.(result.pageMap);
                }
                onPaginationComplete?.(result);
                if (pendingRevisionAnchor.current) {
                  const nodes = documentRootRef.current?.querySelectorAll<HTMLElement>('#pagination-container [data-source-anchor-id]');
                  Array.from(nodes ?? []).find(node => node.dataset.sourceAnchorId === pendingRevisionAnchor.current)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  pendingRevisionAnchor.current = undefined;
                }
              }}
              onPageVisible={handlePageVisible}
            />
          </div>
        )}

        {viewMode === 'revisions' && html && !isConverting && (
          <RevisionPanel
            revisions={revisions}
            onSelect={revision => {
              if (!('family' in revision)) return;
              onRevisionSelect?.(revision);
              pendingRevisionAnchor.current = revision.anchorId ?? revision.affectedAnchors[0]?.id;
              setViewMode('document');
            }}
            onAccept={sessionController && allowRevisionResolution ? id => sessionController.run(session => session.acceptRevision(id)) : undefined}
            onReject={sessionController && allowRevisionResolution ? id => sessionController.run(session => session.rejectRevision(id)) : undefined}
            onAcceptAll={sessionController && allowRevisionResolution ? () => sessionController.run(session => session.acceptAllRevisions()) : undefined}
            onRejectAll={sessionController && allowRevisionResolution ? () => sessionController.run(session => session.rejectAllRevisions()) : undefined}
          />
        )}
      </div>

      {toolbar === 'bottom' && renderToolbar()}

      {showSettings && renderSettingsModal()}
    </div>
  );
}
