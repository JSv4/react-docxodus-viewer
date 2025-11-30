import { useState, useMemo, useEffect } from 'react';
import { getRevisions as getRevisionsFromDoc, isMove, isMoveSource, findMovePair, isInsertion, isDeletion, isFormatChange, initialize, isInitialized } from 'docxodus';
import type { Revision } from 'docxodus';
import { WASM_BASE_PATH } from '../config';

export function RevisionViewer() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<Error | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Move detection options
  const [detectMoves, setDetectMoves] = useState(true);
  const [moveSimilarityThreshold, setMoveSimilarityThreshold] = useState(0.8);
  const [moveMinimumWordCount, setMoveMinimumWordCount] = useState(3);
  const [caseInsensitive, setCaseInsensitive] = useState(false);

  // Store file reference for re-extraction
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Display filters
  const [showInsertions, setShowInsertions] = useState(true);
  const [showDeletions, setShowDeletions] = useState(true);
  const [showMoves, setShowMoves] = useState(true);
  const [showFormatChanges, setShowFormatChanges] = useState(true);

  // Initialize WASM on mount
  useEffect(() => {
    const init = async () => {
      if (isInitialized()) {
        setIsReady(true);
        setIsLoading(false);
        return;
      }
      try {
        await initialize(WASM_BASE_PATH);
        setIsReady(true);
      } catch (err) {
        setInitError(err instanceof Error ? err : new Error('Failed to initialize'));
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const extractRevisions = async (file: File) => {
    if (!isReady) return;
    setIsExtracting(true);
    setError(null);
    setRevisions(null); // Clear previous results to show loading
    try {
      const result = await getRevisionsFromDoc(file, {
        detectMoves,
        moveSimilarityThreshold,
        moveMinimumWordCount,
        caseInsensitive,
      });
      setRevisions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to extract revisions'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isReady) {
      setFileName(file.name);
      setPendingFile(file);
      await extractRevisions(file);
    }
  };

  const handleReExtract = async () => {
    if (pendingFile) {
      await extractRevisions(pendingFile);
    }
  };

  const handleClear = () => {
    setFileName('');
    setRevisions(null);
    setError(null);
    setPendingFile(null);
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

  // Compute statistics
  const stats = useMemo(() => {
    if (!revisions) return { insertions: 0, deletions: 0, moves: 0, formatChanges: 0 };
    return {
      insertions: revisions.filter((r) => isInsertion(r) && !isMove(r)).length,
      deletions: revisions.filter((r) => isDeletion(r) && !isMove(r)).length,
      moves: revisions.filter(isMove).length,
      formatChanges: revisions.filter(isFormatChange).length,
    };
  }, [revisions]);

  // Filter revisions based on display settings
  const filteredRevisions = useMemo(() => {
    if (!revisions) return null;
    return revisions.filter((r) => {
      if (isMove(r)) return showMoves;
      if (isFormatChange(r)) return showFormatChanges;
      if (isInsertion(r)) return showInsertions;
      if (isDeletion(r)) return showDeletions;
      return true;
    });
  }, [revisions, showInsertions, showDeletions, showMoves, showFormatChanges]);

  const getRevisionTypeClass = (rev: Revision): string => {
    if (isMove(rev)) return 'move';
    if (isFormatChange(rev)) return 'format-change';
    if (isInsertion(rev)) return 'insertion';
    if (isDeletion(rev)) return 'deletion';
    return '';
  };

  const getRevisionTypeLabel = (rev: Revision): string => {
    if (isMove(rev)) {
      return isMoveSource(rev) ? 'Moved From' : 'Moved To';
    }
    if (isFormatChange(rev)) return 'Format Changed';
    if (isInsertion(rev)) return 'Inserted';
    if (isDeletion(rev)) return 'Deleted';
    return String(rev.revisionType);
  };

  const formatChangeDescription = (rev: Revision): string | null => {
    if (!isFormatChange(rev) || !rev.formatChange) return null;
    const { changedPropertyNames, oldProperties, newProperties } = rev.formatChange;
    if (!changedPropertyNames || changedPropertyNames.length === 0) return null;

    const changes = changedPropertyNames.map(prop => {
      const oldVal = oldProperties?.[prop] ?? '(none)';
      const newVal = newProperties?.[prop] ?? '(none)';
      return `${prop}: ${oldVal} → ${newVal}`;
    });
    return changes.join(', ');
  };

  const getMovePairInfo = (rev: Revision): string | null => {
    if (!isMove(rev) || !revisions) return null;
    const pair = findMovePair(rev, revisions);
    if (!pair) return null;
    const direction = isMoveSource(rev) ? 'Destination' : 'Source';
    const preview = pair.text.length > 50 ? pair.text.substring(0, 50) + '...' : pair.text;
    return `${direction}: "${preview}"`;
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

      <div className="options-section">
        <div className="option-group">
          <button
            type="button"
            className="toggle-advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Move Detection Options
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-options">
            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={detectMoves}
                  onChange={(e) => setDetectMoves(e.target.checked)}
                  disabled={isExtracting}
                />
                <span>Enable move detection</span>
              </label>
              <span className="option-hint">Identify relocated content instead of separate delete/insert</span>
            </div>

            {detectMoves && (
              <>
                <div className="option-group">
                  <label htmlFor="similarity-threshold">
                    Similarity Threshold: {Math.round(moveSimilarityThreshold * 100)}%
                  </label>
                  <input
                    id="similarity-threshold"
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={moveSimilarityThreshold}
                    onChange={(e) => setMoveSimilarityThreshold(parseFloat(e.target.value))}
                    disabled={isExtracting}
                  />
                  <span className="option-hint">Higher = require more exact matches (Jaccard similarity)</span>
                </div>

                <div className="option-group">
                  <label htmlFor="min-word-count">
                    Minimum Word Count: {moveMinimumWordCount}
                  </label>
                  <input
                    id="min-word-count"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={moveMinimumWordCount}
                    onChange={(e) => setMoveMinimumWordCount(parseInt(e.target.value))}
                    disabled={isExtracting}
                  />
                  <span className="option-hint">Short phrases below this count are excluded</span>
                </div>

                <div className="option-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={caseInsensitive}
                      onChange={(e) => setCaseInsensitive(e.target.checked)}
                      disabled={isExtracting}
                    />
                    <span>Case-insensitive matching</span>
                  </label>
                  <span className="option-hint">Ignore case differences when detecting moves</span>
                </div>
              </>
            )}

            {pendingFile && (
              <button
                onClick={handleReExtract}
                disabled={isExtracting}
                className="compare-btn"
                style={{ marginTop: '0.5rem' }}
              >
                Re-extract with new settings
              </button>
            )}
          </div>
        )}
      </div>

      {isExtracting && (
        <div className="loading loading-processing">
          <div className="spinner"></div>
          <p>Extracting revisions...</p>
          <span className="loading-hint">This may take 10+ seconds for large documents</span>
        </div>
      )}

      {error && !isExtracting && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {revisions && revisions.length === 0 && !isExtracting && (
        <div className="no-revisions">
          <p>No tracked changes found in this document.</p>
        </div>
      )}

      {revisions && revisions.length > 0 && (
        <>
          <div className="revisions-summary">
            <h3>Revisions Found: {revisions.length}</h3>
            <div className="revision-stats">
              <span className="stat insertion">Insertions: {stats.insertions}</span>
              <span className="stat deletion">Deletions: {stats.deletions}</span>
              {stats.moves > 0 && (
                <span className="stat move">Moves: {stats.moves}</span>
              )}
              {stats.formatChanges > 0 && (
                <span className="stat format-change">Format Changes: {stats.formatChanges}</span>
              )}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-label">Show:</span>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showInsertions}
                onChange={(e) => setShowInsertions(e.target.checked)}
              />
              <span className="filter-text insertion">Insertions</span>
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showDeletions}
                onChange={(e) => setShowDeletions(e.target.checked)}
              />
              <span className="filter-text deletion">Deletions</span>
            </label>
            {stats.moves > 0 && (
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showMoves}
                  onChange={(e) => setShowMoves(e.target.checked)}
                />
                <span className="filter-text move">Moves</span>
              </label>
            )}
            {stats.formatChanges > 0 && (
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showFormatChanges}
                  onChange={(e) => setShowFormatChanges(e.target.checked)}
                />
                <span className="filter-text format-change">Format Changes</span>
              </label>
            )}
            {filteredRevisions && (
              <span className="filter-count">
                Showing {filteredRevisions.length} of {revisions.length}
              </span>
            )}
          </div>

          <div className="revisions-list">
            {filteredRevisions?.map((rev, index) => {
              const typeClass = getRevisionTypeClass(rev);
              const movePairInfo = getMovePairInfo(rev);
              const formatInfo = formatChangeDescription(rev);
              return (
                <div
                  key={index}
                  className={`revision-item ${typeClass}`}
                >
                  <div className="revision-header">
                    <span className={`revision-type ${typeClass}`}>
                      {getRevisionTypeLabel(rev)}
                    </span>
                    {isMove(rev) && rev.moveGroupId !== undefined && (
                      <span className="move-group-badge">
                        Group #{rev.moveGroupId}
                      </span>
                    )}
                    <span className="revision-author">{rev.author}</span>
                    <span className="revision-date">{formatDate(rev.date)}</span>
                  </div>
                  <div className="revision-text">
                    {rev.text || <em>(empty)</em>}
                  </div>
                  {movePairInfo && (
                    <div className="move-pair-info">
                      {movePairInfo}
                    </div>
                  )}
                  {formatInfo && (
                    <div className="format-change-info">
                      {formatInfo}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
