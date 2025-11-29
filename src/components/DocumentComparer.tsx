import { useState } from 'react';
import { useComparison } from 'docxodus/react';

export function DocumentComparer() {
  const {
    html,
    revisions,
    isComparing,
    error,
    compareToHtml,
    downloadResult,
    clear,
  } = useComparison();

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [authorName, setAuthorName] = useState('Reviewer');
  const [detailThreshold, setDetailThreshold] = useState(0.15);
  const [caseInsensitive, setCaseInsensitive] = useState(false);

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
              disabled={isComparing}
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
              disabled={isComparing}
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
            disabled={isComparing}
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
              disabled={isComparing}
            />
            <span className="option-hint">Lower = more detailed comparison</span>
          </div>

          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={caseInsensitive}
                onChange={(e) => setCaseInsensitive(e.target.checked)}
                disabled={isComparing}
              />
              <span>Case-insensitive comparison</span>
            </label>
          </div>
        </div>
      </div>

      <div className="compare-actions">
        <button
          onClick={handleCompare}
          disabled={!originalFile || !modifiedFile || isComparing}
          className="compare-btn"
        >
          {isComparing ? 'Comparing...' : 'Compare Documents'}
        </button>

        {html && (
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
        <div className="loading">
          <div className="spinner"></div>
          <p>Comparing documents...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {revisions && revisions.length > 0 && (
        <div className="revisions-summary">
          <h3>Revisions Found: {revisions.length}</h3>
          <div className="revision-stats">
            <span className="stat insertion">
              Insertions: {revisions.filter((r) => r.revisionType === 'Insertion').length}
            </span>
            <span className="stat deletion">
              Deletions: {revisions.filter((r) => r.revisionType === 'Deletion').length}
            </span>
          </div>
        </div>
      )}

      {html && (
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
