import { expect, test } from '@playwright/test';
import type { DocumentViewerProps, DocxSessionController, PageMap } from '../../src';

declare global {
  interface Window {
    mountViewers: (props: DocumentViewerProps[]) => void;
    layoutTest: { controller: DocxSessionController; map?: PageMap; errors: string[]; anchor: string };
  }
}

test('fragmented pagination registers exact citations and invalidates them after edits', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountViewers);
  await page.evaluate(async () => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex)[0];
    session.replaceText(anchor, 'A long paragraph that must cross a page boundary. '.repeat(220));
    window.layoutTest = { controller, anchor, errors: [] };
    window.mountViewers([{ session: controller, useWorker: false, wasmBasePath: '/wasm/', rendererFingerprint: 'pagination-test',
      onPageMap: map => { window.layoutTest.map = map; }, onError: error => window.layoutTest.errors.push(error.message),
      style: { height: 500 }, defaultSettings: { paginationScale: 0.6, fragmentParagraphs: true } }]);
  });
  await page.waitForFunction(() => !!window.layoutTest.map);
  const first = await page.evaluate(() => {
    const { controller, map, anchor } = window.layoutTest;
    const s = controller.getSnapshot().session!;
    const citation = s.getPageCitation(anchor, { documentVersion: s.getVersion(), rendererFingerprint: 'pagination-test' });
    const wrongRenderer = s.getPageCitation(anchor, { documentVersion: s.getVersion(), rendererFingerprint: 'wrong-renderer' });
    s.insertParagraph(anchor, 'after', 'An additional paragraph.');
    const stale = s.getPageMapStatus({ documentVersion: s.getVersion(), rendererFingerprint: 'pagination-test' });
    return { pages: map!.pages.length, fragments: citation.fragments.length, availability: citation.availability, wrongRenderer: wrongRenderer.unavailableReason, stale: stale.unavailableReason };
  });
  expect(first.pages).toBeGreaterThan(1);
  expect(first.fragments).toBeGreaterThan(1);
  expect(first.availability).toBe('available');
  expect(first.wrongRenderer).toBe('renderer_fingerprint_mismatch');
  expect(first.stale).toBe('stale_document_version');
  await page.waitForFunction(() => window.layoutTest.map?.documentVersion === window.layoutTest.controller.getSnapshot().version);
  const refreshed = await page.evaluate(() => {
    const s = window.layoutTest.controller.getSnapshot().session!;
    return { status: s.getPageMapStatus({ documentVersion: s.getVersion(), rendererFingerprint: 'pagination-test' }), errors: window.layoutTest.errors };
  });
  expect(refreshed.status.availability).toBe('available');
  expect(refreshed.errors).toEqual([]);
  await page.getByRole('button', { name: 'Next Page' }).click();
  await expect(page.getByRole('spinbutton')).not.toHaveValue('1');
  await page.getByRole('combobox', { name: 'Zoom level' }).selectOption('2');
  await page.locator('.rdv-pages').evaluate(element => { element.scrollTop = 0; });
  await expect(page.getByRole('spinbutton')).toHaveValue('1');
  await page.getByRole('button', { name: 'Next Page' }).click();
  await expect(page.getByRole('spinbutton')).not.toHaveValue('1');
});
