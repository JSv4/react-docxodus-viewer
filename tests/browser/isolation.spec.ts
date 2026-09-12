import { expect, test } from '@playwright/test';

test('two viewers retain isolated root CSS and unique controls', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountViewers);
  await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    session.replaceText(Object.keys(session.project().anchorIndex)[0], 'A styled document.');
    const html = await api.convertDocxToHtml(controller.save(), { paginationMode: api.PaginationMode.Paginated });
    const styled = (color: string) => html.replace('</head>', `<style>:root { --test-color: ${color}; } body { border-top: 3px solid var(--test-color); }</style></head>`);
    window.mountViewers([{ html: styled('rgb(255, 0, 0)'), className: 'viewer-one' }, { html: styled('rgb(0, 0, 255)'), className: 'viewer-two' }]);
    controller.close();
  });
  await expect(page.locator('.viewer-one .page-box')).toBeVisible();
  await expect(page.locator('.viewer-two .page-box')).toBeVisible();
  await expect(page.locator('.viewer-one .rdv-document-body')).toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
  await expect(page.locator('.viewer-two .rdv-document-body')).toHaveCSS('border-top-color', 'rgb(0, 0, 255)');
  const ids = await page.locator('input[type=file]').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(ids).size).toBe(2);
});
