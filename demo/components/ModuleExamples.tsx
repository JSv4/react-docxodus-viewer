import { useEffect, useRef, useState } from 'react';
import { DocumentViewer } from '../../src/viewer';
import { DocumentEditor, EditorToolbar, ParagraphEditor, useDocxSession, useDocumentEditor } from '../../src/editor';
import type { DocumentEditorHandle, ParagraphEditorHandle } from '../../src/editor';
import { Icon } from '../../src/components/Icon';
import './ModuleExamples.css';

const wasmBasePath = `${import.meta.env.BASE_URL}wasm/`;
type Mode = 'viewer' | 'editor' | 'composed';
export default function ModuleExamples() {
  const [mode, setMode] = useState<Mode>('editor');
  const [filename, setFilename] = useState('Launch brief.docx');
  const [error, setError] = useState('');
  const [changes, setChanges] = useState(0);
  const document = useDocxSession(undefined, { wasmBasePath, settings: { emitMarkdownPatch: false } });
  const editor = useDocumentEditor(document.controller);
  const paragraph = useRef<ParagraphEditorHandle>(null);
  const block = useRef<DocumentEditorHandle>(null);
  const commit = () => (block.current?.commit() ?? true) && editor.canvasEditor.commit() && (paragraph.current?.commit() ?? true);
  const input = useRef<HTMLInputElement>(null);
  const { open } = document;
  useEffect(() => {
    let current = true;
    void fetch(`${import.meta.env.BASE_URL}sample.docx`).then(async response => {
      if (!response.ok) throw new Error('The sample could not be loaded. Open a DOCX file to explore the modules.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (current) await open(bytes);
    }).catch(cause => { if (current) setError(String(cause)); });
    return () => { current = false; };
  }, [open]);
  return <div className="module-demo"><header className="module-demo-header"><a href={import.meta.env.BASE_URL} className="module-demo-brand">d<span>.</span></a><span>THE BUILDING BLOCKS</span><a href={import.meta.env.BASE_URL}>Full studio<Icon name="arrow" size={15} /></a></header>
    <main><div className="module-demo-intro"><div><p>MADE TO FIT YOUR PRODUCT</p><h1>One engine.<br />Your interface.</h1></div><div><p>Use a clean viewer, drop in a complete editor, or compose the controls into your own layout.</p><button onClick={() => input.current?.click()}><Icon name="open" size={16} />Open your DOCX</button><input ref={input} type="file" accept=".docx" aria-label="Open module document" hidden onChange={event => { const file = event.target.files?.[0]; if (file && commit()) void open(file).then(() => { setFilename(file.name); setChanges(0); }).catch(cause => setError(String(cause))); event.target.value = ''; }} /></div></div>
      <nav className="module-demo-modes" aria-label="Module examples">{([{ id: 'viewer', title: 'Just the viewer', icon: 'document' }, { id: 'editor', title: 'The editor block', icon: 'edit' }, { id: 'composed', title: 'Compose your own', icon: 'code' }] as const).map(item => <button key={item.id} aria-pressed={mode === item.id} onClick={() => { if (commit()) setMode(item.id); }}><Icon name={item.icon} size={17} />{item.title}</button>)}</nav>
      <div className="module-demo-caption"><span>{mode === 'viewer' ? 'VIEWER MODULE' : mode === 'editor' ? 'EDITOR MODULE' : 'YOUR LAYOUT, SHARED SESSION'}</span><code>{mode === 'viewer' ? '<DocumentViewer />' : mode === 'editor' ? '<DocumentEditor />' : '<EditorToolbar /> + <DocumentViewer /> + <ParagraphEditor />'}</code></div>
      {error && <p role="alert">{error}</p>}
      {mode === 'viewer' && <DocumentViewer session={document.controller} wasmBasePath={wasmBasePath} allowRevisionResolution={false} theme="studio" fitMode="page-width" showUploadButton={false} style={{ height: 720, maxHeight: 'none' }} />}
      {mode === 'editor' && <DocumentEditor ref={block} session={document.controller} filename={filename} wasmBasePath={wasmBasePath} onChange={() => setChanges(count => count + 1)} style={{ height: 800 }} />}
      {mode === 'composed' && <div className="module-composed"><EditorToolbar editor={editor} groups={['history', 'font', 'paragraph']} beforeAction={() => paragraph.current?.commit() ?? true} /><div className="module-composed-body"><DocumentViewer {...editor.viewerProps} onAnchorSelect={anchor => { if (paragraph.current?.commit() !== false) editor.selectAnchor(anchor); }} onTextSelectionChange={selection => { if (paragraph.current?.commit() !== false) editor.selectText(selection); }} wasmBasePath={wasmBasePath} theme="studio" rendererFingerprint="module-composed" showUploadButton={false} fitMode="page-width" defaultSettings={{ commentMode: 'disabled', annotationMode: 'disabled', showDeletedContent: false }} style={{ height: '100%', minHeight: 0, maxHeight: 'none' }} /><aside><div className="module-composed-note"><Icon name="code" size={21} /><h2>A layout that belongs to you.</h2><p>The toolbar, viewer, and text editor share one native session. You decide where each component lives.</p></div><ParagraphEditor ref={paragraph} editor={editor} />{editor.error && <p role="alert">{editor.error.message}</p>}</aside></div></div>}
      <footer className="module-demo-footer"><span>Same document across all three examples{changes ? ` · ${changes} editor changes` : ''}</span><span>React components. No application shell required.</span></footer>
    </main>
  </div>;
}
