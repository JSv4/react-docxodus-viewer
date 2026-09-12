import { expect, test } from '@playwright/test';

test('combined products, fan-out failures, consolidation and reversible redlines', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    let session = await controller.open('blank', {}, '/wasm/');
    let anchor = Object.keys(session.project().anchorIndex)[0];
    session.replaceText(anchor, 'Payment is due in thirty days.');
    const baseline = controller.save();
    session.replaceText(anchor, 'Payment is due in sixty days.');
    const alice = controller.save();
    session = await controller.open(baseline); anchor = Object.keys(session.project().anchorIndex)[0];
    session.replaceText(anchor, 'Payment is due in ninety days.');
    const bob = controller.save();
    const products = await api.docxDiffCompareProducts(baseline, alice, {}, api.ALL_COMPARISON_PRODUCTS);
    const batch = await api.docxDiffCompareBatch(baseline, [{ name: 'Alice', document: alice }, { name: 'Broken file', document: new Uint8Array([1, 2, 3]) }, { name: 'Bob', document: bob }], {}, api.ALL_COMPARISON_PRODUCTS);
    const reviewers = [{ author: 'Alice', document: alice }, { author: 'Bob', document: bob }];
    const settings = { conflictResolution: api.ConflictResolution.StackAll };
    const consolidated = await api.docxDiffConsolidate(baseline, reviewers, settings);
    const conflicts = await api.docxDiffGetConflicts(baseline, reviewers, settings);
    const revisions = await api.docxDiffGetConsolidatedRevisions(baseline, reviewers, settings);
    const script = await api.docxDiffGetConsolidatedEditScript(baseline, reviewers, settings);
    const accepted = await api.docxDiffAcceptRevisions(products.redline!);
    const rejected = await api.docxDiffRejectRevisions(products.redline!);
    const proof = await api.proveRedlineReversibility(baseline, alice, products.redline!);
    const receipt = await api.verifyDeliveryReceipt('{}');
    const acceptedText = await api.convertDocxToHtml(accepted);
    const rejectedText = await api.convertDocxToHtml(rejected);
    controller.close();
    return { batch: batch.map(item => ({ name: item.name, error: item.error, revisions: item.revisions?.length })), redline: products.redline!.length, semantic: products.semanticChanges!.changeCount,
      script: !!products.editScript, consolidated: consolidated.length, conflicts: conflicts.length, revisions: revisions.length, consolidatedScript: !!script,
      proof, receipt, acceptedText, rejectedText };
  });
  expect(result.batch).toHaveLength(3);
  expect(result.batch[1].error).toBeTruthy();
  expect(result.batch[0].revisions! > 0 && result.batch[2].revisions! > 0).toBe(true);
  expect(result.redline && result.semantic && result.consolidated && result.conflicts && result.revisions).toBeGreaterThan(0);
  expect(result.script && result.consolidatedScript).toBe(true);
  expect(result.acceptedText).toContain('sixty');
  expect(result.rejectedText).toContain('thirty');
  expect(result.proof).toHaveProperty('schemaVersion');
  expect(result.receipt.isValid).toBe(false);
  expect(result.receipt.findings).toContain('malformed_envelope');
});
