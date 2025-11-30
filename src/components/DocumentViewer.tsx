import { useState, useCallback, useRef, useEffect } from 'react';
import { useDocxodus, PaginatedDocument } from 'docxodus/react';
import { CommentRenderMode, PaginationMode, AnnotationLabelMode } from 'docxodus';
import type { PaginationResult } from 'docxodus/react';
import { WASM_BASE_PATH } from '../config';

type CommentMode = 'disabled' | 'endnote' | 'inline' | 'margin';
type AnnotationMode = 'disabled' | 'above' | 'inline' | 'tooltip' | 'none';

export function DocumentViewer() {
  const { isReady, isLoading, error: initError, convertToHtml } = useDocxodus(WASM_BASE_PATH);
  const [html, setHtml] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // Core options - defaults enabled for best experience
  const [enablePagination] = useState(true);
  const [paginationScale, setPaginationScale] = useState(0.8);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [renderFootnotesAndEndnotes, setRenderFootnotesAndEndnotes] = useState(true);
  const [renderHeadersAndFooters, setRenderHeadersAndFooters] = useState(true);

  // Comment & annotation options
  const [commentMode, setCommentMode] = useState<CommentMode>('disabled');
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('disabled');

  // Tracked changes options
  const [renderTrackedChanges, setRenderTrackedChanges] = useState(false);
  const [showDeletedContent, setShowDeletedContent] = useState(true);
  const [renderMoveOperations, setRenderMoveOperations] = useState(true);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pageTitle, setPageTitle] = useState('Document');
  const [cssPrefix, setCssPrefix] = useState('docx-');
  const [fabricateClasses, setFabricateClasses] = useState(true);
  const [additionalCss, setAdditionalCss] = useState('');
  const [commentCssClassPrefix, setCommentCssClassPrefix] = useState('comment-');
  const [annotationCssClassPrefix, setAnnotationCssClassPrefix] = useState('annot-');

  const paginatedContainerRef = useRef<HTMLDivElement>(null);

  const getCommentRenderMode = (mode: CommentMode): CommentRenderMode => {
    switch (mode) {
      case 'endnote': return CommentRenderMode.EndnoteStyle;
      case 'inline': return CommentRenderMode.Inline;
      case 'margin': return CommentRenderMode.Margin;
      default: return CommentRenderMode.Disabled;
    }
  };

  const getAnnotationLabelMode = (mode: AnnotationMode): AnnotationLabelMode | undefined => {
    switch (mode) {
      case 'above': return AnnotationLabelMode.Above;
      case 'inline': return AnnotationLabelMode.Inline;
      case 'tooltip': return AnnotationLabelMode.Tooltip;
      case 'none': return AnnotationLabelMode.None;
      default: return undefined;
    }
  };

  const getConvertOptions = useCallback(() => ({
    commentRenderMode: getCommentRenderMode(commentMode),
    pageTitle,
    cssPrefix,
    fabricateClasses,
    additionalCss: additionalCss || undefined,
    commentCssClassPrefix,
    paginationMode: enablePagination ? PaginationMode.Paginated : PaginationMode.None,
    paginationScale: enablePagination ? paginationScale : undefined,
    renderAnnotations: annotationMode !== 'disabled',
    annotationLabelMode: getAnnotationLabelMode(annotationMode),
    annotationCssClassPrefix,
    renderFootnotesAndEndnotes,
    renderHeadersAndFooters,
    renderTrackedChanges,
    showDeletedContent,
    renderMoveOperations,
  }), [commentMode, pageTitle, cssPrefix, fabricateClasses, additionalCss, commentCssClassPrefix, enablePagination, paginationScale, annotationMode, annotationCssClassPrefix, renderFootnotesAndEndnotes, renderHeadersAndFooters, renderTrackedChanges, showDeletedContent, renderMoveOperations]);

  const convert = useCallback(async (file: File) => {
    if (!isReady) return;
    setIsConverting(true);
    setError(null);
    try {
      const result = await convertToHtml(file, getConvertOptions());
      setHtml(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsConverting(false);
    }
  }, [isReady, convertToHtml, getConvertOptions]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPendingFile(file);
      await convert(file);
    }
  };

  const reconvert = useCallback(async () => {
    if (pendingFile) {
      await convert(pendingFile);
    }
  }, [pendingFile, convert]);

  const handleClear = () => {
    setHtml(null);
    setError(null);
    setFileName('');
    setPendingFile(null);
    setCurrentPage(1);
    setTotalPages(0);
    const input = document.getElementById('docx-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Zoom controls
  const handleZoomIn = () => setPaginationScale(Math.min(paginationScale + 0.1, 2.0));
  const handleZoomOut = () => setPaginationScale(Math.max(paginationScale - 0.1, 0.3));
  const handleZoomChange = (value: number) => setPaginationScale(Math.max(0.3, Math.min(2.0, value)));

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

  // Handle footnote/anchor clicks in paginated view
  useEffect(() => {
    const container = paginatedContainerRef.current;
    if (!container || !enablePagination) return;

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
        targetElement.classList.add('footnote-highlight');
        setTimeout(() => targetElement.classList.remove('footnote-highlight'), 2000);
      }
    };

    container.addEventListener('click', handleAnchorClick);
    return () => container.removeEventListener('click', handleAnchorClick);
  }, [enablePagination, html]);

  // Settings Modal Component
  const SettingsModal = () => (
    <div className="settings-overlay" onClick={() => setShowSettings(false)}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Viewer Settings</h3>
          <button className="settings-close" onClick={() => setShowSettings(false)}>×</button>
        </div>
        <div className="settings-body">
          <div className="settings-section">
            <h4>Display Options</h4>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={renderFootnotesAndEndnotes}
                onChange={(e) => setRenderFootnotesAndEndnotes(e.target.checked)}
              />
              <span>Show footnotes and endnotes</span>
            </label>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={renderHeadersAndFooters}
                onChange={(e) => setRenderHeadersAndFooters(e.target.checked)}
              />
              <span>Show headers and footers</span>
            </label>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
              />
              <span>Show page numbers</span>
            </label>
          </div>

          <div className="settings-section">
            <h4>Comment Rendering</h4>
            <div className="settings-radio-group">
              {(['disabled', 'endnote', 'inline', 'margin'] as CommentMode[]).map((mode) => (
                <label key={mode} className="settings-radio">
                  <input
                    type="radio"
                    name="commentMode"
                    checked={commentMode === mode}
                    onChange={() => setCommentMode(mode)}
                  />
                  <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}{mode === 'endnote' ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h4>Annotation Rendering</h4>
            <div className="settings-radio-group">
              {(['disabled', 'above', 'inline', 'tooltip', 'none'] as AnnotationMode[]).map((mode) => (
                <label key={mode} className="settings-radio">
                  <input
                    type="radio"
                    name="annotationMode"
                    checked={annotationMode === mode}
                    onChange={() => setAnnotationMode(mode)}
                  />
                  <span>{mode === 'none' ? 'Highlight Only' : mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h4>Tracked Changes</h4>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={renderTrackedChanges}
                onChange={(e) => setRenderTrackedChanges(e.target.checked)}
              />
              <span>Show tracked changes</span>
            </label>
            {renderTrackedChanges && (
              <div className="settings-subsection">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={showDeletedContent}
                    onChange={(e) => setShowDeletedContent(e.target.checked)}
                  />
                  <span>Show deleted content</span>
                </label>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={renderMoveOperations}
                    onChange={(e) => setRenderMoveOperations(e.target.checked)}
                  />
                  <span>Distinguish move operations</span>
                </label>
              </div>
            )}
          </div>

          <div className="settings-section">
            <button
              className="settings-toggle-advanced"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>
            {showAdvanced && (
              <div className="settings-advanced">
                <div className="settings-field">
                  <label>Page Title</label>
                  <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} />
                </div>
                <div className="settings-field">
                  <label>CSS Prefix</label>
                  <input type="text" value={cssPrefix} onChange={(e) => setCssPrefix(e.target.value)} />
                </div>
                <div className="settings-field">
                  <label>Comment CSS Prefix</label>
                  <input type="text" value={commentCssClassPrefix} onChange={(e) => setCommentCssClassPrefix(e.target.value)} />
                </div>
                <div className="settings-field">
                  <label>Annotation CSS Prefix</label>
                  <input type="text" value={annotationCssClassPrefix} onChange={(e) => setAnnotationCssClassPrefix(e.target.value)} />
                </div>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={fabricateClasses}
                    onChange={(e) => setFabricateClasses(e.target.checked)}
                  />
                  <span>Fabricate CSS classes</span>
                </label>
                <div className="settings-field">
                  <label>Additional CSS</label>
                  <textarea
                    value={additionalCss}
                    onChange={(e) => setAdditionalCss(e.target.value)}
                    rows={3}
                    placeholder=".custom { color: red; }"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-apply" onClick={() => { reconvert(); setShowSettings(false); }}>
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );

  const isProcessing = isConverting || isLoading;

  return (
    <div className="docx-viewer">
      {/* Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <label htmlFor="docx-input" className="toolbar-file-btn">
            {fileName || 'Open Document'}
          </label>
          <input
            id="docx-input"
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            disabled={isProcessing}
            style={{ display: 'none' }}
          />
          {fileName && (
            <button className="toolbar-btn toolbar-clear" onClick={handleClear} disabled={isProcessing}>
              ×
            </button>
          )}
        </div>

        <div className="toolbar-center">
          {html && totalPages > 0 && (
            <>
              <button
                className="toolbar-btn"
                onClick={goToPreviousPage}
                disabled={currentPage <= 1}
                title="Previous Page"
              >
                ◀
              </button>
              <div className="page-input-group">
                <input
                  type="number"
                  className="page-input"
                  value={currentPage}
                  min={1}
                  max={totalPages}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (!isNaN(page)) goToPage(page);
                  }}
                />
                <span className="page-total">/ {totalPages}</span>
              </div>
              <button
                className="toolbar-btn"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                title="Next Page"
              >
                ▶
              </button>

              <div className="toolbar-separator" />

              <button
                className="toolbar-btn"
                onClick={handleZoomOut}
                disabled={paginationScale <= 0.3}
                title="Zoom Out"
              >
                −
              </button>
              <select
                className="zoom-select"
                value={paginationScale}
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
                className="toolbar-btn"
                onClick={handleZoomIn}
                disabled={paginationScale >= 2.0}
                title="Zoom In"
              >
                +
              </button>
            </>
          )}
        </div>

        <div className="toolbar-right">
          <button
            className="toolbar-btn toolbar-settings"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="viewer-content">
        {isLoading && (
          <div className="viewer-message">
            <div className="spinner"></div>
            <p>Loading document engine...</p>
          </div>
        )}

        {initError && (
          <div className="viewer-message error">
            <p>Failed to initialize: {initError.message}</p>
          </div>
        )}

        {!isLoading && !initError && !html && !isConverting && (
          <div className="viewer-message placeholder">
            <div className="placeholder-icon">📄</div>
            <p>Open a DOCX file to view</p>
          </div>
        )}

        {isConverting && (
          <div className="viewer-message">
            <div className="spinner"></div>
            <p>Processing document...</p>
          </div>
        )}

        {error && !isConverting && (
          <div className="viewer-message error">
            <p>Error: {error.message}</p>
          </div>
        )}

        {html && !isConverting && (
          <div ref={paginatedContainerRef} className="viewer-pages">
            <PaginatedDocument
              html={html}
              scale={paginationScale}
              showPageNumbers={showPageNumbers}
              pageGap={20}
              backgroundColor="#525659"
              className="paginated-document"
              onPaginationComplete={(result: PaginationResult) => {
                setTotalPages(result.totalPages);
              }}
              onPageVisible={(pageNumber: number) => {
                setCurrentPage(pageNumber);
              }}
            />
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal />}
    </div>
  );
}
