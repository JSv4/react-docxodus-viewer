import { useState } from 'react';
import { DocumentViewer } from '../src';
import { DocumentComparer } from './components/DocumentComparer';
import { AnnotationViewer } from './components/AnnotationViewer';
import '../src/styles/DocumentViewer.css';
import './App.css';

// WASM base path - relative to deployed URL base
const WASM_BASE_PATH = import.meta.env.BASE_URL + 'wasm/';

type Tab = 'viewer' | 'compare' | 'annotations';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('viewer');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Docxodus</h1>
        <p className="subtitle">DOCX Viewer & Comparison Tool</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
        >
          View Document
        </button>
        <button
          className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          Compare Documents
        </button>
        <button
          className={`tab-btn ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          Annotations
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'viewer' && (
          <DocumentViewer
            wasmBasePath={WASM_BASE_PATH}
            onError={(err) => console.error('Viewer error:', err)}
            onPageChange={(page, total) => console.log(`Page ${page}/${total}`)}
          />
        )}
        {activeTab === 'compare' && <DocumentComparer />}
        {activeTab === 'annotations' && <AnnotationViewer />}
      </main>

      <footer className="app-footer">
        <p>Powered by <a href="https://www.npmjs.com/package/docxodus" target="_blank" rel="noopener noreferrer">Docxodus</a> - 100% client-side document processing</p>
      </footer>
    </div>
  );
}

export default App;
