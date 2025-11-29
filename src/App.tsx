import { useState } from 'react';
import { DocumentViewer } from './components/DocumentViewer';
import { DocumentComparer } from './components/DocumentComparer';
import { RevisionViewer } from './components/RevisionViewer';
import './App.css';

type Tab = 'viewer' | 'compare' | 'revisions';

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
          className={`tab-btn ${activeTab === 'revisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('revisions')}
        >
          Extract Revisions
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'viewer' && <DocumentViewer />}
        {activeTab === 'compare' && <DocumentComparer />}
        {activeTab === 'revisions' && <RevisionViewer />}
      </main>

      <footer className="app-footer">
        <p>Powered by Docxodus - 100% client-side document processing</p>
      </footer>
    </div>
  );
}

export default App;
