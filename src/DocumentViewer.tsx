import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDocxodus, PaginatedDocument } from 'docxodus/react';
import type { PaginationResult, Revision, DocumentMetadata } from 'docxodus/react';
import { CommentRenderMode, PaginationMode, AnnotationLabelMode, getDocumentMetadata } from 'docxodus';
import { createWorkerDocxodus, isWorkerSupported } from 'docxodus/worker';
import type { WorkerDocxodus } from 'docxodus/worker';
import type {
  DocumentViewerProps,
  ViewerSettings,
  CommentMode,
  AnnotationMode,
  ViewMode,
} from './types';
import { DEFAULT_SETTINGS } from './types';
import { RevisionPanel } from './components/RevisionPanel';

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

export function DocumentViewer({
  file: controlledFile,
  html: controlledHtml,
  onFileChange,
  onConversionStart,
  onConversionComplete,
  onError,
  onPageChange,
  onRevisionsExtracted,
  settings: controlledSettings,
  defaultSettings,
  onSettingsChange,
  className,
  style,
  toolbar = 'top',
  showSettingsButton = true,
  showRevisionsTab = true,
  placeholder = 'Open a DOCX file to view',
  wasmBasePath,
  useWorker = true,
}: DocumentViewerProps) {
  // Merge default settings
  const mergedDefaults = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...defaultSettings }),
    [defaultSettings]
  );

  // Internal state (uncontrolled mode)
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [internalHtml, setInternalHtml] = useState<string | null>(null);
  const [internalSettings, setInternalSettings] = useState<ViewerSettings>(mergedDefaults);

  // Determine which values to use (controlled vs uncontrolled)
  const file = controlledFile !== undefined ? controlledFile : internalFile;
  const html = controlledHtml !== undefined ? controlledHtml : internalHtml;
  const settings = useMemo(
    () => controlledSettings
      ? { ...mergedDefaults, ...controlledSettings }
      : internalSettings,
    [controlledSettings, mergedDefaults, internalSettings]
  );

  // Docxodus hook (used when not in worker mode)
  const hookResult = useDocxodus(wasmBasePath);

  // Worker instance state (used when useWorker=true)
  const [worker, setWorker] = useState<WorkerDocxodus | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState<Error | null>(null);

  // Create/destroy worker based on useWorker prop
  const workerRef = useRef<WorkerDocxodus | null>(null);

  useEffect(() => {
    if (!useWorker || !isWorkerSupported()) {
      return;
    }

    let cancelled = false;
    setWorkerLoading(true);
    setWorkerError(null);

    createWorkerDocxodus({ wasmBasePath })
      .then((workerInstance) => {
        if (!cancelled) {
          workerRef.current = workerInstance;
          setWorker(workerInstance);
          setWorkerReady(true);
          setWorkerLoading(false);
        } else {
          workerInstance.terminate();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWorkerError(err instanceof Error ? err : new Error(String(err)));
          setWorkerLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        setWorker(null);
        setWorkerReady(false);
      }
    };
  }, [useWorker, wasmBasePath]);

  // Unified ready/loading/error state
  const isReady = useWorker ? workerReady : hookResult.isReady;
  const isLoading = useWorker ? workerLoading : hookResult.isLoading;
  const initError = useWorker ? workerError : hookResult.error;

  // Local UI state
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('document');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isExtractingRevisions, setIsExtractingRevisions] = useState(false);

  // Document metadata for progressive loading placeholders
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata | null>(null);

  const paginatedContainerRef = useRef<HTMLDivElement>(null);

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
  }), [settings]);

  // Fetch document metadata quickly (for progressive loading placeholders)
  const fetchMetadata = useCallback(async (fileToFetch: File) => {
    try {
      // Use worker's getDocumentMetadata if available, otherwise direct call
      const metadata = useWorker && worker
        ? await worker.getDocumentMetadata(fileToFetch)
        : await getDocumentMetadata(fileToFetch);
      setDocumentMetadata(metadata);
    } catch {
      // Metadata extraction is non-critical, silently fail
      setDocumentMetadata(null);
    }
  }, [useWorker, worker]);

  // Extract revisions from document
  const extractRevisions = useCallback(async (fileToExtract: File) => {
    if (!isReady || !showRevisionsTab) return;

    setIsExtractingRevisions(true);
    try {
      const extractedRevisions = useWorker && worker
        ? await worker.getRevisions(fileToExtract)
        : await hookResult.getRevisions(fileToExtract);
      setRevisions(extractedRevisions);
      onRevisionsExtracted?.(extractedRevisions);
    } catch {
      // Revision extraction is non-critical, silently fail
      setRevisions([]);
    } finally {
      setIsExtractingRevisions(false);
    }
  }, [isReady, useWorker, worker, hookResult, showRevisionsTab, onRevisionsExtracted]);

  // Convert file to HTML
  const convert = useCallback(async (fileToConvert: File) => {
    if (!isReady) return;

    setIsConverting(true);
    setError(null);
    setRevisions([]);
    setViewMode('document');
    // Don't reset documentMetadata here - we want to show placeholders during conversion
    onConversionStart?.();

    // Allow React to render loading state before heavy WASM work (only needed for non-worker mode)
    if (!useWorker) {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    try {
      const result = useWorker && worker
        ? await worker.convertDocxToHtml(fileToConvert, getConvertOptions())
        : await hookResult.convertToHtml(fileToConvert, getConvertOptions());

      if (controlledHtml === undefined) {
        setInternalHtml(result);
      }
      onConversionComplete?.(result);

      // Extract revisions in background after conversion
      extractRevisions(fileToConvert);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsConverting(false);
    }
  }, [isReady, useWorker, worker, hookResult, getConvertOptions, controlledHtml, onConversionStart, onConversionComplete, onError, extractRevisions]);

  // Auto-convert when WASM ready and file available
  useEffect(() => {
    if (isReady && file && !html && !isConverting && controlledHtml === undefined) {
      convert(file);
    }
  }, [isReady, file, html, isConverting, convert, controlledHtml]);

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

      if (controlledFile === undefined) {
        setInternalFile(selectedFile);
        setInternalHtml(null);
      }
      onFileChange?.(selectedFile);

      // Fetch metadata first for placeholders, then convert
      fetchMetadata(selectedFile);
      if (isReady && controlledHtml === undefined) {
        await convert(selectedFile);
      }
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

    const input = document.getElementById('rdv-file-input') as HTMLInputElement;
    if (input) input.value = '';
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
  const handleZoomIn = () => updateSettings({
    paginationScale: Math.min(settings.paginationScale + 0.1, 2.0)
  });
  const handleZoomOut = () => updateSettings({
    paginationScale: Math.max(settings.paginationScale - 0.1, 0.3)
  });
  const handleZoomChange = (value: number) => updateSettings({
    paginationScale: Math.max(0.3, Math.min(2.0, value))
  });

  // Page navigation
  const goToPage = (pageNum: number) => {
    const container = paginatedContainerRef.current;
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
  const SettingsModal = () => (
    <div className="rdv-settings-overlay" onClick={() => setShowSettings(false)}>
      <div className="rdv-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rdv-settings-header">
          <h3>Viewer Settings</h3>
          <button className="rdv-settings-close" onClick={() => setShowSettings(false)}>×</button>
        </div>
        <div className="rdv-settings-body">
          <div className="rdv-settings-section">
            <h4>Display Options</h4>
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
                    name="commentMode"
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
                    name="annotationMode"
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

  // Toolbar component
  const Toolbar = () => (
    <div className="rdv-toolbar">
      <div className="rdv-toolbar-left">
        <label htmlFor="rdv-file-input" className="rdv-toolbar-file-btn">
          {fileName || 'Open Document'}
        </label>
        <input
          id="rdv-file-input"
          type="file"
          accept=".docx"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="rdv-file-input"
        />
        {fileName && (
          <button className="rdv-toolbar-btn rdv-toolbar-clear" onClick={handleClear} disabled={isProcessing}>
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

      <div className="rdv-toolbar-center">
        {html && totalPages > 0 && viewMode === 'document' && (
          <>
            <button
              className="rdv-toolbar-btn"
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              title="Previous Page"
            >
              ◀
            </button>
            <div className="rdv-page-input-group">
              <input
                type="number"
                className="rdv-page-input"
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
              className="rdv-toolbar-btn"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              title="Next Page"
            >
              ▶
            </button>

            <div className="rdv-toolbar-separator" />

            <button
              className="rdv-toolbar-btn"
              onClick={handleZoomOut}
              disabled={settings.paginationScale <= 0.3}
              title="Zoom Out"
            >
              −
            </button>
            <select
              className="rdv-zoom-select"
              value={settings.paginationScale}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            >
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
              className="rdv-toolbar-btn"
              onClick={handleZoomIn}
              disabled={settings.paginationScale >= 2.0}
              title="Zoom In"
            >
              +
            </button>
          </>
        )}
      </div>

      <div className="rdv-toolbar-right">
        {showSettingsButton && (
          <button
            className="rdv-toolbar-btn rdv-toolbar-settings"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  );

  const rootClassName = ['rdv-viewer', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} style={style}>
      {toolbar === 'top' && <Toolbar />}

      <div className="rdv-content">
        {initError && (
          <div className="rdv-message rdv-message--error">
            <p>Failed to initialize: {initError.message}</p>
          </div>
        )}

        {!initError && (isLoading || isConverting) && (
          documentMetadata && isConverting ? (
            // Show page placeholders while converting
            <div className="rdv-pages rdv-pages--loading">
              <div className="rdv-page-placeholders" style={{ backgroundColor: '#525659' }}>
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
                        marginBottom: '20px',
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
          <div className="rdv-message">
            <div className="rdv-message__icon">📄</div>
            <p>{placeholder}</p>
          </div>
        )}

        {error && !isConverting && (
          <div className="rdv-message rdv-message--error">
            <p>Error: {error.message}</p>
          </div>
        )}

        {viewMode === 'document' && html && !isConverting && (
          <div ref={paginatedContainerRef} className="rdv-pages">
            <PaginatedDocument
              html={html}
              scale={settings.paginationScale}
              showPageNumbers={settings.showPageNumbers}
              pageGap={20}
              backgroundColor="#525659"
              className="rdv-paginated-document"
              onPaginationComplete={(result: PaginationResult) => {
                setTotalPages(result.totalPages);
              }}
              onPageVisible={handlePageVisible}
            />
          </div>
        )}

        {viewMode === 'revisions' && html && !isConverting && (
          <RevisionPanel revisions={revisions} />
        )}
      </div>

      {toolbar === 'bottom' && <Toolbar />}

      {showSettings && <SettingsModal />}
    </div>
  );
}
