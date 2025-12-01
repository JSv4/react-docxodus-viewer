import { useState } from 'react';
import { useDocxodus, useComparison } from 'docxodus/react';

// WASM base path - relative to deployed URL base
const WASM_BASE_PATH = import.meta.env.BASE_URL + 'wasm/';

export function DocumentComparer() {
  // Use useDocxodus just to get loading state
  const { isLoading, error: initError } = useDocxodus(WASM_BASE_PATH);

  // Use useComparison for the actual comparison functionality
  const {
    html,
    revisions,
    isComparing,
    error,
    compareToHtml,
    downloadResult,
    clear,
  } = useComparison(WASM_BASE_PATH);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [authorName, setAuthorName] = useState('Reviewer');
  const [detailThreshold, setDetailThreshold] = useState(0.15);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [renderTrackedChanges, setRenderTrackedChanges] = useState(true);

  const handleOriginalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setOriginalFile(file);
  };

  const handleModifiedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setModifiedFile(file);
  };

  const handleCompare = async () => {
    if (originalFile && modifiedFile) {
      await compareToHtml(originalFile, modifiedFile, {
        authorName,
        detailThreshold,
        caseInsensitive,
        renderTrackedChanges,
      });
    }
  };

  const handleClear = () => {
    clear();
    setOriginalFile(null);
    setModifiedFile(null);
    const inputs = document.querySelectorAll<HTMLInputElement>('.compare-input');
    inputs.forEach((input) => (input.value = ''));
  };

  const handleDownload = () => {
    downloadResult(`comparison-${Date.now()}.docx`);
  };

  // Count revisions by type
  const insertions = revisions?.filter((r) => r.revisionType === 'Insertion' || r.revisionType === 'Inserted') || [];
  const deletions = revisions?.filter((r) => r.revisionType === 'Deletion' || r.revisionType === 'Deleted') || [];
  const moves = revisions?.filter((r) => r.revisionType === 'Moved' || (r as { moveGroupId?: number }).moveGroupId !== undefined) || [];

  const isProcessing = isComparing || isLoading;

  if (isLoading) {
    return (
      <div className="document-comparer">
        <div className="loading loading-init">
          <div className="spinner"></div>
          <p>Loading comparison engine...</p>
          <span className="loading-hint">This may take a moment on first load</span>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="document-comparer">
        <div className="error">
          <p>Failed to initialize: {initError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-comparer">
      <div className="compare-inputs">
        <div className="file-group">
          <label>Original Document</label>
          <div className="file-input-wrapper">
            <label htmlFor="original-input" className="file-label">
              <span className="file-icon">📄</span>
              {originalFile?.name || 'Choose original file'}
            </label>
            <input
              id="original-input"
              className="compare-input"
              type="file"
              accept=".docx"
              onChange={handleOriginalChange}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="file-group">
          <label>Modified Document</label>
          <div className="file-input-wrapper">
            <label htmlFor="modified-input" className="file-label">
              <span className="file-icon">📝</span>
              {modifiedFile?.name || 'Choose modified file'}
            </label>
            <input
              id="modified-input"
              className="compare-input"
              type="file"
              accept=".docx"
              onChange={handleModifiedChange}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="author-group">
          <label htmlFor="author-input">Author Name</label>
          <input
            id="author-input"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Reviewer name"
            disabled={isProcessing}
          />
        </div>

        <div className="options-row">
          <div className="option-group">
            <label htmlFor="detail-threshold">
              Detail Level: {Math.round((1 - detailThreshold) * 100)}%
            </label>
            <input
              id="detail-threshold"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={detailThreshold}
              onChange={(e) => setDetailThreshold(parseFloat(e.target.value))}
              disabled={isProcessing}
            />
            <span className="option-hint">Lower = more detailed comparison</span>
          </div>

          <div className="option-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={caseInsensitive}
                onChange={(e) => setCaseInsensitive(e.target.checked)}
                disabled={isProcessing}
              />
              <span>Case-insensitive comparison</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={renderTrackedChanges}
                onChange={(e) => setRenderTrackedChanges(e.target.checked)}
                disabled={isProcessing}
              />
              <span>Show tracked changes in preview</span>
            </label>
          </div>
        </div>
      </div>

      <div className="compare-actions">
        <button
          onClick={handleCompare}
          disabled={!originalFile || !modifiedFile || isProcessing}
          className="compare-btn"
        >
          {isComparing ? 'Comparing...' : 'Compare Documents'}
        </button>

        {html && !isComparing && (
          <>
            <button onClick={handleDownload} className="download-btn">
              Download Redlined DOCX
            </button>
            <button onClick={handleClear} className="clear-btn">
              Clear
            </button>
          </>
        )}
      </div>

      {isComparing && (
        <div className="loading loading-processing">
          <div className="spinner"></div>
          <p>Comparing documents...</p>
          <span className="loading-hint">This may take 10+ seconds for large documents</span>
        </div>
      )}

      {error && !isComparing && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {revisions && revisions.length > 0 && !isComparing && (
        <div className="revisions-summary">
          <h3>Revisions Found: {revisions.length}</h3>
          <div className="revision-stats">
            <span className="stat insertion">
              Insertions: {insertions.length}
            </span>
            <span className="stat deletion">
              Deletions: {deletions.length}
            </span>
            {moves.length > 0 && (
              <span className="stat move">
                Moves: {moves.length}
              </span>
            )}
          </div>
        </div>
      )}

      {html && !isComparing && (
        <div className="document-content">
          <div
            className="html-preview comparison-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}
