import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { cooperativePagination } from '../../src/rendering/cooperativePagination';

declare global { interface Window { cooperativePagination: typeof cooperativePagination } }

test('cooperative pagination preserves native pages, fragments, notes, tables and running stories', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.cooperativePagination);
  const fixture = process.env.RDV_STRESS_DOCX ? Array.from(await readFile(process.env.RDV_STRESS_DOCX)) : undefined;
  const result = await page.evaluate(async fixture => {
    const c = new window.rdv.DocxSessionController();
    const s = await c.open(fixture ? new Uint8Array(fixture) : 'blank', { emitMarkdownPatch: false }, '/wasm/');
    if (!fixture) {
      const anchor = Object.keys(c.getAnchorIndex())[0];
      s.replaceText(anchor, 'A paragraph that crosses a page with a footnote and keeps every word. '.repeat(120));
      s.insertFootnote(anchor, 8, 'A long continued footnote. '.repeat(120));
      s.insertTable(anchor, 'after', 8, 3);
      s.setHeaderText(anchor, 'default', 'A repeated header');
      s.setFooterText(anchor, 'default', 'A repeated footer');
    }
    const html = await window.rdv.convertDocxToHtml(c.save(), { paginationMode: window.rdv.PaginationMode.Paginated, stampAnchors: true });
    c.close();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(node => node.remove());
    const outputs = [];
    let turns = 0;
    for (const mode of ['native', 'cooperative', 'cancel']) {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'width:1200px;height:800px;border:0';
      const ready = new Promise<void>(resolve => { frame.onload = () => resolve(); });
      frame.srcdoc = parsed.documentElement.outerHTML; document.body.append(frame); await ready;
      const doc = frame.contentDocument!;
      doc.body.getBoundingClientRect(); await doc.fonts.ready;
      const engine = new window.rdv.PaginationEngine(doc.getElementById('pagination-staging')!, doc.getElementById('pagination-container')!, { fragmentParagraphs: true, scale: 1 });
      const timer = setInterval(() => { turns++; }, 0);
      let interrupted = false;
      const abort = new AbortController();
      if (mode === 'cancel') setTimeout(() => abort.abort(), 0);
      try {
        const asyncEngine = window.cooperativePagination(engine, () => { if (abort.signal.aborted) throw new DOMException('Cancelled', 'AbortError'); }, async () => {});
        const pages = mode === 'native' ? engine.paginate() : await asyncEngine.paginate();
        const map = mode === 'native' ? engine.materializePageMap(0, 'differential') : await asyncEngine.materializePageMap(0, 'differential');
        outputs.push({ map, html: pages.pages.map(page => page.element.outerHTML) });
      } catch (error) {
        if (mode !== 'cancel' || !(error instanceof DOMException) || error.name !== 'AbortError') throw error;
        interrupted = true;
      } finally { clearInterval(timer); frame.remove(); }
      if (mode === 'native' && turns !== 0) throw new Error('Unexpected interleaving in native baseline');
      if (mode === 'cancel' && !interrupted) throw new Error('Obsolete pagination completed after cancellation');
    }
    return { outputs, turns };
  }, fixture);
  expect(result.outputs[0].map.pages.length).toBeGreaterThan(1);
  expect(result.outputs[1]).toEqual(result.outputs[0]);
  expect(result.turns).toBeGreaterThan(2);
});
