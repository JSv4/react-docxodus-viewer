import { useState } from 'react';
import { AnnotationsPanel, CommentsPanel, DocxodusProvider, DocumentViewer, ExportPanel, HistoryPanel, SessionEditorPanel, VerificationPanel, downloadDocument, useDocxSession, useDocumentHistory, useSessionQuery } from '../src';
import type { DocxSession, PageCitation } from '../src';
import { DocumentComparer } from './components/DocumentComparer';
import { AnnotationViewer } from './components/AnnotationViewer';
import '../src/styles/DocumentViewer.css';
import './App.css';

const WASM_BASE_PATH = import.meta.env.BASE_URL + 'wasm/';
const snapshotBytes = (session: DocxSession) => session.save();
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function Workspace() {
  const [tab, setTab] = useState('document');
  const [panel, setPanel] = useState('edit');
  const [anchor, setAnchor] = useState<string>();
  const [citation, setCitation] = useState<PageCitation>();
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useDocxSession();
  const bytes = useSessionQuery(session.controller, snapshotBytes).data;
  const history = useDocumentHistory({ documentId: 'demo-document', indexedDbName: 'react-docxodus-viewer-demo' });
  const showAnchor = (id: string) => {
    setAnchor(id);
    if (session.session) setCitation(session.session.getPageCitation(id, { documentVersion: session.version, rendererFingerprint: 'react-demo-v12.4.1' }));
  };
  const open = async (input: File | Uint8Array | 'blank') => {
    try { setError(null); await session.open(input); setAnchor(undefined); setCitation(undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <div className="app"><header className="app-header"><h1>React Docxodus</h1><p className="subtitle">View, edit, review and export Word documents · Engine 12.4.1</p></header>
    <nav className="tab-nav" aria-label="Workspace">{[['document', 'Document workspace'], ['compare', 'Compare documents'], ['external', 'External annotations']].map(([id, title]) => <button type="button" key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{title}</button>)}</nav>
    <main className="app-main"><div hidden={tab !== 'document'}>
      <div className="workspace-actions"><label className="workspace-open">Open DOCX<input aria-label="Open workspace document" type="file" accept=".docx" onChange={event => { const file = event.target.files?.[0]; if (file) void open(file); event.target.value = ''; }} /></label><button type="button" disabled={session.isLoading} onClick={() => void open('blank')}>New document</button><button type="button" disabled={!bytes} onClick={() => bytes && downloadDocument(bytes, 'document.docx', docxMime)}>Download DOCX</button><span role="status">{session.isLoading ? 'Opening document…' : session.session ? `Document version ${session.version}` : 'Open a file or create a document'}</span></div>
      {(error || session.error) && <p role="alert">{error ?? session.error?.message}</p>}
      <div className="workspace-layout"><div className="workspace-document"><DocumentViewer session={session.controller} rendererFingerprint="react-demo-v12.4.1" citation={citation} onAnchorSelect={setAnchor} showUploadButton={false} fitMode="page-width" defaultSettings={{ renderTrackedChanges: true, commentMode: 'margin', annotationMode: 'above' }} /></div>
      <aside className="workspace-sidebar"><nav className="workspace-panel-tabs" aria-label="Document tools">{['edit', 'comments', 'annotations', 'history', 'verify', 'export'].map(id => <button type="button" key={id} aria-pressed={panel === id} onClick={() => setPanel(id)}>{id}</button>)}</nav>
        {panel === 'edit' && <SessionEditorPanel session={session.controller} anchorId={anchor} onAnchorSelect={showAnchor} />}
        {panel === 'comments' && <CommentsPanel session={session.controller} anchorId={anchor} onSelect={showAnchor} />}
        {panel === 'annotations' && <AnnotationsPanel session={session.controller} anchorId={anchor} onSelect={showAnchor} />}
        {panel === 'history' && <HistoryPanel history={history} getDocument={session.session ? () => session.controller.save() : undefined} onPreview={setPreview} onRestore={async document => { await open(document); }} />}
        {panel === 'verify' && <VerificationPanel document={bytes} baseline={session.controller.originalBytes ?? undefined} />}
        {panel === 'export' && <ExportPanel document={bytes} options={{ documentVersion: session.version }} />}
      </aside></div>
      {preview && <section className="history-preview"><h2>Checkpoint preview</h2><button type="button" onClick={() => setPreview(null)}>Close preview</button><DocumentViewer document={preview} showUploadButton={false} /></section>}
    </div>{tab === 'compare' && <DocumentComparer />}{tab === 'external' && <AnnotationViewer />}</main>
    <footer className="app-footer">React components over the Docxodus engine. The demo stores history in this browser.</footer>
  </div>;
}
function App() { return <DocxodusProvider wasmBasePath={WASM_BASE_PATH}><Workspace /></DocxodusProvider>; }
export default App;
