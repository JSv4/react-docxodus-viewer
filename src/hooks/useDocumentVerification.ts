import type { DeliverableVerificationResult, DeliveryReceiptVerificationResult, PackageManifest, RedlineReversibilityProof, SemanticChangeSet, DocxDiffSettings } from 'docxodus/core';
import type { DocumentSource } from '../session';
import { useDocxodusApi } from './useDocxodusApi';
import { useAsyncOperation } from './useAsyncOperation';

export function useDocumentVerification(wasmBasePath?: string) {
  const { call, worker } = useDocxodusApi({ wasmBasePath });
  const manifest = useAsyncOperation<PackageManifest>();
  const verification = useAsyncOperation<DeliverableVerificationResult>();
  const proof = useAsyncOperation<RedlineReversibilityProof>();
  const receipt = useAsyncOperation<DeliveryReceiptVerificationResult>();
  const semantic = useAsyncOperation<SemanticChangeSet>();

  return {
    manifest: manifest.data, verification: verification.data, proof: proof.data, receipt: receipt.data, semanticChanges: semantic.data,
    isChecking: [manifest, verification, proof, receipt, semantic].some(t => t.isRunning),
    error: manifest.error ?? verification.error ?? proof.error ?? receipt.error ?? semantic.error,
    inspect: (document: DocumentSource) => manifest.run(() => worker ? worker.generatePackageManifest(document) : call('generatePackageManifest', document)),
    verify: (document: DocumentSource, baseline?: DocumentSource) => verification.run(() => worker ? worker.verifyDeliverable(document, baseline) : call('verifyDeliverable', document, baseline)),
    prove: (baseline: DocumentSource, final: DocumentSource, redline: DocumentSource) => proof.run(() => worker ? worker.proveRedlineReversibility(baseline, final, redline) : call('proveRedlineReversibility', baseline, final, redline)),
    verifyReceipt: (json: string, artifacts?: Record<string, Uint8Array>) => receipt.run(() => call('verifyDeliveryReceipt', json, artifacts)),
    compareSemantics: (left: DocumentSource, right: DocumentSource, settings?: DocxDiffSettings) => semantic.run(() => worker ? worker.getSemanticChanges(left, right, settings) : call('docxDiffGetSemanticChanges', left, right, settings)),
    clear: () => { for (const task of [manifest, verification, proof, receipt, semantic]) task.reset(); },
  };
}
