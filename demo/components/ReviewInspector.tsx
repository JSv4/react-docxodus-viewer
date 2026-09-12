import { useCallback, useState } from 'react';
import { RevisionPanel, SemanticChangesPanel, useSessionQuery } from '../../src';
import type { DocxSession, DocxSessionController } from '../../src';
import { Icon } from '../../src/components/Icon';

const revisions = (document: DocxSession) => document.listRevisions();
export function ReviewInspector({ session, onSelect }: { session: DocxSessionController; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState('tracked');
  const native = useSessionQuery(session, revisions);
  const selectSemantics = useCallback((document: DocxSession) => mode === 'semantic' ? document.getSemanticChanges() : null, [mode]);
  const semantic = useSessionQuery(session, selectSemantics);
  return <section className="review-inspector" aria-label="Review document"><div className="inspector-title"><span className="eyebrow">SEE THE WHOLE CHANGE</span><h3>Review with context.</h3><p>Follow the redlines, or look deeper at what changed in the document.</p></div>
    <div className="segmented-control"><button aria-pressed={mode === 'tracked'} onClick={() => setMode('tracked')}>Tracked changes <span>{native.data?.length ?? 0}</span></button><button aria-pressed={mode === 'semantic'} onClick={() => setMode('semantic')}>Beyond the text</button></div>
    {(native.error || semantic.error) && <p role="alert">{native.error?.message ?? semantic.error?.message}</p>}
    {mode === 'tracked' && (native.data?.length ? <RevisionPanel revisions={native.data} onSelect={revision => { if ('family' in revision) { const id = revision.anchorId ?? revision.affectedAnchors[0]?.id; if (id) onSelect(id); } }} onAccept={id => session.run(document => document.acceptRevision(id))} onReject={id => session.run(document => document.rejectRevision(id))} onAcceptAll={() => session.run(document => document.acceptAllRevisions())} onRejectAll={() => session.run(document => document.rejectAllRevisions())} /> : <div className="inspector-empty"><Icon name="check" size={26} /><h4>No redlines to resolve.</h4><p>Turn on Track edits in the editor to record your next changes.</p></div>)}
    {mode === 'semantic' && semantic.data && <SemanticChangesPanel changes={semantic.data} onSelect={onSelect} />}
  </section>;
}
