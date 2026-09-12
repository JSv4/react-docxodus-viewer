import { useState } from 'react';
import type { DocumentSource } from '../session';
import { useDocumentVerification } from '../hooks/useDocumentVerification';
import { downloadDocument } from '../hooks/useDocumentExport';

export interface VerificationPanelProps { document: DocumentSource | null; baseline?: DocumentSource; redline?: DocumentSource; wasmBasePath?: string }

export function VerificationPanel({ document, baseline, redline, wasmBasePath }: VerificationPanelProps) {
  const verification = useDocumentVerification(wasmBasePath);
  const [receipt, setReceipt] = useState('');
  const run = (operation: () => Promise<unknown>) => { void operation().catch(() => {}); };
  const results = { manifest: verification.manifest, verification: verification.verification, proof: verification.proof, receipt: verification.receipt, semanticChanges: verification.semanticChanges };
  return <section className="rdv-feature-panel" aria-label="Verify document"><h3>Verify document</h3>
    <div className="rdv-review-actions"><button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.inspect(document))}>Inspect package</button>
      <button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.verify(document, baseline))}>Verify deliverable</button>
      {baseline && <button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.compareSemantics(baseline, document))}>Inspect semantic changes</button>}
      {baseline && redline && <button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.prove(baseline, document, redline))}>Prove redline reversibility</button>}
    </div>
    <details><summary>Verify a delivery receipt</summary><label>Receipt JSON<textarea value={receipt} onChange={event => setReceipt(event.target.value)} /></label><button type="button" disabled={!receipt || verification.isChecking} onClick={() => run(() => verification.verifyReceipt(receipt))}>Verify receipt</button></details>
    {verification.error && <p role="alert">{verification.error.message}</p>}
    {Object.entries(results).map(([name, result]) => result && <details key={name} open><summary>{name}</summary><button type="button" onClick={() => downloadDocument(JSON.stringify(result, null, 2), `${name}.json`, 'application/json')}>Download report</button><pre>{JSON.stringify(result, null, 2)}</pre></details>)}
  </section>;
}
