import { useState, useCallback } from 'react';
import { useDocxodus, AnnotationLabelMode } from 'docxodus/react';
import type { Annotation, AddAnnotationRequest } from 'docxodus/react';
import { WASM_BASE_PATH } from '../config';

export function AnnotationViewer() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [html, setHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    isReady,
    isLoading: isInitializing,
    convertToHtml,
    getAnnotations,
    addAnnotation,
    removeAnnotation,
  } = useDocxodus(WASM_BASE_PATH);

  // New annotation form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Partial<AddAnnotationRequest>>({
    id: '',
    labelId: '',
    label: '',
    color: '#FFEB3B',
    searchText: '',
    occurrence: 1,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadDocument = useCallback(async (docFile: File) => {
    if (!isReady) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get annotations first
      const annots = await getAnnotations(docFile);
      setAnnotations(annots);

      // Convert to HTML with annotations rendered
      const htmlResult = await convertToHtml(docFile, {
        renderAnnotations: true,
        annotationLabelMode: AnnotationLabelMode.Above,
      });
      setHtml(htmlResult);

      // Store original bytes for modification
      const bytes = new Uint8Array(await docFile.arrayBuffer());
      setDocumentBytes(bytes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load document'));
    } finally {
      setIsLoading(false);
    }
  }, [isReady, getAnnotations, convertToHtml]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setShowAddForm(false);
      setAddError(null);
      await loadDocument(selectedFile);
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileName('');
    setDocumentBytes(null);
    setAnnotations([]);
    setHtml(null);
    setShowAddForm(false);
    setAddError(null);
    setError(null);
    const input = document.getElementById('annotation-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.label || !newAnnotation.searchText) {
      setAddError('Label and search text are required');
      return;
    }

    if (!documentBytes) {
      setAddError('No document loaded');
      return;
    }

    setIsAdding(true);
    setAddError(null);

    try {
      const request: AddAnnotationRequest = {
        id: newAnnotation.id || `annot-${Date.now()}`,
        labelId: newAnnotation.labelId || newAnnotation.label?.toLowerCase().replace(/\s+/g, '_') || '',
        label: newAnnotation.label || '',
        color: newAnnotation.color,
        searchText: newAnnotation.searchText,
        occurrence: newAnnotation.occurrence || 1,
      };

      const result = await addAnnotation(documentBytes, request);
      if (result?.success && result.documentBytes) {
        // Decode base64 to Uint8Array
        const binaryString = atob(result.documentBytes);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        setDocumentBytes(bytes);

        // Refresh annotations and HTML
        const annots = await getAnnotations(bytes);
        setAnnotations(annots);

        const htmlResult = await convertToHtml(bytes, {
          renderAnnotations: true,
          annotationLabelMode: AnnotationLabelMode.Above,
        });
        setHtml(htmlResult);

        setNewAnnotation({
          id: '',
          labelId: '',
          label: '',
          color: '#FFEB3B',
          searchText: '',
          occurrence: 1,
        });
        setShowAddForm(false);
      } else {
        setAddError('Failed to add annotation');
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add annotation');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAnnotation = async (annotationId: string) => {
    if (!documentBytes) return;

    try {
      const result = await removeAnnotation(documentBytes, annotationId);
      if (result?.success && result.documentBytes) {
        // Decode base64 to Uint8Array
        const binaryString = atob(result.documentBytes);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        setDocumentBytes(bytes);

        // Refresh annotations and HTML
        const annots = await getAnnotations(bytes);
        setAnnotations(annots);

        const htmlResult = await convertToHtml(bytes, {
          renderAnnotations: true,
          annotationLabelMode: AnnotationLabelMode.Above,
        });
        setHtml(htmlResult);
      }
    } catch (err) {
      console.error('Failed to remove annotation:', err);
    }
  };

  const handleDownload = () => {
    if (!documentBytes) return;
    const blob = new Blob([documentBytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.docx', '-annotated.docx');
    a.click();
    URL.revokeObjectURL(url);
  };

  const isProcessing = isLoading || isInitializing;

  return (
    <div className="annotation-viewer">
      <div className="upload-section">
        <label htmlFor="annotation-input" className="file-label">
          <span className="file-icon">🏷️</span>
          {fileName || 'Choose a DOCX file'}
        </label>
        <input
          id="annotation-input"
          type="file"
          accept=".docx"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        {file && (
          <button onClick={handleClear} className="clear-btn" disabled={isProcessing}>
            Clear
          </button>
        )}
      </div>

      <p className="helper-text">
        Upload a document to view and manage annotations. Annotations are custom highlights
        with labels that can mark important sections of text.
      </p>

      {isProcessing && (
        <div className="loading loading-processing">
          <div className="spinner"></div>
          <p>{isInitializing ? 'Initializing...' : 'Loading document...'}</p>
        </div>
      )}

      {error && !isProcessing && (
        <div className="error">
          <p>Error: {error.message}</p>
        </div>
      )}

      {file && !isProcessing && !error && (
        <>
          {/* Annotations Summary */}
          <div className="annotations-summary">
            <div className="summary-header">
              <h3>Annotations ({annotations.length})</h3>
              <div className="summary-actions">
                {!showAddForm && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="compare-btn"
                  >
                    Add Annotation
                  </button>
                )}
                {documentBytes && annotations.length > 0 && (
                  <button onClick={handleDownload} className="download-btn">
                    Download Annotated
                  </button>
                )}
              </div>
            </div>

            {/* Add Annotation Form */}
            {showAddForm && (
              <div className="add-annotation-form">
                <h4>Add New Annotation</h4>

                <div className="form-group">
                  <label htmlFor="annot-label">Label *</label>
                  <input
                    id="annot-label"
                    type="text"
                    value={newAnnotation.label || ''}
                    onChange={(e) =>
                      setNewAnnotation({ ...newAnnotation, label: e.target.value })
                    }
                    placeholder="e.g., Important Clause"
                    className="text-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="annot-search">Search Text *</label>
                  <input
                    id="annot-search"
                    type="text"
                    value={newAnnotation.searchText || ''}
                    onChange={(e) =>
                      setNewAnnotation({ ...newAnnotation, searchText: e.target.value })
                    }
                    placeholder="Text to highlight"
                    className="text-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="annot-color">Color</label>
                    <input
                      id="annot-color"
                      type="color"
                      value={newAnnotation.color || '#FFEB3B'}
                      onChange={(e) =>
                        setNewAnnotation({ ...newAnnotation, color: e.target.value })
                      }
                      className="color-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="annot-occurrence">Occurrence</label>
                    <input
                      id="annot-occurrence"
                      type="number"
                      min="1"
                      value={newAnnotation.occurrence || 1}
                      onChange={(e) =>
                        setNewAnnotation({
                          ...newAnnotation,
                          occurrence: parseInt(e.target.value) || 1,
                        })
                      }
                      className="text-input number-input"
                    />
                  </div>
                </div>

                {addError && (
                  <div className="form-error">
                    <p>{addError}</p>
                  </div>
                )}

                <div className="form-actions">
                  <button
                    onClick={handleAddAnnotation}
                    disabled={isAdding}
                    className="compare-btn"
                  >
                    {isAdding ? 'Adding...' : 'Add Annotation'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddError(null);
                    }}
                    className="clear-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Annotations List */}
            {annotations.length === 0 && !showAddForm ? (
              <div className="no-annotations">
                <p>No annotations found in this document.</p>
              </div>
            ) : (
              <div className="annotations-list">
                {annotations.map((annot) => (
                  <div
                    key={annot.id}
                    className="annotation-item"
                    style={{ borderLeftColor: annot.color }}
                  >
                    <div className="annotation-header">
                      <span
                        className="annotation-label"
                        style={{ backgroundColor: annot.color }}
                      >
                        {annot.label}
                      </span>
                      <span className="annotation-id">{annot.id}</span>
                      <button
                        onClick={() => handleRemoveAnnotation(annot.id)}
                        className="remove-btn"
                        title="Remove annotation"
                      >
                        ×
                      </button>
                    </div>
                    {annot.annotatedText && (
                      <div className="annotation-text">
                        "{annot.annotatedText}"
                      </div>
                    )}
                    {annot.author && (
                      <div className="annotation-meta">
                        By {annot.author}
                        {annot.created && ` on ${new Date(annot.created).toLocaleDateString()}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Preview */}
          {html && (
            <div className="annotation-preview">
              <h3>Document Preview</h3>
              <div
                className="preview-content document-preview"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
