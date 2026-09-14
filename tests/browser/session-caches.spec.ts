import { expect, test } from '@playwright/test';

test('split metadata caches match native style and revision reads while ownership changes', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const api = window.rdv, controller = new api.DocxSessionController();
    const s = await controller.open('blank', { emitMarkdownPatch: false }, '/wasm/');
    const check = <T extends { success: boolean; error?: { message: string } }>(result: T): T => {
      if (!result.success) throw new Error(result.error?.message ?? 'Native edit failed');
      return result;
    };
    const anchor = Object.keys(controller.getAnchorIndex())[0];
    check(s.replaceText(anchor, 'Hello world.'));
    check(s.setParagraphStyle(anchor, 'Heading1'));
    const styles = controller.getStyles(), emptyRevisions = controller.getRevisions();
    const inventory = controller.getAnchorIndex(), formatting = controller.getFormatting(anchor), version = s.getVersion();
    const split = check(controller.run(session => session.splitParagraph(anchor, 6)));
    const keptStyles = controller.getStyles() === styles;
    const keptEmptyRevisions = controller.getRevisions() === emptyRevisions;
    const freshInventory = controller.getAnchorIndex() !== inventory && Object.keys(controller.getAnchorIndex()).length === Object.keys(inventory).length + 1;
    const freshFormatting = controller.getFormatting(anchor) !== formatting;
    const renderBoundary = controller.getRenderChanges(s, version) === null;
    const stylesMatchNative = JSON.stringify(controller.getStyles()) === JSON.stringify(s.listStyles());
    const emptyMatchNative = JSON.stringify(controller.getRevisions()) === JSON.stringify(s.listRevisions());
    s.setTrackedChanges(api.TrackedChangeMode.RenderInline);
    const right = split.created[0].id;
    for (const edit of s.replaceTextRange(right, 'world', 'tracked')) check(edit);
    const tracked = controller.getRevisions();
    const trackingInvalidatedEmpty = tracked !== emptyRevisions && tracked.length > 0;
    s.setTrackedChanges(api.TrackedChangeMode.Accept);
    const existing = controller.getRevisions();
    check(s.splitParagraph(right, 0));
    const existingRevisionsRefreshed = controller.getRevisions() !== existing;
    const movedRevisionsMatchNative = JSON.stringify(controller.getRevisions()) === JSON.stringify(s.listRevisions());
    const stylesBeforeCode = controller.getStyles(), versionBeforeCode = s.getVersion();
    check(s.applyFormat(anchor, { start: 0, length: 1 }, { code: true }));
    const codeRefreshesDefinitions = controller.getStyles() !== stylesBeforeCode &&
      JSON.stringify(controller.getStyles()) === JSON.stringify(s.listStyles());
    const codeRequiresFullRender = controller.getRenderChanges(s, versionBeforeCode) === null;
    controller.close();
    return { keptStyles, keptEmptyRevisions, freshInventory, freshFormatting, renderBoundary, stylesMatchNative,
      emptyMatchNative, trackingInvalidatedEmpty, existingRevisionsRefreshed, movedRevisionsMatchNative,
      codeRefreshesDefinitions, codeRequiresFullRender };
  });
  expect(Object.values(result)).toEqual(Array(12).fill(true));
});
