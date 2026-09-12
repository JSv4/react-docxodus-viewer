import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnnotationsPanel, CommentsPanel, DocxodusProvider, DocumentViewer, ExportPanel, HistoryPanel, SessionEditorPanel, VerificationPanel, downloadDocument, useDocxSession, useDocumentHistory, useSessionQuery } from '../src';
import type { DocxSession, PageCitation } from '../src';
import { Icon } from '../src/components/Icon';
import type { IconName } from '../src/components/Icon';
import { DocumentComparer } from './components/DocumentComparer';
import { AnnotationViewer } from './components/AnnotationViewer';
import { CommandMenu } from './components/CommandMenu';
import type { Command } from './components/CommandMenu';
import { DocumentNavigator } from './components/DocumentNavigator';
import { ReviewInspector } from './components/ReviewInspector';
import '../src/styles/DocumentViewer.css';
import './App.css';

const WASM_BASE_PATH = import.meta.env.BASE_URL + 'wasm/';
const FINGERPRINT = 'react-studio-v12.4.1';
const snapshotBytes = (session: DocxSession) => session.save();
const documentCounts = (session: DocxSession) => ({ comments: session.listComments().length, revisions: session.listRevisions().length });
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
type Panel = 'edit' | 'review' | 'comments' | 'annotations' | 'history' | 'verify' | 'export';
const tabs: { id: Panel; label: string; icon: IconName; hint: string }[] = [
  { id: 'edit', label: 'Edit', icon: 'edit', hint: 'Formatting, structure and tracked edits' },
  { id: 'review', label: 'Review', icon: 'review', hint: 'Redlines and changes beyond the text' },
  { id: 'comments', label: 'Comments', icon: 'comment', hint: 'Keep the conversation attached to the document' },
  { id: 'history', label: 'History', icon: 'history', hint: 'Save, compare and restore checkpoints' },
];

function Workspace() {
  const [tab, setTab] = useState('document');
  const [panel, setPanel] = useState<Panel>('edit');
  const [anchor, setAnchor] = useState<string>();
  const [quickActions, setQuickActions] = useState(true);
  const [citation, setCitation] = useState<PageCitation>();
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('Untitled document.docx');
  const [documentId, setDocumentId] = useState(() => crypto.randomUUID() as string);
  const [focused, setFocused] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const openSequence = useRef(0);
  const session = useDocxSession();
  const { controller, open: openSession } = session;
  const bytes = useSessionQuery(controller, snapshotBytes).data;
  const counts = useSessionQuery(controller, documentCounts).data;
  const history = useDocumentHistory({ documentId, indexedDbName: 'react-docxodus-viewer-studio' });
  const busy = session.isLoading || sampleLoading;
  const ready = !!session.session;

  const showPanel = useCallback((next: Panel) => { setPanel(next); setFocused(false); setTab('document'); }, []);
  const showAnchor = useCallback((id: string) => {
    setAnchor(id); setQuickActions(true);
    try {
      const current = controller.getSnapshot();
      if (current.session) {
        const next = current.session.getPageCitation(id, { documentVersion: current.version, rendererFingerprint: FINGERPRINT });
        if (next.availability === 'available') { setCitation(next); setError(null); }
        else setError('This location is not available in the current page layout. Wait for pagination to finish and try again.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [controller]);
  const open = useCallback(async (source: File | Uint8Array | 'blank', name?: string, restore = false) => {
    const sequence = ++openSequence.current;
    try {
      setError(null);
      await openSession(source);
      if (sequence !== openSequence.current) return;
      if (!restore) {
        setFilename(name ?? (source instanceof File ? source.name : 'Untitled document.docx'));
        setDocumentId(source instanceof File ? `${source.name}:${source.size}:${source.lastModified}` : crypto.randomUUID());
        setPanel('edit'); setPreview(null);
      }
      setAnchor(undefined); setCitation(undefined); setPage(1); setPages(0); setTab('document');
    } catch (cause) { if (sequence === openSequence.current) setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [openSession]);
  const download = useCallback(() => { if (controller.getSnapshot().session) downloadDocument(controller.save(), filename, docxMime); }, [controller, filename]);
  const openFile = useCallback(() => input.current?.click(), []);
  const create = useCallback(() => { void open('blank'); }, [open]);
  const find = useCallback(() => { setTab('document'); setNavigating(true); setFocused(false); }, []);
  const loadSample = async () => {
    setSampleLoading(true); setError(null);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample.docx`);
      if (!response.ok) throw new Error('The sample could not be loaded. You can still open your own DOCX file.');
      await open(new Uint8Array(await response.arrayBuffer()), 'Launch brief.docx');
      setPanel('review');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSampleLoading(false); }
  };
  const commands = useMemo<Command[]>(() => [
    { id: 'open', label: 'Open a document', hint: 'Bring a Word document into your workspace', icon: 'open', run: openFile, shortcut: '⌘ O', disabled: busy },
    { id: 'new', label: 'New document', hint: 'Start with a blank page', icon: 'plus', run: create, disabled: busy },
    { id: 'find', label: 'Find in document', hint: 'Search text and jump to its page', icon: 'search', run: find, shortcut: '⌘ F', disabled: !ready },
    ...tabs.map(item => ({ id: item.id, label: item.label === 'Edit' ? 'Edit a paragraph' : item.label === 'Review' ? 'Review changes' : item.label, hint: item.hint, icon: item.icon, run: () => showPanel(item.id), disabled: !ready })),
    { id: 'annotations', label: 'Label selected text', hint: 'Add structured annotations', icon: 'label', run: () => showPanel('annotations'), disabled: !ready },
    { id: 'verify', label: 'Verify the document', hint: 'Inspect package integrity and deliverable findings', icon: 'shield', run: () => showPanel('verify'), disabled: !ready },
    { id: 'export', label: 'Export options', hint: 'Create a standalone, paginated HTML document', icon: 'download', run: () => showPanel('export'), disabled: !ready },
    { id: 'download', label: 'Download DOCX', hint: 'Keep a Word copy of your current document', icon: 'document', run: download, shortcut: '⌘ S', disabled: !ready },
    { id: 'focus', label: focused ? 'Leave focus mode' : 'Enter focus mode', hint: 'Give the document room to breathe', icon: 'focus', run: () => { setFocused(value => !value); setNavigating(false); }, disabled: !ready },
    { id: 'compare', label: 'Compare documents', hint: 'Compare drafts or consolidate multiple reviewers', icon: 'compare', run: () => setTab('compare') },
  ], [openFile, create, find, showPanel, download, busy, ready, focused]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value); return; }
      const id = ({ o: 'open', f: 'find', s: 'download' } as Record<string, string>)[event.key.toLowerCase()];
      const command = commands.find(item => item.id === id);
      if (command && !command.disabled && !document.querySelector('dialog[open]')) { event.preventDefault(); command.run(); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [commands]);
  useEffect(() => {
    if (!preview) return;
    const dialog = previewDialog.current!;
    dialog.showModal();
    return () => dialog.close();
  }, [preview]);

  return <div className={`app ${focused ? 'is-focused' : ''}`} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => {
    event.preventDefault(); setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) { if (/\.docx$/i.test(file.name)) void open(file); else setError('Choose a .docx document to open in the workspace.'); }
  }}>
    <nav className="studio-rail" aria-label="Workspace"><a className="studio-mark" href="#" aria-label="Docxodus workspace" onClick={event => { event.preventDefault(); setTab('document'); }}>d<span>.</span></a>
      <div className="rail-navigation">{[{ id: 'document', icon: 'document', label: 'Document workspace', short: 'Document' }, { id: 'compare', icon: 'compare', label: 'Compare documents', short: 'Compare' }, { id: 'external', icon: 'label', label: 'External annotations', short: 'Labels' }].map(item => <button type="button" className={`rail-button ${tab === item.id ? 'active' : ''}`} aria-label={item.label} aria-pressed={tab === item.id} title={item.label} key={item.id} onClick={() => setTab(item.id)}><Icon name={item.icon as IconName} size={21} /><span>{item.short}</span></button>)}</div>
      <div className="rail-bottom"><a className="rail-button" href="?example=modules" target="_blank" rel="noreferrer" aria-label="Explore embeddable modules" title="Embeddable viewer and editor"><Icon name="code" /><span>Modules</span></a><button className="rail-button" aria-label="Open command menu" title="Commands · Ctrl / ⌘ K" onClick={() => setCommandOpen(true)}><Icon name="command" /><span>Commands</span></button><span className="engine-version" title="Powered by Docxodus 12.4.1">12.4.1</span></div>
    </nav>
    <div className="studio-main"><header className="studio-header"><div className="document-identity"><span className="document-glyph"><Icon name={tab === 'compare' ? 'compare' : tab === 'external' ? 'label' : 'document'} size={20} /></span><div><p className="breadcrumb">DOCXODUS <span>/</span> {tab === 'document' ? 'WORKSPACE' : tab === 'compare' ? 'COMPARE' : 'ANNOTATIONS'}</p><h1>{tab === 'document' ? (ready ? filename.replace(/\.docx$/i, '') : 'A little space to think.') : tab === 'compare' ? 'Every difference, in context.' : 'Give your document meaning.'}</h1></div></div>
      <div className="header-actions"><button className="command-trigger" aria-label="Search workspace commands" onClick={() => setCommandOpen(true)}><Icon name="search" size={15} /><span>Search commands</span><kbd>⌘ K</kbd></button><span className="header-divider" /><button className="icon-button" aria-label="New document" title="New document" disabled={busy} onClick={create}><Icon name="plus" size={20} /></button><button className="quiet-button open-button" disabled={busy} onClick={openFile}><Icon name="open" size={17} />Open DOCX</button><button className="icon-button" aria-label="Download DOCX" title="Download DOCX" disabled={!ready || busy} onClick={download}><Icon name="download" /></button><button className="primary-button" aria-label="export" disabled={!ready || busy} onClick={() => showPanel('export')}>Export<Icon name="arrow" size={16} /></button></div>
      <input ref={input} className="visually-hidden" aria-label="Open workspace document" type="file" accept=".docx" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void open(file); event.target.value = ''; }} />
    </header>
    {error && <div className="workspace-error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setError(null)}><Icon name="close" size={16} /></button></div>}
    <main className="studio-content">
      <div className="document-workspace" hidden={tab !== 'document'}>
        {!ready && !busy ? <section className="welcome"><div className="welcome-copy"><p className="eyebrow">A NEW PERSPECTIVE ON DOCUMENTS</p><h2>Your document.<br />A clearer view.</h2><p className="welcome-description">A place to shape ideas, follow every change, and move a document forward.</p><div className="welcome-actions"><button className="primary-button" onClick={openFile}><Icon name="open" />Choose a DOCX file<Icon name="arrow" size={17} /></button><button className="quiet-button" onClick={create}>Start a blank document</button></div><p className="drop-hint">Or drop a Word document anywhere.</p><div className="welcome-privacy"><Icon name="lock" size={16} /><span>Your documents are processed in your browser.</span></div></div>
          <button className="sample-preview" onClick={() => void loadSample()} aria-label="Explore a sample document"><span className="sample-paper"><span className="sample-kicker">STUDIO NOTES <span>NO. 001</span></span><span className="sample-title">Good work<br />takes shape.</span><span className="sample-rule" /><span className="sample-paragraph">A launch brief. A new perspective.<br />A few changes worth a closer look.</span><span className="sample-lines"><i /><i /><i /></span><span className="sample-redline"><del>Another draft.</del><ins>A shared direction.</ins></span><span className="sample-paper-footer">THE LAUNCH BRIEF <span>01</span></span></span><span className="sample-note"><span className="sample-avatar">M</span><span><strong>One thought…</strong><small>Let's make the next step clear.</small></span></span><span className="sample-cta">Explore a sample document <Icon name="arrow" size={17} /></span></button>
          <div className="welcome-capabilities">{[['review', 'A better review', 'Track the words, structure and details.'], ['history', 'Room to explore', 'Checkpoint a draft. Try a change. Go back.'], ['shield', 'A confident handoff', 'Inspect the document before you export.']].map(([icon, title, detail]) => <div key={title}><Icon name={icon as IconName} size={20} /><strong>{title}</strong><p>{detail}</p></div>)}</div>
        </section> : <><div className="document-actionbar"><div className="actionbar-left"><button className={`quiet-button ${navigating ? 'is-active' : ''}`} aria-label="Find in document" aria-pressed={navigating} disabled={!ready} onClick={() => { setNavigating(value => !value); setFocused(false); }}><Icon name="search" size={16} /><span>Find</span></button><span className="header-divider" /><span className="document-state" role="status"><i className={busy ? 'is-busy' : ''} />{busy ? 'Opening your document…' : session.version > 0 ? 'Edited in this session' : 'Local document'}</span></div><div className="actionbar-right"><span className="selection-hint">{anchor ? 'Paragraph selected · ready to edit' : 'Click any paragraph to work with it'}</span><button className={`quiet-button ${focused ? 'is-active' : ''}`} aria-label="Focus mode" aria-pressed={focused} onClick={() => { setFocused(value => !value); setNavigating(false); }}><Icon name="focus" size={16} /><span>{focused ? 'Exit focus' : 'Focus'}</span></button></div></div>
          <div className={`workspace-layout ${navigating ? 'with-navigator' : ''}`}>
            {navigating && !focused && <DocumentNavigator session={controller} onSelect={showAnchor} onClose={() => setNavigating(false)} />}
            <div className="workspace-document"><DocumentViewer session={controller} rendererFingerprint={FINGERPRINT} citation={citation} selectedAnchorId={focused ? undefined : anchor} onAnchorSelect={id => { setAnchor(id); setQuickActions(true); }} onError={cause => setError(cause.message)} onPageChange={(next, total) => { setPage(next); setPages(total); }} onPaginationComplete={result => setPages(result.totalPages)} showUploadButton={false} showRevisionsTab={false} fitMode="page-width" defaultSettings={{ renderTrackedChanges: true, commentMode: 'inline', annotationMode: 'above' }} />
              {anchor && quickActions && !focused && <div className="selection-actions" role="toolbar" aria-label="Selected paragraph"><span className="selection-dot" /><button onClick={() => showPanel('edit')}><Icon name="edit" size={14} />Edit paragraph</button><button onClick={() => showPanel('comments')}><Icon name="comment" size={14} />Comment</button><button onClick={() => showPanel('annotations')}><Icon name="label" size={14} />Label</button><button className="selection-dismiss" aria-label="Dismiss quick actions" onClick={() => setQuickActions(false)}><Icon name="close" size={13} /></button></div>}
            </div>
            <aside className="workspace-sidebar" hidden={focused}><nav className="inspector-tabs" aria-label="Document tools">{tabs.map(item => <button type="button" key={item.id} aria-label={item.id} aria-pressed={panel === item.id} onClick={() => showPanel(item.id)}><Icon name={item.icon} size={16} /><span>{item.label}</span>{item.id === 'review' && !!counts?.revisions && <b>{counts.revisions}</b>}{item.id === 'comments' && !!counts?.comments && <b>{counts.comments}</b>}</button>)}</nav>
              <div className="inspector-body" key={documentId}>
                {panel === 'edit' && <SessionEditorPanel session={controller} anchorId={anchor} onAnchorSelect={showAnchor} />}
                {panel === 'review' && <ReviewInspector session={controller} onSelect={showAnchor} />}
                {panel === 'comments' && <CommentsPanel session={controller} anchorId={anchor} onSelect={showAnchor} />}
                {panel === 'annotations' && <AnnotationsPanel session={controller} anchorId={anchor} onSelect={showAnchor} />}
                {panel === 'history' && <HistoryPanel history={history} getDocument={ready ? () => controller.save() : undefined} onPreview={setPreview} onRestore={async document => { await open(document, undefined, true); }} />}
                {panel === 'verify' && <VerificationPanel document={bytes} baseline={controller.originalBytes ?? undefined} />}
                {panel === 'export' && <ExportPanel document={bytes} options={{ documentVersion: session.version }} filename={filename.replace(/\.docx$/i, '')} />}
              </div><footer className="inspector-footer"><button aria-label="annotations" aria-pressed={panel === 'annotations'} onClick={() => showPanel('annotations')}><Icon name="label" size={15} />Labels</button><button aria-label="verify" aria-pressed={panel === 'verify'} onClick={() => showPanel('verify')}><Icon name="shield" size={15} />Verify document</button><button className="icon-button" aria-label="Hide inspector" title="Hide inspector" onClick={() => setFocused(true)}><Icon name="panel" size={16} /></button></footer>
            </aside>
          </div><footer className="workspace-statusbar"><span><Icon name="lock" size={12} />In your browser</span><span>{pages ? `Page ${page} of ${pages}` : 'Preparing pages'}<i />{counts?.revisions ?? 0} tracked changes<i />{counts?.comments ?? 0} comments</span><span>Download a copy to keep your edits.</span></footer>
        </>}
      </div>
      {tab === 'compare' && <div className="tool-workspace"><div className="tool-introduction"><span className="eyebrow">FOLLOW THE DIFFERENCE</span><h2>Two drafts. The full story.</h2><p>Compare versions, bring reviewers together, and see changes to content and structure.</p></div><DocumentComparer /></div>}
      {tab === 'external' && <div className="tool-workspace"><div className="tool-introduction"><span className="eyebrow">A LAYER OF MEANING</span><h2>Make the important parts findable.</h2><p>Keep structured labels alongside your document and bring them into your next workflow.</p></div><AnnotationViewer /></div>}
    </main></div>
    {dragging && <div className="drop-overlay"><Icon name="document" size={40} /><h2>Drop your document here.</h2><p>We'll take it from here.</p></div>}
    {commandOpen && <CommandMenu commands={commands} onClose={() => setCommandOpen(false)} />}
    {preview && <dialog ref={previewDialog} className="checkpoint-dialog" aria-label="Checkpoint preview" onCancel={() => setPreview(null)}><header><div><span className="eyebrow">A MOMENT IN YOUR DOCUMENT</span><h2>Checkpoint preview</h2></div><button className="icon-button" aria-label="Close preview" onClick={() => setPreview(null)}><Icon name="close" /></button></header><DocumentViewer document={preview} showUploadButton={false} fitMode="page" /></dialog>}
  </div>;
}
export default function App() { return <DocxodusProvider wasmBasePath={WASM_BASE_PATH}><Workspace /></DocxodusProvider>; }
