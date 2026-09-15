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

test('formatted replacements preserve local caches but refresh synthesized styles and roll back failures', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const c = new window.rdv.DocxSessionController();
    const s = await c.open('blank', { emitMarkdownPatch: false }, '/wasm/');
    const anchor = Object.keys(c.getAnchorIndex())[0];
    s.replaceText(anchor, 'Plain text.');
    const match = { text: 'Plain', enclosingAnchor: { id: anchor, kind: 'p', scope: 'body', unid: anchor.split(':').at(-1)! },
      span: { start: 0, length: 5 }, fragments: [], contextBefore: '', contextAfter: ' text.', groups: [] };
    const styles = c.getStyles(), empty = c.getRevisions(), inventory = c.getAnchorIndex(), version = s.getVersion();
    const plain = s.replaceMatch(match, 'Hello', { bold: true });
    const local = { success: plain.success, styles: c.getStyles() === styles, revisions: c.getRevisions() === empty,
      inventory: JSON.stringify(c.getAnchorIndex()) === JSON.stringify(inventory), anchors: c.getRenderChanges(s, version) };
    const beforeCode = s.getVersion();
    const code = s.replaceMatch(match, 'World', { code: true });
    const stylesRefresh = code.success && c.getStyles() !== styles && c.getRenderChanges(s, beforeCode) === null &&
      JSON.stringify(c.getStyles()) === JSON.stringify(s.listStyles());
    s.undo();
    const beforeFailure = { version: s.getVersion(), xml: s.raw.getXml(anchor), styles: s.listStyles() };
    const failed = s.replaceMatch(match, 'Wrong', { code: true, highlight: 'invalid-highlight' });
    const rollback = !failed.success && s.getVersion() === beforeFailure.version && s.raw.getXml(anchor) === beforeFailure.xml &&
      JSON.stringify(c.getStyles()) === JSON.stringify(beforeFailure.styles);
    const redo = s.redo() && s.getFormatting(anchor)!.runs.map(run => run.text).join('') === 'World text.';
    s.setTrackedChanges(window.rdv.TrackedChangeMode.RenderInline);
    const tracked = s.replaceMatch(match, 'Track', { italic: true });
    const revisions = tracked.success && c.getRevisions().length > 0 && JSON.stringify(c.getRevisions()) === JSON.stringify(s.listRevisions());
    c.close();
    return { local, stylesRefresh, rollback, redo, revisions };
  });
  expect(result.local).toMatchObject({ success: true, styles: true, revisions: true, inventory: true,
    anchors: [expect.any(String)] });
  expect(result).toMatchObject({ stylesRefresh: true, rollback: true, redo: true, revisions: true });
});
