import { expect, test } from '@playwright/test';

const title = 'Good work takes shape.';
const commented = 'Give every reviewer a clear next step before the final handoff.';
const paragraph = 'Build a quieter place for important work. A document should carry the idea, the conversation, and a clear path to the next decision.';

test('studio block previews follow a new paragraph and discard a replaced document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  const content = page.getByRole('textbox', { name: 'Markdown content' });
  const picker = page.getByRole('combobox', { name: 'Selected block' });
  await content.fill('Hello world.');
  await page.getByRole('button', { name: 'Replace selected block' }).click();
  const canvas = page.locator('.workspace-document #pagination-container');
  await canvas.getByText('Hello world.', { exact: true }).click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('New ');
  await expect(content).toHaveValue('New world.');
  await expect(picker.locator('option:checked')).toContainText('New world.');
  await expect(picker.locator('option[value^="p:"]')).toHaveCount(2);

  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await expect(content).toHaveValue('');
  await expect(picker.locator('option[value^="p:"]')).toHaveCount(1);
  await expect(picker).not.toContainText('world');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('studio connects paragraph editing, navigation, keyboard commands and checkpoint previews', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample document' }).click();
  const document = page.locator('.workspace-document #pagination-container');
  await expect(document.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tracked changes 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'verify', exact: true }).click();
  await page.getByRole('button', { name: 'Verify deliverable' }).click();
  await expect(page.locator('.rdv-verification-card')).toContainText('Checks passed');
  await expect(page.locator('.rdv-verification-card')).toContainText('0 findings');

  // Clicking commented text must select its paragraph, not the comment wrapper.
  await document.getByText(commented, { exact: true }).click();
  await page.getByRole('toolbar', { name: 'Selected paragraph' }).getByRole('button', { name: 'Edit paragraph' }).click();
  const content = page.getByRole('textbox', { name: 'Markdown content' });
  await expect(content).toHaveValue(commented);
  await expect(document.locator('[data-rdv-selected="true"]')).toContainText(commented);

  // The projection's short text preview must never truncate a replacement.
  await document.getByText(paragraph, { exact: true }).click();
  await expect(content).toHaveValue(paragraph);
  await content.fill(`${paragraph} Ready for review.`);
  await page.getByRole('button', { name: 'Replace selected block' }).click();
  await expect(document.getByText(`${paragraph} Ready for review.`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(content).toHaveValue(paragraph);
  await expect(document.getByText(paragraph, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(content).toHaveValue(`${paragraph} Ready for review.`);
  await expect(document.getByText(`${paragraph} Ready for review.`, { exact: true })).toBeVisible();

  await page.keyboard.press('Control+f');
  const navigator = page.getByRole('complementary', { name: 'Document navigator' });
  await expect(navigator.getByRole('button', { name: /A shared direction/ })).toBeVisible();
  await navigator.getByRole('textbox', { name: 'Find in document' }).fill('reviewer');
  await navigator.getByRole('button', { name: /Give every reviewer/ }).click();
  await expect(content).toHaveValue(commented);
  await expect(document.locator('[data-rdv-selected="true"]')).toContainText(commented);
  await page.getByRole('button', { name: 'Close navigator' }).click();

  await page.keyboard.press('Control+k');
  const command = page.getByRole('dialog', { name: 'Command menu' });
  await command.getByRole('combobox', { name: 'Search commands' }).fill('history');
  await page.keyboard.press('Enter');
  await expect(command).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Checkpoint label' }).fill('A direction worth keeping');
  await page.getByRole('button', { name: 'Save checkpoint' }).click();
  await expect(page.getByRole('radio', { name: 'A direction worth keeping' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview checkpoint' }).click();
  const preview = page.getByRole('dialog', { name: 'Checkpoint preview' });
  await expect(preview.locator('#pagination-container').getByText(`${paragraph} Ready for review.`, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);

  await page.getByRole('button', { name: 'Focus mode' }).click();
  await expect(page.locator('.workspace-sidebar')).toBeHidden();
  await page.getByRole('button', { name: 'Focus mode' }).click();
  // Switching away during a fit change must not paginate a zero-width canvas.
  await page.getByRole('button', { name: 'Compare documents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Two drafts. The full story.' })).toBeVisible();
  await page.getByRole('button', { name: 'Document workspace', exact: true }).click();
  await expect(document.getByText(title, { exact: true })).toBeVisible();
  await expect(page.locator('.workspace-document [aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('studio keeps the document and tools usable on a narrow screen with dark OS preferences', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const noOverflow = () => expect.poll(() => page.evaluate(() => window.document.documentElement.scrollWidth - window.document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await noOverflow();
  await page.getByRole('button', { name: 'Explore a sample document' }).click();
  const document = page.locator('.workspace-document #pagination-container');
  await expect(document.getByText(title, { exact: true })).toBeInViewport();
  await noOverflow();
  await page.getByRole('button', { name: 'comments', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Comments' }).getByText(/Could we include the offline HTML copy/)).toBeVisible();
  await page.getByRole('button', { name: 'history', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Checkpoint label' })).toBeVisible();
  await page.getByRole('button', { name: 'Focus mode' }).click();
  await expect(page.locator('.workspace-sidebar')).toBeHidden();
  await expect(document.getByText(title, { exact: true })).toBeInViewport();
  await noOverflow();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
