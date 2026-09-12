import { useState } from 'react';
import type { DocumentSource } from '../session';
import { useDocumentVerification } from '../hooks/useDocumentVerification';
import { downloadDocument } from '../hooks/useDocumentExport';
import { Icon } from './Icon';
import { SemanticChangesPanel } from './SemanticChangesPanel';

export interface VerificationPanelProps { document: DocumentSource | null; baseline?: DocumentSource; redline?: DocumentSource; wasmBasePath?: string }

export function VerificationPanel({ document, baseline, redline, wasmBasePath }: VerificationPanelProps) {
  const verification = useDocumentVerification(wasmBasePath);
  const [receipt, setReceipt] = useState('');
  const run = (operation: () => Promise<unknown>) => { void operation().catch(() => {}); };
  const results = { manifest: verification.manifest, verification: verification.verification, proof: verification.proof, receipt: verification.receipt, semanticChanges: verification.semanticChanges };
  const decisions = { passed: 'Checks passed', passedWithPreExistingFindings: 'Passed with existing findings', failed: 'Findings need attention', notEvaluated: 'Not evaluated' };
  const reports: Record<string, string> = { manifest: 'Package report', verification: 'Deliverable report', proof: 'Reversibility proof', receipt: 'Receipt report', semanticChanges: 'Semantic report' };
  return <section className="rdv-feature-panel" aria-label="Verify document"><div className="rdv-panel-heading"><span>CONFIDENCE IN THE HANDOFF</span><h3>Verify document</h3><p>Look beneath the page. Check the document package and review the findings before delivery.</p></div>
    <div className="rdv-review-actions"><button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.inspect(document))}>Inspect package</button>
      <button className="rdv-primary-action" type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.verify(document, baseline))}><Icon name="shield" size={15} />Verify deliverable</button>
      {baseline && <button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.compareSemantics(baseline, document))}>Inspect semantic changes</button>}
      {baseline && redline && <button type="button" disabled={!document || verification.isChecking} onClick={() => document && run(() => verification.prove(baseline, document, redline))}>Prove redline reversibility</button>}
    </div>
    {verification.isChecking && <p className="rdv-operation-notice" role="status">Inspecting your document…</p>}
    {verification.verification && <div className="rdv-verification-card" data-decision={verification.verification.decision}><Icon name="shield" size={25} /><h4>{decisions[verification.verification.decision]}</h4><p>{verification.verification.checks.filter(check => check.status === 'completed').length} checks completed · {verification.verification.findings.length} findings</p>{verification.verification.findings.length > 0 && <details><summary>Review {Math.min(5, verification.verification.findings.length)} findings</summary><ul>{verification.verification.findings.slice(0, 5).map(finding => <li key={finding.findingId}>{finding.message}</li>)}</ul><p>The complete findings are in the deliverable report below.</p></details>}</div>}
    {verification.manifest && <div className="rdv-operation-notice"><Icon name="document" size={16} />{verification.manifest.isValid ? 'Valid package structure' : 'Package findings to review'} · {verification.manifest.entries.length} entries</div>}
    {verification.semanticChanges && <SemanticChangesPanel changes={verification.semanticChanges} />}
    <details><summary>Verify a delivery receipt</summary><label>Receipt JSON<textarea value={receipt} onChange={event => setReceipt(event.target.value)} /></label><button type="button" disabled={!receipt || verification.isChecking} onClick={() => run(() => verification.verifyReceipt(receipt))}>Verify receipt</button></details>
    {verification.error && <p role="alert">{verification.error.message}</p>}
    {Object.entries(results).map(([name, result]) => result && <details key={name}><summary>{reports[name]}</summary><button type="button" onClick={() => downloadDocument(JSON.stringify(result, null, 2), `${name}.json`, 'application/json')}>Download report</button><pre>{JSON.stringify(result, null, 2)}</pre></details>)}
  </section>;
}
