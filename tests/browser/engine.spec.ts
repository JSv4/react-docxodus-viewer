import { expect, test } from '@playwright/test';

declare global { interface Window { rdv: typeof import('../../src') } }

test('loads the packaged runtime and observes native edits, batches, comments and review', async ({ page }) => {
  page.on('pageerror', error => console.error('Browser error:', error.message));
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex).find(id => id.startsWith('p:body:'))!;
    session.replaceText(anchor, 'The original agreement.');
    const original = controller.save();
    session.setTrackedChanges(api.TrackedChangeMode.RenderInline);
    session.replaceTextRange(anchor, 'original', 'revised');
    const revisions = session.listRevisions();
    const afterEdit = controller.getSnapshot().version;
    const comment = session.addComment(anchor, null, 'Reviewer', 'Review this clause.');
    const comments = session.listComments();
    const projection = session.project();
    const comparison = await api.docxDiffCompareProducts(original, controller.save(), { preAcceptInputRevisions: true }, ['redline', 'revisions', 'semanticChanges', 'editScript']);
    const metadata = await api.getDocumentMetadata(original);
    const html = await api.convertDocxToHtml(controller.save(), { paginationMode: api.PaginationMode.Paginated, renderTrackedChanges: true, stampAnchors: true });
    const manifest = session.getPackageManifest();
    const verification = session.verifyDeliverable();
    const result = {
      afterEdit, version: session.getVersion(),
      revisions: revisions.map(r => ({ type: r.type, family: r.family, status: r.resolutionStatus })),
      comment: comment.success, comments: comments.map(c => c.text), markdown: projection.markdown,
      comparisonCount: comparison.revisions?.length, semanticCount: comparison.semanticChanges?.changeCount,
      hasRedline: !!comparison.redline?.byteLength, hasEditScript: !!comparison.editScript,
      sections: metadata.sections.length, anchoredHtml: html.includes('data-source-anchor-id'),
      manifestValid: manifest.isValid, verificationCompleted: verification.analysisCompleted,
    };
    controller.close();
    return result;
  });
  expect(result.revisions.length).toBeGreaterThan(0);
  expect(result.afterEdit).toBeGreaterThan(0);
  expect(result.version).toBeGreaterThan(result.afterEdit);
  expect(result.comment).toBe(true);
  expect(result.comments).toContain('Review this clause.');
  expect(result.markdown).toContain('revised');
  expect(result.comparisonCount).toBeGreaterThan(0);
  expect(result.semanticCount).toBeGreaterThan(0);
  expect(result.hasRedline && result.hasEditScript && result.anchoredHtml).toBe(true);
  expect(result.manifestValid && result.verificationCompleted).toBe(true);
  expect(result.sections).toBeGreaterThan(0);
});
