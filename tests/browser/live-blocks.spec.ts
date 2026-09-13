import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { DocxSessionController, PageMap } from '../../src';

declare global {
  interface Window {
    liveTest: { controller: DocxSessionController; anchor: string; map?: PageMap; conversions: number; errors: string[] };
  }
}

async function settled(page: Page) {
  await page.waitForFunction(() => window.liveTest.map?.documentVersion === window.liveTest.controller.getSnapshot().version);
  await expect(page.locator('.rdv-paginated-document[aria-busy="true"], .rdv-conversion-progress')).toHaveCount(0);
}

test('live blocks retain pages for text/formatting, reflow wrapping from source, and reject a replaced owner', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  await page.evaluate(async () => {
    const controller = new window.rdv.DocxSessionController();
    const s = await controller.open('blank', { emitMarkdownPatch: false }, '/wasm/');
    const anchor = Object.keys(controller.getAnchorIndex())[0];
    s.replaceText(anchor, 'Alpha beta.');
    s.insertParagraph(anchor, 'after', 'Following paragraph.');
    window.liveTest = { controller, anchor, conversions: 0, errors: [] };
    window.mountEditors([{ session: controller, wasmBasePath: '/wasm/', viewerProps: {
      rendererFingerprint: 'live-block-test', defaultZoom: 1,
      onConversionStart: () => window.liveTest.conversions++, onPageMap: map => { window.liveTest.map = map; },
    }, onError: error => window.liveTest.errors.push(error.message) }]);
  });
  await settled(page);
  const firstPage = page.locator('#pagination-container .page-box').first();
  await firstPage.evaluate(element => { (element as HTMLElement).dataset.liveRetained = 'true'; });
  const first = page.getByRole('textbox', { name: 'Document paragraph', exact: true }).first();
  await first.click(); await page.keyboard.press('End'); await page.keyboard.type(' More.');
  await expect.poll(() => page.evaluate(() => window.liveTest.controller.getSnapshot().version)).toBe(3);
  await settled(page);
  await expect(firstPage).toHaveAttribute('data-live-retained', 'true');
  await expect(first).toContainText('Alpha beta. More.');
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await settled(page);
  await expect(firstPage).toHaveAttribute('data-live-retained', 'true');
  await expect(first.locator('span').filter({ hasText: /^Alpha$/ })).toHaveCSS('font-weight', '700');
  expect(await page.evaluate(() => window.liveTest.conversions)).toBe(1);

  // Browser typing changes height BEFORE commit. The saved layout measurements
  // must detect that, then reflow the source with all previous live edits intact.
  await first.click(); await page.keyboard.press('End');
  await page.keyboard.insertText(' A sentence that changes line wrapping.'.repeat(12));
  await expect.poll(() => page.evaluate(() => window.liveTest.controller.getSnapshot().version)).toBe(5);
  await settled(page);
  await expect(firstPage).not.toHaveAttribute('data-live-retained');
  await expect(first).toContainText('Alpha beta. More.');
  await expect(first.locator('span').filter({ hasText: /^Alpha$/ })).toHaveCSS('font-weight', '700');
  expect(await page.evaluate(() => window.liveTest.conversions)).toBe(1);
  expect(await page.evaluate(() => {
    const { controller, anchor } = window.liveTest;
    return controller.read(s => s.getPageCitation(anchor, { documentVersion: s.getVersion(), rendererFingerprint: 'live-block-test' }).availability);
  })).toBe('available');

  await page.evaluate(async () => {
    const { controller } = window.liveTest;
    // The replacement reaches the SAME numeric version as the previous owner.
    const s = await controller.open('blank', { emitMarkdownPatch: false }, '/wasm/');
    const anchor = Object.keys(controller.getAnchorIndex())[0];
    for (let i = 0; i < 5; i++) s.replaceText(anchor, `Replacement ${i}.`);
    window.liveTest.anchor = anchor; window.liveTest.map = undefined;
  });
  await settled(page);
  await expect(first).toHaveText('Replacement 4.');
  // Opening publishes version zero before the caller's follow-up edits; that
  // intermediate conversion may start and be superseded by the final version.
  expect(await page.evaluate(() => window.liveTest.conversions)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.liveTest.errors)).toEqual([]);
});
