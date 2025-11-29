import { useState } from 'react';
import { useDocxodus } from 'docxodus/react';

interface Revision {
  author: string;
  date: string;
  revisionType: string;
  text: string;
}

export function RevisionViewer() {
  const { isReady, isLoading, error: initError, getRevisions } = useDocxodus();
  const [fileName, setFileName] = useState<string>('');
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isReady) {
      setFileName(file.name);
      setIsExtracting(true);
      setError(null);
      try {
        const result = await getRevisions(file);
        setRevisions(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to extract revisions'));
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleClear = () => {
    setFileName('');
    setRevisions(null);
    setError(null);
    const input = document.getElementById('revision-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="revision-viewer">
        <div className="loading">
          <div className="spinner"></div>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="revision-viewer">
        <div className="error">
          <p>Initialization Error: {initError.message}</p>
        </div>
      </div>
    );
  }

  const insertions = revisions?.filter((r) => r.revisionType?.toLowerCase().includes('insert')) || [];
  const deletions = revisions?.filter((r) => r.revisionType?.toLowerCase().includes('delet')) || [];

  return (
    <div className="revision-viewer">
      <div className="upload-section">
        <label htmlFor="revision-input" className="file-label">
          <span className="file-icon">📋</span>
          {fileName || 'Choose a DOCX with tracked changes'}
        </label>
        <input
          id="revision-input"
          type="file"
          accept=".docx"
          onChange={handleFileChange}
          disabled={isExtracting || !isReady}
        />
        {revisions && (
          <button onClick={handleClear} className="clear-btn">
            Clear
          </button>
        )}
      </div>

      <p className="helper-text">
        Upload a document with tracked changes (e.g., from Compare Documents) to extract revision details.
      </p>

      {isExtracting && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Extracting revisions...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {revisions && revisions.length === 0 && (
        <div className="no-revisions">
          <p>No tracked changes found in this document.</p>
        </div>
      )}

      {revisions && revisions.length > 0 && (
        <>
          <div className="revisions-summary">
            <h3>Revisions Found: {revisions.length}</h3>
            <div className="revision-stats">
              <span className="stat insertion">Insertions: {insertions.length}</span>
              <span className="stat deletion">Deletions: {deletions.length}</span>
            </div>
          </div>

          <div className="revisions-list">
            {revisions.map((rev, index) => {
              const typeClass = rev.revisionType?.toLowerCase().includes('insert')
                ? 'insertion'
                : rev.revisionType?.toLowerCase().includes('delet')
                ? 'deletion'
                : '';
              return (
              <div
                key={index}
                className={`revision-item ${typeClass}`}
              >
                <div className="revision-header">
                  <span className={`revision-type ${typeClass}`}>
                    {rev.revisionType}
                  </span>
                  <span className="revision-author">{rev.author}</span>
                  <span className="revision-date">{formatDate(rev.date)}</span>
                </div>
                <div className="revision-text">
                  {rev.text || <em>(empty)</em>}
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
