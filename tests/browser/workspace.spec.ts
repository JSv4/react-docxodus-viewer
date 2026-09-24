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
  expect((await downloading).suggestedFilename()).toBe('Untitled document.html');
  await expect(page.getByText('Render report and page map')).toBeVisible();
  expect(errors).toEqual([]);
});

test('standalone HTML export produces an offline artifact and report', async ({ page }) => {
  test.skip(!!process.env.RDV_TEST_PREVIEW, 'The direct engine harness is only available in development; the demo export flow is tested above.');
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

test('quick actions label and comment the selected text, including inside an already-labelled paragraph', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await page.getByRole('textbox', { name: 'Markdown content' }).fill('The purchaser shall indemnify the seller promptly.');
  await page.getByRole('button', { name: 'Replace selected block' }).click();
  const text = page.locator('.workspace-document #pagination-container').getByText('The purchaser shall indemnify the seller promptly.', { exact: true });
  await expect(text).toBeVisible();
  // Labels render inside the paragraph, so address it by role rather than exact text.
  const paragraph = page.locator('.workspace-document').getByRole('textbox', { name: 'Document paragraph' }).first();
  const word = async (value: string) => paragraph.evaluate((element, value) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent!.indexOf(value);
      if (index < 0 || node.parentElement!.closest('.annot-label')) continue;
      const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + value.length);
      const box = range.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    throw new Error(`${value} is not on the page`);
  }, value);
  const quickActions = page.getByRole('toolbar', { name: 'Selected text' });
  const annotations = page.getByRole('region', { name: 'Annotations' });
  const label = async (value: string, name: string) => {
    const point = await word(value);
    await page.mouse.dblclick(point.x, point.y);
    await expect(quickActions).toContainText(`“${value}”`);
    await quickActions.getByRole('button', { name: 'Label' }).click();
    await expect(annotations.getByRole('textbox', { name: 'Annotation label' })).toBeFocused();
    await page.keyboard.type(name);
    await annotations.getByRole('button', { name: 'Annotate selection' }).click();
    await expect(annotations.getByRole('listitem').filter({ hasText: name })).toContainText(value);
  };
  await label('purchaser', 'Party');
  await label('indemnify', 'Obligation');
  await expect(annotations.getByRole('listitem').filter({ hasText: 'Obligation' }).locator('p')).toHaveText('indemnify');
  await expect(page.getByRole('textbox', { name: 'Document paragraph' }).first()).toHaveAttribute('contenteditable', 'true');

  await quickActions.getByRole('button', { name: 'Dismiss quick actions' }).click();
  await expect(quickActions).toHaveCount(0);
  const seller = await word('seller');
  await page.mouse.dblclick(seller.x, seller.y);
  await expect(quickActions).toContainText('“seller”');
  await quickActions.getByRole('button', { name: 'Comment' }).click();
  const comments = page.getByRole('region', { name: 'Comments' });
  await expect(comments.getByRole('textbox', { name: 'New comment' })).toBeFocused();
  await page.keyboard.type('Name the seller entity.');
  await comments.getByRole('button', { name: 'Comment on selection' }).click();
  await expect(comments.locator('.rdv-comment-context')).toHaveText('seller');
  expect(errors).toEqual([]);
});
