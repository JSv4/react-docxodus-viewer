import { useState } from 'react';
import { useConversion } from 'docxodus/react';
import { CommentRenderMode } from 'docxodus';
import { WASM_BASE_PATH } from '../config';

type CommentMode = 'disabled' | 'endnote' | 'inline' | 'margin';

export function DocumentViewer() {
  const { html, isConverting, error, convert, clear } = useConversion(WASM_BASE_PATH);
  const [fileName, setFileName] = useState<string>('');
  const [commentMode, setCommentMode] = useState<CommentMode>('disabled');
  const [renderTrackedChanges, setRenderTrackedChanges] = useState(true);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const getCommentRenderMode = (mode: CommentMode): CommentRenderMode => {
    switch (mode) {
      case 'endnote': return CommentRenderMode.EndnoteStyle;
      case 'inline': return CommentRenderMode.Inline;
      case 'margin': return CommentRenderMode.Margin;
      default: return CommentRenderMode.Disabled;
    }
  };

  const getConvertOptions = (comment: CommentMode, tracked: boolean) => ({
    commentRenderMode: getCommentRenderMode(comment),
    renderTrackedChanges: tracked,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPendingFile(file);
      await convert(file, getConvertOptions(commentMode, renderTrackedChanges));
    }
  };

  const handleCommentModeChange = async (mode: CommentMode) => {
    setCommentMode(mode);
    if (pendingFile) {
      await convert(pendingFile, getConvertOptions(mode, renderTrackedChanges));
    }
  };

  const handleTrackedChangesToggle = async (enabled: boolean) => {
    setRenderTrackedChanges(enabled);
    if (pendingFile) {
      await convert(pendingFile, getConvertOptions(commentMode, enabled));
    }
  };

  const handleClear = () => {
    clear();
    setFileName('');
    setPendingFile(null);
    const input = document.getElementById('docx-input') as HTMLInputElement;
    if (input) input.value = '';
  };

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
          disabled={isConverting}
        />
        {html && (
          <button onClick={handleClear} className="clear-btn">
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
                disabled={isConverting}
              />
              <span>Disabled</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'endnote'}
                onChange={() => handleCommentModeChange('endnote')}
                disabled={isConverting}
              />
              <span>Endnotes</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'inline'}
                onChange={() => handleCommentModeChange('inline')}
                disabled={isConverting}
              />
              <span>Inline</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="commentMode"
                checked={commentMode === 'margin'}
                onChange={() => handleCommentModeChange('margin')}
                disabled={isConverting}
              />
              <span>Margin</span>
            </label>
          </div>
        </div>

        <div className="option-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={renderTrackedChanges}
              onChange={(e) => handleTrackedChangesToggle(e.target.checked)}
              disabled={isConverting}
            />
            <span>Render tracked changes</span>
          </label>
        </div>
      </div>

      {isConverting && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Converting document...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {html && (
        <div className="document-content">
          <div
            className="html-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}
