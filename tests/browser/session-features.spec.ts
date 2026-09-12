import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('native session preserves transactions, structures, notes, links, images and annotations', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    const s = await controller.open('blank', {}, '/wasm/');
    const successes: string[] = [];
    const check = (name: string, result: { success: boolean; error?: { message: string } }) => {
      if (!result.success) throw new Error(`${name}: ${result.error?.message}`);
      successes.push(name); return result;
    };
    const anchor = Object.keys(s.project().anchorIndex).find(id => id.startsWith('p:body:'))!;
    check('text', s.replaceText(anchor, 'Original agreement.'));
    const version = s.getVersion();
    const preview = s.previewBatch([{ tool: 'text', action: 'replace', mutation: shadow => shadow.replaceText(anchor, 'Preview only.') }], 'atomic', { html: 'full' });
    const unchangedAfterPreview = s.getVersion() === version && s.project().markdown.includes('Original agreement.');
    const rollback = s.executeBatch([
      { tool: 'text', action: 'replace', mutation: () => s.replaceText(anchor, 'Must roll back.') },
      { tool: 'text', action: 'fail', mutation: () => s.replaceText('p:body:missing', 'Invalid.') },
    ]);
    const unchangedAfterRollback = s.project().markdown.includes('Original agreement.');
    const precondition = s.replaceText(anchor, 'Stale edit.', { expectedVersion: 98765 });
    check('guarded edit', s.runWithPreconditions({ expectedVersion: s.getVersion() }, () => s.replaceText(anchor, 'A linked agreement.')));
    const undo = s.undo(); const redo = s.redo();
    check('format', s.applyFormat(anchor, { start: 0, length: 1 }, { bold: true, fontSizePts: 14 }));
    check('paragraph format', s.setParagraphFormat(anchor, { alignment: 'center' }));
    check('list', s.applyListFormat(anchor, 'decimal'));
    check('list numbering', s.setListStartOverride(anchor, 3));
    check('remove list', s.removeListMembership(anchor));
    check('bookmark', s.addBookmark('Agreement', { startAnchorId: anchor, startOffset: 2, endAnchorId: anchor, endOffset: 8 }));
    check('hyperlink', s.addHyperlink(anchor, { start: 2, length: 6 }, 'external', 'https://example.com'));
    const hyperlinks = s.listHyperlinks().length;
    check('cross reference', s.insertCrossReference(anchor, 0, 'Agreement'));
    check('annotation', s.addAnnotation(anchor, null, { id: 'test-annotation', labelId: 'test', label: 'Review', color: '#ffff00', bookmarkName: '' }));
    check('annotation update', s.updateAnnotation('test-annotation', { label: 'Reviewed', metadataPatch: { owner: 'Test' } }));
    const annotations = s.findByLabel('test')['test-annotation'].length;
    check('comment', s.addComment(anchor, null, 'Test', 'A comment'));
    const comment = s.listComments()[0];
    check('reply', s.addCommentReply(comment.anchorId, 'Second', 'A reply'));
    check('resolve comment', s.setCommentResolved(comment.anchorId, true));
    check('header', s.setHeaderText(anchor, 'default', 'Running header'));
    check('footer', s.setFooterText(anchor, 'default', 'Running footer'));
    check('page setup', s.setPageSetup(anchor, { landscape: true }));
    check('page numbering', s.setPageNumbering(anchor, { start: 3 }));
    check('footnote', s.insertFootnote(anchor, 0, 'Footnote text'));
    check('endnote', s.insertEndnote(anchor, 0, 'Endnote text'));
    check('table', s.insertTable(anchor, 'after', 2, 2));
    const cell = Object.keys(s.project().anchorIndex).find(id => id.startsWith('tc:body:'))!;
    check('cell text', s.replaceCellContent(cell, 'Table cell'));
    check('cell shading', s.setCellShading(cell, 'FFFF00'));
    check('table border', s.setTableBorders(cell, { scope: 'all', style: 'single', size: 4, color: '000000' }));
    check('table row', s.insertTableRow(cell, 'after'));
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
    const image = s.insertImage(anchor, 0, png, { widthPoints: 36, heightPoints: 36 }); check('image', image);
    check('image resize', s.setImageDimensions(image.imageId!, { widthPoints: 72, heightPoints: 72 }));
    check('image metadata', s.setImageMetadata(image.imageId!, 'Test image', 'Title'));
    const imageCount = s.listImages().length;
    const final = controller.save();
    const set = await api.createExternalAnnotationSet(final, 'external-test');
    const offset = await api.searchTextOffsets(final, 'agreement');
    const external = api.createAnnotationFromSearch('external', 'review', set.content, 'agreement');
    if (external) set.labelledText.push(external);
    set.textLabels.review = { id: 'review', text: 'Review', color: '#ffeb3b', description: '', icon: '', labelType: 'text' };
    set.textLabels.test = { id: 'test', text: 'Reviewed', color: '#ffff00', description: '', icon: '', labelType: 'text' };
    const validation = await api.validateExternalAnnotations(final, set);
    const projected = await api.convertDocxToHtmlWithExternalAnnotations(final, set);
    const opencontracts = await api.exportToOpenContract(final);
    const semantic = s.getSemanticChanges();
    const output = { successes, preview: preview.success && !!preview.html, unchangedAfterPreview, rollback: rollback.rolledBack, unchangedAfterRollback,
      precondition: precondition.error?.code, undo, redo, hyperlinks, annotations, imageCount, comments: s.listComments().length,
      externalValid: validation.isValid, validation, offsetCount: offset.length, projected: projected.includes('external'), opencontracts: opencontracts.content.length,
      families: [...new Set(semantic.changes.map(change => change.family))] };
    controller.close(); return output;
  });
  expect(result.preview && result.unchangedAfterPreview && result.rollback && result.unchangedAfterRollback).toBe(true);
  expect(result.precondition).toBe('precondition_failed');
  expect(result.undo && result.redo).toBe(true);
  expect(result.hyperlinks && result.annotations && result.imageCount).toBeGreaterThan(0);
  expect(result.comments).toBe(2);
  expect(result.externalValid, JSON.stringify(result.validation)).toBe(true);
  expect(result.projected).toBe(true);
  expect(result.offsetCount && result.opencontracts).toBeGreaterThan(0);
  expect(result.families).toEqual(expect.arrayContaining(['table', 'header', 'footer', 'comment', 'image', 'annotation']));
});

test('fills native plain/rich text, checkbox, date and choice controls', async ({ page }) => {
  const bytes = [...await readFile(new URL('../fixtures/content-controls.docx', import.meta.url))];
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async bytes => {
    const controller = new window.rdv.DocxSessionController();
    const s = await controller.open(new Uint8Array(bytes), {}, '/wasm/');
    const controls = Object.fromEntries(s.listContentControls().map(control => [control.tag, control.anchorId]));
    const operations = [s.fillContentControlText(controls.plain, 'Filled plain'), s.fillContentControlRichText(controls.rich, '**Filled rich**'), s.setContentControlChecked(controls.check, true), s.setContentControlDate(controls.date, '2026-09-12'), s.selectContentControlItem(controls.choice, 'two')];
    const saved = controller.save();
    await controller.open(saved);
    const content = controller.getSnapshot().session!.listContentControls().map(control => ({ tag: control.tag, text: control.text }));
    controller.close(); return { operations, content };
  }, bytes);
  for (const operation of result.operations) expect(operation, operation.error?.message).toHaveProperty('success', true);
  expect(result.content).toEqual(expect.arrayContaining([{ tag: 'plain', text: 'Filled plain' }, { tag: 'rich', text: 'Filled rich' }, { tag: 'choice', text: 'Second' }]));
});
