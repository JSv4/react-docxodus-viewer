import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { DocumentEditorProps, DocxSessionController } from '../../src';

declare global {
  interface Window {
    mountEditors: (props: DocumentEditorProps[]) => void;
    editorTest: { controllers: DocxSessionController[]; anchor: string; errors: string[]; changes: number; saved?: Uint8Array };
  }
}

async function openEditor(page: Page, text = 'alpha alpha omega.') {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  await page.evaluate(async text => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex)[0];
    session.replaceText(anchor, text);
    window.editorTest = { controllers: [controller], anchor, errors: [], changes: 0 };
    window.mountEditors([{ session: controller, wasmBasePath: '/wasm/', filename: 'Editing example.docx', defaultTextEditorOpen: true,
      onChange: () => { window.editorTest.changes++; }, onSave: bytes => { window.editorTest.saved = bytes; },
      onError: error => window.editorTest.errors.push(error.message) }]);
  }, text);
  await expect(page.getByRole('textbox', { name: 'Paragraph text', exact: true })).toHaveValue(text);
  if (text.length < 1000) await expect(page.locator('#pagination-container').getByText(text, { exact: true })).toBeVisible();
}

async function selectPageText(page: Page, text: string, start: number, length: number) {
  await expect(page.locator('.rdv-paginated-document[aria-busy="true"]')).toHaveCount(0);
  await page.locator('#pagination-container p[data-source-anchor-id]').filter({ hasText: text }).last().evaluate((element, { start, length }) => {
    const block = element.closest('[data-source-anchor-id]')!;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      if (!(walker.currentNode.parentElement?.closest('[data-list-marker="true"]'))) nodes.push(walker.currentNode as Text);
    }
    const point = (offset: number): [Text, number] => {
      for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length; }
      throw new Error('Selection outside paragraph');
    };
    const range = document.createRange();
    range.setStart(...point(start)); range.setEnd(...point(start + length));
    const root = block.getRootNode() as ShadowRoot & { getSelection: () => Selection };
    const selection = root.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    block.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  }, { start, length });
  await expect(page.locator('.rdv-editor-status')).toContainText(`${length} characters selected`);
}

test('editor formats the exact repeated text, preserves runs during typing, and saves a native DOCX', async ({ page }) => {
  await openEditor(page);
  await selectPageText(page, 'alpha alpha omega.', 6, 5);
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const runs = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs));
  expect(runs.filter(run => run.effective.bold).map(run => run.text).join('')).toBe('alpha');
  expect(runs.find(run => run.effective.bold)!.span).toEqual({ start: 6, length: 5 });
  expect(runs[0].effective.bold).not.toBe(true);

  const text = page.getByRole('textbox', { name: 'Paragraph text', exact: true });
  await text.fill('alpha bravo omega. More to say.');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  await expect(page.locator('#pagination-container').getByText('alpha bravo omega. More to say.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(text).toHaveValue('alpha alpha omega.');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(text).toHaveValue('alpha bravo omega. More to say.');
  // A single local insertion must leave an earlier mixed-format run unchanged.
  await text.fill('alpha bravo omega. More to say. Added.');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  const appended = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs));
  expect(appended[0].effective.bold).not.toBe(true);
  expect(appended.some(run => run.effective.bold && run.text.includes('bravo'))).toBe(true);
  expect(appended.filter(run => run.effective.bold).map(run => run.text).join('')).toBe('bravo');

  await page.getByRole('combobox', { name: 'Zoom level', exact: true }).selectOption('0.75');
  await page.getByRole('combobox', { name: 'Font family', exact: true }).selectOption('Georgia');
  await page.getByRole('combobox', { name: 'Font size', exact: true }).selectOption('14');
  await page.getByRole('button', { name: 'Align center', exact: true }).click();
  await page.getByRole('combobox', { name: 'Line spacing', exact: true }).selectOption('360');
  await page.getByRole('button', { name: 'Numbered list', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Numbered list', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(text).toHaveValue('alpha bravo omega. More to say. Added.');
  await text.fill('alpha bravo omega. More to say. Numbered.');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  await selectPageText(page, 'alpha bravo omega. More to say. Numbered.', 6, 5);
  await page.getByRole('button', { name: 'Italic', exact: true }).click();
  await page.getByRole('button', { name: 'Save document', exact: true }).click();
  const saved = await page.evaluate(async () => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open(window.editorTest.saved!, {}, '/wasm/');
    const anchor = session.findAllByText('alpha bravo')[0].id;
    const info = session.getFormatting(anchor)!;
    const result = { text: info.runs.map(run => run.text).join(''), info, list: session.getListMembership(anchor),
      errors: window.editorTest.errors, changes: window.editorTest.changes, valid: session.getPackageManifest().isValid };
    controller.close(); return result;
  });
  expect(saved.text).toBe('alpha bravo omega. More to say. Numbered.');
  expect(saved.info.runs.every(run => run.effective.fontFamily === 'Georgia' && run.effective.fontSizePts === 14)).toBe(true);
  expect(saved.info.effectiveParagraph).toMatchObject({ alignment: 'center', lineSpacing: 360 });
  expect(saved.list?.format).toBe('decimal');
  expect(saved.info.runs.filter(run => run.effective.italic).map(run => run.text).join('')).toBe('bravo');
  expect(saved.valid).toBe(true);
  expect(saved.errors).toEqual([]);
  expect(saved.changes).toBeGreaterThan(5);
  await page.getByRole('button', { name: 'Insert paragraph after', exact: true }).click();
  await expect(text).toHaveValue('');
  await text.fill('A new paragraph.');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  await expect(page.locator('#pagination-container').getByText('A new paragraph.', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Zoom level', exact: true })).toHaveValue('0.75');
});

test('editor inserts links, tables and images through native commands and protects read-only sessions', async ({ page }) => {
  await openEditor(page);
  await selectPageText(page, 'alpha alpha omega.', 6, 5);
  await page.getByRole('button', { name: 'Insert link', exact: true }).click();
  const link = page.getByRole('dialog', { name: 'Insert hyperlink', exact: true });
  await link.getByRole('textbox', { name: 'Link address' }).fill('https://example.com/linked');
  await link.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.locator('#pagination-container a[href="https://example.com/linked"]')).toHaveText('alpha');
  await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  const table = page.getByRole('dialog', { name: 'Insert table', exact: true });
  await table.getByRole('spinbutton', { name: 'Rows' }).fill('2');
  await table.getByRole('spinbutton', { name: 'Columns' }).fill('3');
  await table.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.locator('#pagination-container table td')).toHaveCount(6);
  await page.locator('#pagination-container table td').first().locator('p').click();
  await expect(page.getByRole('textbox', { name: 'Paragraph text', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Paragraph text', exact: true }).fill('Cell one');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  await expect(page.locator('#pagination-container table td').first()).toContainText('Cell one');
  await page.locator('#pagination-container').getByText('alpha alpha omega.', { exact: true }).click();
  await page.getByLabel('Choose image', { exact: true }).setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') });
  await expect(page.locator('#pagination-container img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Track changes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Paragraph text', exact: true }).fill('alpha alpha omega. Reviewed.');
  await page.getByRole('button', { name: 'Apply text', exact: true }).click();
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.listRevisions().length))).toBeGreaterThan(0);
  await page.evaluate(() => window.mountEditors([{ session: window.editorTest.controllers[0], wasmBasePath: '/wasm/', readOnly: true }]));
  await expect(page.getByRole('toolbar', { name: 'Document formatting' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Paragraph text', exact: true })).toHaveCount(0);
  const version = await page.evaluate(() => window.editorTest.controllers[0].getSnapshot().version);
  await page.locator('#pagination-container').getByText('alpha alpha omega. Reviewed.', { exact: true }).click();
  await page.keyboard.press('Control+b');
  expect(await page.evaluate(() => window.editorTest.controllers[0].getSnapshot().version)).toBe(version);
  await page.evaluate(() => window.mountEditors([]));
  await expect(page.locator('.rdv-editor')).toHaveCount(0);
  expect(await page.evaluate(() => !!window.editorTest.controllers[0].getSnapshot().session)).toBe(true);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('separate owned editor blocks keep document state independent and dispose on unmount', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  await page.evaluate(() => {
    window.editorTest = { controllers: [], anchor: '', errors: [], changes: 0 };
    window.mountEditors([0, 1].map(index => ({ filename: `Document ${index + 1}.docx`, wasmBasePath: '/wasm/', defaultTextEditorOpen: true,
      onReady: controller => { window.editorTest.controllers[index] = controller; } })));
  });
  const editors = page.getByRole('region', { name: 'Document editor block', exact: true });
  await expect(editors.nth(0).getByRole('textbox', { name: 'Paragraph text', exact: true })).toBeEnabled();
  await expect(editors.nth(1).getByRole('textbox', { name: 'Paragraph text', exact: true })).toBeEnabled();
  await editors.nth(0).getByRole('textbox', { name: 'Paragraph text', exact: true }).fill('First document *literal* [text].');
  await editors.nth(0).getByRole('button', { name: 'Apply text', exact: true }).click();
  await expect(editors.nth(0).locator('#pagination-container').getByText('First document *literal* [text].', { exact: true })).toBeVisible();
  await expect(editors.nth(1).getByRole('textbox', { name: 'Paragraph text', exact: true })).toHaveValue('');
  await page.evaluate(() => window.mountEditors([]));
  await expect(editors).toHaveCount(0);
  expect(await page.evaluate(() => window.editorTest.controllers.every(controller => !controller.getSnapshot().session))).toBe(true);
});

test('page selection maps repeated text across fragments to exact native offsets', async ({ page }) => {
  await openEditor(page, 'A long repeated phrase with alpha and omega. '.repeat(180));
  const fragments = page.locator('#pagination-container p[data-source-anchor-id]');
  await expect.poll(() => fragments.count()).toBeGreaterThan(1);
  const start = await fragments.first().evaluate(element => {
    const next = element.getRootNode() as ShadowRoot & { getSelection: () => Selection };
    const pieces = Array.from(next.querySelectorAll('#pagination-container p[data-source-anchor-id]'));
    const point = (block: Element, offset: number): [Node, number] => {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (offset <= node.length) return [node, offset];
        offset -= node.length;
      }
      throw new Error('No selection point');
    };
    const start = pieces[0].textContent!.length - 6;
    const range = document.createRange(); range.setStart(...point(pieces[0], start)); range.setEnd(...point(pieces[1], 6));
    const selection = next.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    pieces[0].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return start;
  });
  await expect(page.locator('.rdv-editor-status')).toContainText('12 characters selected');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  const bold = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs.filter(run => run.effective.bold)));
  expect(bold.reduce((count, run) => count + run.span.length, 0)).toBe(12);
  expect(bold[0].span.start).toBe(start);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('pending drafts survive external changes and save only after a safe commit', async ({ page }) => {
  await openEditor(page, 'The starting paragraph.');
  const text = page.getByRole('textbox', { name: 'Paragraph text', exact: true });
  await text.fill('The starting paragraph. My local draft.');
  // A formatting-only external edit keeps character offsets valid.
  await page.evaluate(() => window.editorTest.controllers[0].run(s => s.applyFormat(window.editorTest.anchor, null, { italic: true })));
  await page.getByRole('button', { name: 'Save document', exact: true }).click();
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getAnchorInfo(window.editorTest.anchor)!.visibleText))).toBe('The starting paragraph. My local draft.');
  await text.fill('Keep this unsaved draft.');
  await page.evaluate(() => window.editorTest.controllers[0].run(s => s.replaceText(window.editorTest.anchor, 'An external text change.')));
  await expect(text).toHaveValue('Keep this unsaved draft.');
  await expect(page.getByRole('region', { name: 'Paragraph text editor' })).toContainText('The paragraph changed elsewhere');
  await expect(page.getByRole('button', { name: 'Apply text', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save document', exact: true }).click();
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getAnchorInfo(window.editorTest.anchor)!.visibleText))).toBe('An external text change.');
  await page.getByRole('button', { name: 'Reload text', exact: true }).click();
  await expect(text).toHaveValue('An external text change.');
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});
