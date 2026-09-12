import { expect, test } from '@playwright/test';

const original = 'Build a quieter place for important work. A document should carry the idea, the conversation, and a clear path to the next decision.';

test('standalone examples share committed edits across viewer, editor and custom composition', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?example=modules');
  const document = page.locator('#pagination-container');
  await expect(document.getByText('Good work takes shape.', { exact: true })).toBeVisible();
  await expect(page.locator('.rdv-editor')).toHaveCSS('display', 'flex');
  await expect(page.locator('.rdv-editor')).toHaveCSS('border-top-left-radius', '10px');
  await expect(page.getByRole('toolbar', { name: 'Document formatting' })).toHaveCSS('display', 'flex');
  await expect(page.locator('.workspace-sidebar')).toHaveCount(0);
  await document.getByText(original, { exact: true }).click();
  await page.getByRole('button', { name: 'Edit text', exact: true }).click();
  const text = page.getByRole('textbox', { name: 'Paragraph text', exact: true });
  await expect(text).toHaveValue(original);
  await text.fill(`${original} An embedded editor.`);
  // The host commits pending drafts when switching layouts.
  await page.getByRole('button', { name: 'Just the viewer', exact: true }).click();
  await expect(document.getByText(`${original} An embedded editor.`, { exact: true })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Document formatting' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Zoom level' })).toBeVisible();
  await page.getByRole('button', { name: 'Compose your own', exact: true }).click();
  await document.getByText(`${original} An embedded editor.`, { exact: true }).click();
  await expect(text).toHaveValue(`${original} An embedded editor.`);
  await text.fill(`${original} Your own layout.`);
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'The editor block', exact: true }).click();
  await expect(document.getByText(`${original} Your own layout.`, { exact: true })).toBeVisible();
  await document.getByText(`${original} Your own layout.`, { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save document', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('Launch brief.docx');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('viewer and editing controls fit a narrow host with dark OS preferences', async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?example=modules');
  const noOverflow = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#pagination-container').getByText('Good work takes shape.', { exact: true })).toBeVisible();
  await noOverflow();
  await page.getByRole('button', { name: 'Edit text', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Paragraph text', exact: true })).toBeVisible();
  await noOverflow();
  await page.getByRole('button', { name: 'Compose your own', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A layout that belongs to you.' })).toBeVisible();
  await noOverflow();
  await page.getByRole('button', { name: 'Just the viewer', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Zoom level' })).toBeVisible();
  await noOverflow();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('typing on the page persists through viewer and composed module switches', async ({ page }) => {
  await page.goto('/?example=modules');
  const paragraph = page.getByRole('textbox', { name: 'Document paragraph', exact: true }).filter({ hasText: original });
  await paragraph.click();
  await paragraph.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
    const selection = (element.getRootNode() as ShadowRoot & { getSelection(): Selection }).getSelection();
    selection.removeAllRanges(); selection.addRange(range);
  });
  await page.keyboard.type(' Written on the page.');
  await page.getByRole('button', { name: 'Just the viewer', exact: true }).click();
  await expect(page.locator('#pagination-container').getByText(`${original} Written on the page.`, { exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compose your own', exact: true }).click();
  const composed = page.getByRole('textbox', { name: 'Document paragraph', exact: true }).filter({ hasText: 'Written on the page.' });
  await composed.click();
  await page.keyboard.press('Home');
  await page.keyboard.type('Composed: ');
  await page.getByRole('button', { name: 'The editor block', exact: true }).click();
  await expect(page.locator('#pagination-container').getByText(/Composed:/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
