import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { PageMap } from '../../src';

declare global {
  interface Window {
    nvcaTest: { map?: PageMap; before: Record<string, string>; layouts: number };
  }
}

const fixture = process.env.RDV_STRESS_DOCX;
const expectedHash = 'd75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29';
const block = (page: Page, id: string) => page.locator(`#pagination-container [data-source-anchor-id="${id}"][data-rdv-editable="true"]`);
const nativeText = (page: Page, id: string) => page.evaluate(id => window.editorTest.controllers[0].read(s => s.getFormatting(id)!.runs.map(r => r.text).join('')), id);
async function settled(page: Page) {
  await page.waitForFunction(() => window.nvcaTest.map?.documentVersion === window.editorTest.controllers[0].getSnapshot().version, undefined, { timeout: 60_000 });
  await expect(page.locator('.rdv-paginated-document[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('.rdv-conversion-progress')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('.rdv-document-html')).toHaveCount(1);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
}
interface Inspection {
  parts: Record<string, string>;
  paragraphs: Record<string, { text: string; hash: string }>;
  features: Record<string, { counts: Record<string, number>; fields: unknown[] }>;
}
function inspect(path: string): Inspection {
  return JSON.parse(execFileSync('python3', ['scripts/inspect-stress-docx.py', path], { encoding: 'utf8', maxBuffer: 8_000_000 }));
}

// Opt-in: npm run test:stress downloads/checksums the real document. The ordinary
// browser suite stays offline and uses small targeted regression fixtures.
test('NVCA charter: all body/footnote paragraphs, editing under load, and OOXML integrity', async ({ page }, testInfo) => {
  test.skip(!fixture, 'Run npm run test:stress (requires Python 3 for independent OOXML inspection).');
  test.setTimeout(600_000);
  const bytes = readFileSync(fixture!);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHash);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1480, height: 1050 });
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  const started = Date.now();
  await page.evaluate(async bytes => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open(new Uint8Array(bytes), {}, '/wasm/');
    const before = Object.fromEntries(Object.entries(session.project().anchorIndex)
      .filter(([, a]) => ['p', 'h', 'li'].includes(a.kind))
      .map(([id]) => [id, session.getFormatting(id)!.runs.map(r => r.text).join('')]));
    window.editorTest = { controllers: [controller], anchor: '', errors: [], changes: 0 };
    window.nvcaTest = { before, layouts: 0 };
    window.mountEditors([{ session: controller, wasmBasePath: '/wasm/', filename: 'NVCA editor stress test.docx', style: { height: '100vh' },
      viewerProps: { onPageMap: map => { window.nvcaTest.map = map; window.nvcaTest.layouts++; } },
      onError: error => window.editorTest.errors.push(error.message), onChange: () => window.editorTest.changes++,
      onSave: bytes => { window.editorTest.saved = bytes; } }]);
  }, [...bytes]);
  await settled(page);
  const loadMs = Date.now() - started;
  console.info(`NVCA: opened and paginated in ${loadMs} ms`);
  const before = await page.evaluate(() => window.nvcaTest.before);
  const bodyIds = Object.keys(before).filter(id => id.includes(':body:'));
  const noteIds = Object.keys(before).filter(id => id.includes(':fn:'));
  expect(bodyIds).toHaveLength(234);
  expect(noteIds).toHaveLength(110);
  const editable = await page.locator('#pagination-container [data-rdv-editable="true"]').evaluateAll(nodes => [...new Set(nodes.map(n => (n as HTMLElement).dataset.sourceAnchorId!))]);
  expect(bodyIds.filter(id => !editable.includes(id))).toEqual([]);
  expect(noteIds.filter(id => !editable.includes(id))).toEqual([]);
  const pageCount = await page.evaluate(() => window.nvcaTest.map!.pages.length);
  expect(pageCount).toBeGreaterThan(40);
  const baselinePath = testInfo.outputPath('baseline.docx');
  writeFileSync(baselinePath, Buffer.from(await page.evaluate(() => [...window.editorTest.controllers[0].save()])));
  const baseline = inspect(baselinePath);
  const original = inspect(fixture!);
  expect(baseline.features).toEqual(original.features);

  // A change of zoom must not change pagination or clip away native anchors.
  for (const zoom of ['0.5', '2', '1']) {
    await page.getByRole('combobox', { name: 'Zoom level', exact: true }).selectOption(zoom);
    await expect.poll(() => page.locator('#pagination-container .page-box').first().evaluate(el => getComputedStyle(el).zoom), { timeout: 60_000 }).toBe(zoom);
    await settled(page);
    expect(await page.evaluate(() => window.nvcaTest.map!.pages.length)).toBe(pageCount);
  }

  const targets = [...new Set([
    bodyIds[0], // title with two Word line breaks
    bodyIds.find(id => before[id].startsWith('AMENDED AND RESTATED') && id !== bodyIds[0])!,
    bodyIds.find(id => before[id].startsWith('2.1Preferential'))!, // tab after a field result
    bodyIds.find(id => before[id].startsWith('Reservation of Shares.'))!, // w:noBreakHyphen
    ...[0.2, 0.4, 0.6, 0.8, 0.95].map(fraction => bodyIds[Math.floor(bodyIds.length * fraction)]),
    noteIds[0], noteIds[Math.floor(noteIds.length / 2)], noteIds.at(-1)!,
  ])];
  const expected = { ...before };
  const timings: { id: string; commitMs: number; layoutMs: number }[] = [];
  for (const [index, id] of targets.entries()) {
    expect(id).toBeTruthy();
    const paragraph = block(page, id).last();
    await paragraph.click();
    await page.keyboard.press('End');
    const marker = ` [NVCA smoke ${index + 1}]`;
    const start = Date.now();
    await page.keyboard.type(marker, { delay: 15 });
    await expect.poll(() => nativeText(page, id), { timeout: 30_000 }).toContain(marker);
    const commitMs = Date.now() - start;
    const after = await nativeText(page, id);
    expect(after.replace(marker, '')).toBe(expected[id]);
    expected[id] = after;
    await settled(page);
    timings.push({ id, commitMs, layoutMs: Date.now() - start });
    console.info(`NVCA: edited location ${index + 1}/${targets.length}; commit ${commitMs} ms, settled ${Date.now() - start} ms`);
  }

  const last = targets.at(-1)!;
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page, last)).toBe(before[last]);
  await page.keyboard.press('Control+y');
  await expect.poll(() => nativeText(page, last)).toBe(expected[last]);
  await settled(page);

  // Bursts straddle the 350 ms native commit debounce and background reflows.
  const burstId = bodyIds.find(id => before[id].startsWith('This model charter includes a sample'))!;
  await block(page, burstId).last().click();
  await page.keyboard.press('End');
  let burst = '';
  for (let i = 0; i < 12; i++) {
    const text = ` burst-${i}`; burst += text;
    await page.keyboard.type(text, { delay: 10 });
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Control+s');
  const burstAfter = await nativeText(page, burstId);
  expect(burstAfter.replace(burst, '')).toBe(before[burstId]);
  expected[burstId] = burstAfter;
  await settled(page);

  // Real selection and toolbar formatting on a later numbered legal clause.
  const formatId = targets[2];
  const phrase = 'Preferential Payments';
  await block(page, formatId).first().click();
  await block(page, formatId).first().evaluate((el, phrase) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const index = node.textContent!.indexOf(phrase);
      if (index < 0) continue;
      const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + phrase.length);
      const selection = (el.getRootNode() as ShadowRoot & { getSelection: () => Selection }).getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return;
    }
    throw new Error('The legal clause was not rendered as selectable text.');
  }, phrase);
  await page.getByRole('button', { name: 'Italic', exact: true }).click();
  await settled(page);
  const formatted = await page.evaluate(({ id, phrase }) => {
    const f = window.editorTest.controllers[0].read(s => s.getFormatting(id)!);
    const start = f.runs.map(r => r.text).join('').indexOf(phrase);
    return f.runs.filter(r => r.span.start < start + phrase.length && r.span.start + r.span.length > start).every(r => r.effective.italic);
  }, { id: formatId, phrase });
  expect(formatted).toBe(true);

  // Split, multiline paste, merge, and save with a keystroke still pending.
  const endId = bodyIds.at(-1)!;
  const end = block(page, endId).last();
  await end.click();
  await end.evaluate(el => {
    const selection = (el.getRootNode() as ShadowRoot & { getSelection: () => Selection }).getSelection();
    const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
    selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.press('Enter');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('NVCA stress paragraph one.\nNVCA stress paragraph two.'));
  await page.keyboard.press('Control+v');
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(' FINAL');
  await page.keyboard.press('Control+s');
  await settled(page);
  const saved = await page.evaluate(() => [...window.editorTest.saved!]);
  const outputPath = testInfo.outputPath('NVCA-edited.docx');
  writeFileSync(outputPath, Buffer.from(saved));
  const reopened = await page.evaluate(async bytes => {
    const controller = new window.rdv.DocxSessionController();
    const s = await controller.open(new Uint8Array(bytes), {}, '/wasm/');
    const text = Object.fromEntries(Object.entries(s.project().anchorIndex).filter(([, a]) => ['p', 'h', 'li'].includes(a.kind))
      .map(([id]) => [id, s.getFormatting(id)!.runs.map(r => r.text).join('')]));
    const valid = s.getPackageManifest().isValid;
    controller.close(); return { text, valid };
  }, saved);
  expect(reopened.valid).toBe(true);
  for (const [id, text] of Object.entries(expected)) expect(reopened.text[id], id).toBe(text);
  const added = Object.keys(reopened.text).filter(id => !(id in before));
  expect(added).toHaveLength(1);
  expect(reopened.text[added[0]]).toBe('NVCA stress paragraph one. FINALNVCA stress paragraph two.');

  const after = inspect(outputPath);
  const allowed = new Set([...targets, burstId, endId, ...added].map(id => id.split(':').at(-1)!));
  const modified = Object.keys(baseline.paragraphs).filter(id => after.paragraphs[id]?.hash !== baseline.paragraphs[id].hash);
  expect(modified.filter(id => !allowed.has(id.split(':').at(-1)!))).toEqual([]);
  for (const [name, features] of Object.entries(baseline.features)) {
    expect(after.features[name].fields, name).toEqual(features.fields);
    expect(after.features[name].counts, name).toEqual({ ...features.counts, ...(name === 'word/document.xml' ? { p: features.counts.p + 1 } : {}) });
  }
  for (const [name, hash] of Object.entries(baseline.parts)) {
    if (!['word/document.xml', 'word/footnotes.xml'].includes(name)) expect(after.parts[name], name).toBe(hash);
  }
  expect(pageErrors).toEqual([]);
  await block(page, formatId).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('NVCA-editor.png'), caret: 'initial' });
  const report = { fixture: expectedHash, pageCount, bodyParagraphs: bodyIds.length, footnoteParagraphs: noteIds.length, loadMs,
    timings, modifiedParagraphs: modified.length, addedParagraphs: added.length, nativeCommits: await page.evaluate(() => window.editorTest.changes),
    assertions: ['all body and footnote text editable', 'stable pagination at 50%, 100%, 200%', 'typing at 12 locations', 'undo/redo',
      'typing through repeated background conversions', 'selected formatting', 'split/paste/merge', 'final keystroke saved', 'reopened native DOCX valid',
      'all original text preserved outside intentional edits', 'unchanged paragraph XML preserved', 'fields/bookmarks/notes/sections preserved', 'other package parts unchanged'] };
  writeFileSync(testInfo.outputPath('NVCA-report.json'), JSON.stringify(report, null, 2));
  await testInfo.attach('NVCA stress results', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});
