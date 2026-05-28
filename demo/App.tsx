import { useState } from 'react';
import { DocumentViewer, type ToolbarAction } from '../src';
import { DocumentComparer } from './components/DocumentComparer';
import { AnnotationViewer } from './components/AnnotationViewer';
import '../src/styles/DocumentViewer.css';
import './App.css';

// WASM base path - relative to deployed URL base
const WASM_BASE_PATH = import.meta.env.BASE_URL + 'wasm/';

type Tab = 'viewer' | 'compare' | 'annotations';

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TicketIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" />
    <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
  </svg>
);

const PrintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('viewer');

  const toolbarActions: ToolbarAction[] = [
    {
      key: 'download',
      icon: <DownloadIcon />,
      label: 'Download',
      variant: 'primary',
      onClick: () => alert('Download clicked'),
    },
    {
      key: 'print',
      icon: <PrintIcon />,
      label: 'Print',
      onClick: () => window.print(),
    },
    {
      key: 'ticket',
      icon: <TicketIcon />,
      label: 'Open Ticket',
      onClick: () => alert('Open Ticket clicked'),
    },
  ];

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
            defaultZoom={0.8}
            toolbarActions={toolbarActions}
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
