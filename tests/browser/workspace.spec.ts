import { expect, test } from '@playwright/test';

test('React workspace edits, paginates, comments, saves and restores a checkpoint', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Selected block' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Markdown content' }).fill('A test agreement with a reviewable clause.');
  await page.getByRole('button', { name: 'Replace selected block' }).click();
  await expect(page.locator('.workspace-document #pagination-container').getByText('A test agreement with a reviewable clause.', { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const zoom = Number(await page.getByRole('combobox', { name: 'Zoom level' }).inputValue());
    return await page.locator('.workspace-document .page-box').evaluate(element => Number((element as HTMLElement).style.zoom || 1)) === zoom;
  }).toBe(true);
  await page.locator('.workspace-document #pagination-container').getByText('A test agreement with a reviewable clause.', { exact: true }).click();
  await page.getByRole('button', { name: 'comments', exact: true }).click();
  await page.getByRole('textbox', { name: 'New comment' }).fill('Please review this clause.');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Comments' }).getByText('Please review this clause.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'history', exact: true }).click();
  await page.getByRole('textbox', { name: 'Checkpoint label' }).fill('First review');
  await expect(page.getByRole('button', { name: 'Save checkpoint' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save checkpoint' }).click();
  await expect(page.getByRole('radio', { name: 'First review' })).toBeVisible();
  await page.getByRole('radio', { name: 'First review' }).check();
  await page.getByRole('button', { name: 'edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Markdown content' }).fill('A later document state.');
  await page.getByRole('button', { name: 'Replace selected block' }).click();
  await expect(page.locator('.workspace-document #pagination-container').getByText('A later document state.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'history', exact: true }).click();
  await page.getByRole('radio', { name: 'First review' }).check();
  await page.getByRole('button', { name: 'Restore selected checkpoint' }).click();
  await expect(page.locator('.workspace-document #pagination-container').getByText('A test agreement with a reviewable clause.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/workspace.png', fullPage: true });
  await page.getByRole('button', { name: 'export', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download standalone HTML' }).click();
  expect((await downloading).suggestedFilename()).toBe('document.html');
  await expect(page.getByText('Render report and page map')).toBeVisible();
  expect(errors).toEqual([]);
});

test('standalone HTML export produces an offline artifact and report', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex)[0];
    session.replaceText(anchor, 'An offline document artifact.');
    const exporter = await api.loadBrowserExporter('/export-browser.bundle.js');
    const output = await exporter.convertDocxToPaginatedHtml(controller.save(), { reviewProfile: 'final', commentProfile: 'hidden', wasmBasePath: '/wasm/' });
    controller.close();
    return { html: output.html, pageCount: output.pageCount, schema: output.renderReport.schema, mapPages: output.pageMap.pages.length };
  });
  expect(result.pageCount).toBeGreaterThan(0);
  expect(result.mapPages).toBe(result.pageCount);
  expect(result.schema).toContain('render-report/v2');
  await page.route('**/*', route => route.abort());
  await page.setContent(result.html);
  await expect(page.getByText('An offline document artifact.', { exact: true })).toBeVisible();
});
