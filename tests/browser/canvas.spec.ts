import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const paragraphs = (page: Page) => page.getByRole('textbox', { name: 'Document paragraph', exact: true });
async function open(page: Page, text = 'A sentence on the page.') {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  await page.evaluate(async text => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex)[0];
    if (text) session.replaceText(anchor, text);
    window.editorTest = { controllers: [controller], anchor, errors: [], changes: 0 };
    window.mountEditors([{ session: controller, wasmBasePath: '/wasm/', filename: 'On the page.docx',
      onError: error => window.editorTest.errors.push(error.message),
      onChange: () => window.editorTest.changes++, onSave: bytes => { window.editorTest.saved = bytes; } }]);
  }, text);
  await expect(paragraphs(page).first()).toBeVisible();
}
async function nativeText(page: Page) {
  return page.evaluate(() => window.editorTest.controllers[0].read(session => Object.entries(session.project().anchorIndex)
    .filter(([, anchor]) => anchor.scope === 'body' && ['p', 'h', 'li'].includes(anchor.kind))
    .map(([id]) => session.getFormatting(id)!.runs.map(run => run.text).join(''))));
}
async function settled(page: Page) {
  await expect(page.locator('.rdv-paginated-document[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('.rdv-conversion-progress')).toHaveCount(0);
}

test('click, type, keep the caret after reflow, and save the final keystroke into a real DOCX', async ({ page }) => {
  await open(page);
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Typed directly.');
  await expect.poll(() => nativeText(page)).toEqual(['A sentence on the page. Typed directly.']);
  await settled(page);
  // Let the native conversion finish, then continue without clicking again.
  await page.waitForTimeout(1500);
  await page.keyboard.type(' Still here.');
  await page.keyboard.press('Control+s');
  const saved = await page.evaluate(async () => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open(window.editorTest.saved!, {}, '/wasm/');
    const text = session.getFormatting(Object.keys(session.project().anchorIndex)[0])!.runs.map(run => run.text).join('');
    const valid = session.getPackageManifest().isValid;
    controller.close(); return { text, valid, errors: window.editorTest.errors };
  });
  expect(saved).toEqual({ text: 'A sentence on the page. Typed directly. Still here.', valid: true, errors: [] });
  await expect(page.getByRole('textbox', { name: 'Paragraph text', exact: true })).toHaveCount(0);
});

test('Enter splits at the caret, Backspace joins, and undo/redo restore native paragraphs', async ({ page }) => {
  await open(page, 'Hello world.');
  await paragraphs(page).first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('New ');
  await expect.poll(() => nativeText(page)).toEqual(['Hello ', 'New world.']);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect.poll(() => nativeText(page)).toEqual(['Hello New world.']);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual(['Hello ', 'New world.']);
  await page.keyboard.press('Control+y');
  await expect.poll(() => nativeText(page)).toEqual(['Hello New world.']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('caret formatting applies to new typing and selected text formats only that range', async ({ page }) => {
  await open(page, 'Plain text.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' Bold');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' plain');
  await page.keyboard.press('Control+s');
  const runs = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs));
  expect(runs.filter(run => run.effective.bold).map(run => run.text).join('')).toBe(' Bold');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.getByRole('button', { name: 'Italic', exact: true }).click();
  const italic = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs.filter(run => run.effective.italic).map(run => run.text).join('')));
  expect(italic).toBe('Plain');
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('blank documents accept literal typing and viewer blocks remain read only', async ({ page }) => {
  await open(page, '');
  await paragraphs(page).first().click();
  await page.keyboard.type('My *literal* [document].');
  await expect.poll(() => nativeText(page)).toEqual(['My *literal* [document].']);
  await page.evaluate(() => window.mountEditors([{ session: window.editorTest.controllers[0], readOnly: true, wasmBasePath: '/wasm/' }]));
  await expect(paragraphs(page)).toHaveCount(0);
  await page.locator('#pagination-container').getByText('My *literal* [document].', { exact: true }).click();
  await page.keyboard.type(' must not edit');
  expect(await nativeText(page)).toEqual(['My *literal* [document].']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});
