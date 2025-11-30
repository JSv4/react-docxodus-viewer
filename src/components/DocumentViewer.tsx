import { useState, useCallback } from 'react';
import { useDocxodus, PaginatedDocument } from 'docxodus/react';
import { CommentRenderMode, PaginationMode } from 'docxodus';
import type { PaginationResult } from 'docxodus/react';
import { WASM_BASE_PATH } from '../config';

type CommentMode = 'disabled' | 'endnote' | 'inline' | 'margin';

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

  // Advanced options
  const [pageTitle, setPageTitle] = useState('Document');
  const [cssPrefix, setCssPrefix] = useState('docx-');
  const [fabricateClasses, setFabricateClasses] = useState(true);
  const [additionalCss, setAdditionalCss] = useState('');
  const [commentCssClassPrefix, setCommentCssClassPrefix] = useState('comment-');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getCommentRenderMode = (mode: CommentMode): CommentRenderMode => {
    switch (mode) {
      case 'endnote': return CommentRenderMode.EndnoteStyle;
      case 'inline': return CommentRenderMode.Inline;
      case 'margin': return CommentRenderMode.Margin;
      default: return CommentRenderMode.Disabled;
    }
  };

  const getConvertOptions = useCallback((overrides?: {
    commentRenderMode?: CommentRenderMode;
    paginationMode?: PaginationMode;
    paginationScale?: number;
    fabricateClasses?: boolean;
  }) => ({
    commentRenderMode: overrides?.commentRenderMode ?? getCommentRenderMode(commentMode),
    pageTitle,
    cssPrefix,
    fabricateClasses: overrides?.fabricateClasses ?? fabricateClasses,
    additionalCss: additionalCss || undefined,
    commentCssClassPrefix,
    paginationMode: overrides?.paginationMode ?? (enablePagination ? PaginationMode.Paginated : PaginationMode.None),
    paginationScale: overrides?.paginationScale ?? (enablePagination ? paginationScale : undefined),
  }), [commentMode, pageTitle, cssPrefix, fabricateClasses, additionalCss, commentCssClassPrefix, enablePagination, paginationScale]);

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

  const handleClear = () => {
    setHtml(null);
    setError(null);
    setFileName('');
    setPendingFile(null);
    const input = document.getElementById('docx-input') as HTMLInputElement;
    if (input) input.value = '';
  };

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
                onMouseUp={reconvert}
                onTouchEnd={reconvert}
                disabled={isProcessing}
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
              {totalPages > 0 && (
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
              )}
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
