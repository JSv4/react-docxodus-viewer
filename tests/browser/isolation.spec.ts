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

test('a document lays out as in its own page, whatever text styles its host inherits', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountViewers);
  const layouts = await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    const s = await controller.open('blank', {}, '/wasm/');
    let anchor = Object.keys(s.project().anchorIndex)[0];
    for (let i = 0; i < 60; i++) {
      s.replaceText(anchor, (`Paragraph ${i} without its own line spacing, long enough to wrap across the measure of the page. `).repeat(3));
      anchor = s.insertParagraph(anchor, 'after', 'Next.').created[0].id;
    }
    const html = await api.convertDocxToHtml(controller.save(), { paginationMode: api.PaginationMode.Paginated, stampAnchors: true });
    controller.close();
    const layoutToken = { documentVersion: 0, rendererFingerprint: 'isolation' };
    const summary = (map: { pages: unknown[]; fragments: { anchorId: string; pageNumber: number; geometry: { y: number; height: number } }[] }) => ({
      pages: map.pages.length,
      fragments: map.fragments.map(f => ({ at: `${f.anchorId}@${f.pageNumber}`, y: f.geometry.y, height: f.geometry.height })),
    });
    // The engine alone, in a document of its own.
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1200px;height:800px;border:0';
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(node => node.remove());
    const ready = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    frame.srcdoc = `<!doctype html>${parsed.documentElement.outerHTML}`; document.body.append(frame); await ready;
    const own = frame.contentDocument!;
    own.body.getBoundingClientRect(); await own.fonts.ready;
    const native = new api.PaginationEngine(own.getElementById('pagination-staging')!, own.getElementById('pagination-container')!, { scale: 1, fragmentParagraphs: true, layoutToken }).paginate();
    frame.remove();
    // The viewer, inside a host whose inherited text styles differ in every way.
    const viewed = await new Promise<Parameters<typeof summary>[0]>(resolve => window.mountViewers([{ html, layoutToken,
      style: { direction: 'rtl', font: 'italic bold 12px/1.5 monospace', letterSpacing: '2px', wordSpacing: '4px', textTransform: 'uppercase', textIndent: '30px', color: 'rgb(200, 0, 0)' },
      onPaginationComplete: result => { if (result.pageMap) resolve(result.pageMap); } }]));
    return { native: summary(native.pageMap!), viewed: summary(viewed) };
  });
  expect(layouts.native.pages).toBeGreaterThan(1);
  // Same pages and fragments; positions agree to sub-pixel rounding.
  expect(layouts.viewed.pages).toBe(layouts.native.pages);
  expect(layouts.viewed.fragments.map(f => f.at)).toEqual(layouts.native.fragments.map(f => f.at));
  layouts.viewed.fragments.forEach((fragment, i) => {
    expect(Math.abs(fragment.y - layouts.native.fragments[i].y)).toBeLessThan(0.5);
    expect(Math.abs(fragment.height - layouts.native.fragments[i].height)).toBeLessThan(0.5);
  });
  const paragraph = page.locator('#pagination-container p').first();
  await expect(paragraph).toHaveCSS('letter-spacing', 'normal');
  await expect(paragraph).toHaveCSS('text-transform', 'none');
  await expect(paragraph).toHaveCSS('color', 'rgb(0, 0, 0)');
});
