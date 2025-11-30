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
  const [commentMode, setCommentMode] = useState<CommentMode>('disabled');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Pagination options
  const [enablePagination, setEnablePagination] = useState(false);
  const [paginationScale, setPaginationScale] = useState(0.8);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const paginatedContainerRef = useRef<HTMLDivElement>(null);

  // Annotation options
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('disabled');

  // Footnotes, Headers, and Tracked Changes options
  const [renderFootnotesAndEndnotes, setRenderFootnotesAndEndnotes] = useState(false);
  const [renderHeadersAndFooters, setRenderHeadersAndFooters] = useState(false);
  const [renderTrackedChanges, setRenderTrackedChanges] = useState(false);
  const [showDeletedContent, setShowDeletedContent] = useState(true);
  const [renderMoveOperations, setRenderMoveOperations] = useState(true);

  // Advanced options
  const [pageTitle, setPageTitle] = useState('Document');
  const [cssPrefix, setCssPrefix] = useState('docx-');
  const [fabricateClasses, setFabricateClasses] = useState(true);
  const [additionalCss, setAdditionalCss] = useState('');
  const [commentCssClassPrefix, setCommentCssClassPrefix] = useState('comment-');
  const [annotationCssClassPrefix, setAnnotationCssClassPrefix] = useState('annot-');
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const getConvertOptions = useCallback((overrides?: {
    commentRenderMode?: CommentRenderMode;
    paginationMode?: PaginationMode;
    paginationScale?: number;
    fabricateClasses?: boolean;
    renderAnnotations?: boolean;
    annotationLabelMode?: AnnotationLabelMode;
    renderFootnotesAndEndnotes?: boolean;
    renderHeadersAndFooters?: boolean;
    renderTrackedChanges?: boolean;
    showDeletedContent?: boolean;
    renderMoveOperations?: boolean;
  }) => ({
    commentRenderMode: overrides?.commentRenderMode ?? getCommentRenderMode(commentMode),
    pageTitle,
    cssPrefix,
    fabricateClasses: overrides?.fabricateClasses ?? fabricateClasses,
    additionalCss: additionalCss || undefined,
    commentCssClassPrefix,
    paginationMode: overrides?.paginationMode ?? (enablePagination ? PaginationMode.Paginated : PaginationMode.None),
    paginationScale: overrides?.paginationScale ?? (enablePagination ? paginationScale : undefined),
    renderAnnotations: overrides?.renderAnnotations ?? (annotationMode !== 'disabled'),
    annotationLabelMode: overrides?.annotationLabelMode ?? getAnnotationLabelMode(annotationMode),
    annotationCssClassPrefix,
    renderFootnotesAndEndnotes: overrides?.renderFootnotesAndEndnotes ?? renderFootnotesAndEndnotes,
    renderHeadersAndFooters: overrides?.renderHeadersAndFooters ?? renderHeadersAndFooters,
    renderTrackedChanges: overrides?.renderTrackedChanges ?? renderTrackedChanges,
    showDeletedContent: overrides?.showDeletedContent ?? showDeletedContent,
    renderMoveOperations: overrides?.renderMoveOperations ?? renderMoveOperations,
  }), [commentMode, pageTitle, cssPrefix, fabricateClasses, additionalCss, commentCssClassPrefix, enablePagination, paginationScale, annotationMode, annotationCssClassPrefix, renderFootnotesAndEndnotes, renderHeadersAndFooters, renderTrackedChanges, showDeletedContent, renderMoveOperations]);

  const convert = useCallback(async (file: File, options: ReturnType<typeof getConvertOptions>) => {
    if (!isReady) return;
    setIsConverting(true);
    setError(null);
    setHtml(null); // Clear previous result to show loading indicator
    try {
      const result = await convertToHtml(file, options);
      setHtml(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsConverting(false);
    }
  }, [isReady, convertToHtml]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPendingFile(file);
      await convert(file, getConvertOptions());
    }
  };

  const reconvert = async () => {
    if (pendingFile) {
      await convert(pendingFile, getConvertOptions());
    }
  };

  const handleCommentModeChange = async (mode: CommentMode) => {
    setCommentMode(mode);
    if (pendingFile) {
      await convert(pendingFile, getConvertOptions({ commentRenderMode: getCommentRenderMode(mode) }));
    }
  };

  const handlePaginationToggle = async (enabled: boolean) => {
    setEnablePagination(enabled);
    if (pendingFile) {
      await convert(pendingFile, getConvertOptions({
        paginationMode: enabled ? PaginationMode.Paginated : PaginationMode.None,
        paginationScale: enabled ? paginationScale : undefined,
      }));
    }
  };

  const handleAnnotationModeChange = async (mode: AnnotationMode) => {
    setAnnotationMode(mode);
    if (pendingFile) {
      await convert(pendingFile, getConvertOptions({
        renderAnnotations: mode !== 'disabled',
        annotationLabelMode: getAnnotationLabelMode(mode),
      }));
    }
  };

  const handleClear = () => {
    setHtml(null);
    setError(null);
    setFileName('');
    setPendingFile(null);
    const input = document.getElementById('docx-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newScale = Math.min(paginationScale + 0.1, 2.0);
    setPaginationScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(paginationScale - 0.1, 0.3);
    setPaginationScale(newScale);
  };

  const handleZoomChange = (value: number) => {
    setPaginationScale(Math.max(0.3, Math.min(2.0, value)));
  };

  // Page navigation
  const goToPage = (pageNum: number) => {
    const container = paginatedContainerRef.current;
    if (!container || pageNum < 1 || pageNum > totalPages) return;

    const pageElement = container.querySelector(`[data-page-number="${pageNum}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

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
        // Highlight briefly
        targetElement.classList.add('footnote-highlight');
        setTimeout(() => {
          targetElement.classList.remove('footnote-highlight');
        }, 2000);
      }
    };

    container.addEventListener('click', handleAnchorClick);
    return () => container.removeEventListener('click', handleAnchorClick);
  }, [enablePagination, html]);

  const isProcessing = isConverting || isLoading;

  if (isLoading) {
    return (
      <div className="document-viewer">
        <div className="loading loading-init">
          <div className="spinner"></div>
          <p>Loading document engine...</p>
          <span className="loading-hint">This may take a moment on first load</span>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="document-viewer">
        <div className="error">
          <p>Failed to initialize: {initError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-viewer">
      <div className="upload-section">
        <label htmlFor="docx-input" className="file-label">
          <span className="file-icon">📄</span>
          {fileName || 'Choose a DOCX file'}
        </label>
        <input
          id="docx-input"
          type="file"
          accept=".docx"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        {html && (
          <button onClick={handleClear} className="clear-btn" disabled={isProcessing}>
            Clear
          </button>
        )}
      </div>

      <div className="options-section">
        <div className="option-group">
          <label>Comment Rendering</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'disabled'}
                onChange={() => handleCommentModeChange('disabled')}
                disabled={isProcessing}
              />
              <span>Disabled</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'endnote'}
                onChange={() => handleCommentModeChange('endnote')}
                disabled={isProcessing}
              />
              <span>Endnotes</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'inline'}
                onChange={() => handleCommentModeChange('inline')}
                disabled={isProcessing}
              />
              <span>Inline</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'margin'}
                onChange={() => handleCommentModeChange('margin')}
                disabled={isProcessing}
              />
              <span>Margin</span>
            </label>
          </div>
        </div>

        <div className="option-group">
          <label>Annotation Rendering</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="annotationMode"
                checked={annotationMode === 'disabled'}
                onChange={() => handleAnnotationModeChange('disabled')}
                disabled={isProcessing}
              />
              <span>Disabled</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="annotationMode"
                checked={annotationMode === 'above'}
                onChange={() => handleAnnotationModeChange('above')}
                disabled={isProcessing}
              />
              <span>Above</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="annotationMode"
                checked={annotationMode === 'inline'}
                onChange={() => handleAnnotationModeChange('inline')}
                disabled={isProcessing}
              />
              <span>Inline</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="annotationMode"
                checked={annotationMode === 'tooltip'}
                onChange={() => handleAnnotationModeChange('tooltip')}
                disabled={isProcessing}
              />
              <span>Tooltip</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="annotationMode"
                checked={annotationMode === 'none'}
                onChange={() => handleAnnotationModeChange('none')}
                disabled={isProcessing}
              />
              <span>Highlight Only</span>
            </label>
          </div>
        </div>

        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enablePagination}
              onChange={(e) => handlePaginationToggle(e.target.checked)}
              disabled={isProcessing}
            />
            <span>Enable pagination (PDF-style pages)</span>
          </label>
        </div>

        {enablePagination && (
          <div className="pagination-options">
            <div className="option-group">
              <label htmlFor="pagination-scale">
                Page Scale: {Math.round(paginationScale * 100)}%
              </label>
              <input
                id="pagination-scale"
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={paginationScale}
                onChange={(e) => setPaginationScale(parseFloat(e.target.value))}
              />
            </div>
            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showPageNumbers}
                  onChange={(e) => setShowPageNumbers(e.target.checked)}
                  disabled={isProcessing}
                />
                <span>Show page numbers</span>
              </label>
            </div>
          </div>
        )}

        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={renderFootnotesAndEndnotes}
              onChange={(e) => {
                setRenderFootnotesAndEndnotes(e.target.checked);
                if (pendingFile) {
                  convert(pendingFile, getConvertOptions({ renderFootnotesAndEndnotes: e.target.checked }));
                }
              }}
              disabled={isProcessing}
            />
            <span>Show footnotes and endnotes</span>
          </label>
        </div>

        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={renderHeadersAndFooters}
              onChange={(e) => {
                setRenderHeadersAndFooters(e.target.checked);
                if (pendingFile) {
                  convert(pendingFile, getConvertOptions({ renderHeadersAndFooters: e.target.checked }));
                }
              }}
              disabled={isProcessing}
            />
            <span>Show headers and footers</span>
          </label>
        </div>

        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={renderTrackedChanges}
              onChange={(e) => {
                setRenderTrackedChanges(e.target.checked);
                if (pendingFile) {
                  convert(pendingFile, getConvertOptions({ renderTrackedChanges: e.target.checked }));
                }
              }}
              disabled={isProcessing}
            />
            <span>Show tracked changes (insertions/deletions)</span>
          </label>
        </div>

        {renderTrackedChanges && (
          <div className="tracked-changes-options">
            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showDeletedContent}
                  onChange={(e) => {
                    setShowDeletedContent(e.target.checked);
                    if (pendingFile) {
                      convert(pendingFile, getConvertOptions({ showDeletedContent: e.target.checked }));
                    }
                  }}
                  disabled={isProcessing}
                />
                <span>Show deleted content with strikethrough</span>
              </label>
            </div>
            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={renderMoveOperations}
                  onChange={(e) => {
                    setRenderMoveOperations(e.target.checked);
                    if (pendingFile) {
                      convert(pendingFile, getConvertOptions({ renderMoveOperations: e.target.checked }));
                    }
                  }}
                  disabled={isProcessing}
                />
                <span>Distinguish move operations</span>
              </label>
            </div>
          </div>
        )}

        <div className="option-group">
          <button
            type="button"
            className="toggle-advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-options">
            <div className="option-group">
              <label htmlFor="page-title">Page Title</label>
              <input
                id="page-title"
                type="text"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                onBlur={reconvert}
                placeholder="Document"
                disabled={isProcessing}
                className="text-input"
              />
              <span className="option-hint">HTML document title</span>
            </div>

            <div className="option-group">
              <label htmlFor="css-prefix">CSS Prefix</label>
              <input
                id="css-prefix"
                type="text"
                value={cssPrefix}
                onChange={(e) => setCssPrefix(e.target.value)}
                onBlur={reconvert}
                placeholder="docx-"
                disabled={isProcessing}
                className="text-input"
              />
              <span className="option-hint">CSS class prefix for generated styles</span>
            </div>

            <div className="option-group">
              <label htmlFor="comment-css-prefix">Comment CSS Prefix</label>
              <input
                id="comment-css-prefix"
                type="text"
                value={commentCssClassPrefix}
                onChange={(e) => setCommentCssClassPrefix(e.target.value)}
                onBlur={reconvert}
                placeholder="comment-"
                disabled={isProcessing}
                className="text-input"
              />
              <span className="option-hint">CSS prefix for comment elements</span>
            </div>

            <div className="option-group">
              <label htmlFor="annotation-css-prefix">Annotation CSS Prefix</label>
              <input
                id="annotation-css-prefix"
                type="text"
                value={annotationCssClassPrefix}
                onChange={(e) => setAnnotationCssClassPrefix(e.target.value)}
                onBlur={reconvert}
                placeholder="annot-"
                disabled={isProcessing}
                className="text-input"
              />
              <span className="option-hint">CSS prefix for annotation elements</span>
            </div>

            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fabricateClasses}
                  onChange={(e) => {
                    setFabricateClasses(e.target.checked);
                    if (pendingFile) {
                      convert(pendingFile, getConvertOptions({ fabricateClasses: e.target.checked }));
                    }
                  }}
                  disabled={isProcessing}
                />
                <span>Fabricate CSS classes</span>
              </label>
              <span className="option-hint">Generate CSS classes for styling</span>
            </div>

            <div className="option-group">
              <label htmlFor="additional-css">Additional CSS</label>
              <textarea
                id="additional-css"
                value={additionalCss}
                onChange={(e) => setAdditionalCss(e.target.value)}
                onBlur={reconvert}
                placeholder=".custom { color: red; }"
                disabled={isProcessing}
                className="textarea-input"
                rows={3}
              />
              <span className="option-hint">Custom CSS to include in output</span>
            </div>
          </div>
        )}
      </div>

      {isConverting && (
        <div className="loading loading-processing">
          <div className="spinner"></div>
          <p>Processing document...</p>
          <span className="loading-hint">This may take 10+ seconds for large documents</span>
        </div>
      )}

      {error && !isConverting && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {html && !isConverting && (
        <div className="document-content">
          {enablePagination ? (
            <>
              {/* PDF.js style toolbar */}
              <div className="pdf-toolbar">
                <div className="toolbar-group">
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
                </div>

                <div className="toolbar-separator" />

                <div className="toolbar-group">
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
                </div>
              </div>

              <div ref={paginatedContainerRef}>
                <PaginatedDocument
                  html={html}
                  scale={paginationScale}
                  showPageNumbers={showPageNumbers}
                  pageGap={20}
                  backgroundColor="#525659"
                  className="paginated-preview"
                  onPaginationComplete={(result: PaginationResult) => {
                    setTotalPages(result.totalPages);
                  }}
                  onPageVisible={(pageNumber: number) => {
                    setCurrentPage(pageNumber);
                  }}
                />
              </div>
            </>
          ) : (
            <div
              className="html-preview"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      )}
    </div>
  );
}
