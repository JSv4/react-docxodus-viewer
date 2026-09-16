import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { visibleBlockText } from '../../src/editing/text';

declare global { interface Window { visibleBlockText: typeof visibleBlockText } }

test('lightweight visible text matches native enriched metadata including numbering and special Word runs', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.visibleBlockText);
  const fixture = process.env.RDV_STRESS_DOCX ? Array.from(await readFile(process.env.RDV_STRESS_DOCX)) : undefined;
  const result = await page.evaluate(async fixture => {
    const c = new window.rdv.DocxSessionController();
    const s = await c.open(fixture ? new Uint8Array(fixture) : 'blank', { emitMarkdownPatch: false }, '/wasm/');
    if (!fixture) {
      const first = Object.keys(c.getAnchorIndex())[0];
      s.replaceText(first, 'Text & symbols 😀');
      s.applyListFormat(first, 'decimal');
      const xml = new DOMParser().parseFromString(s.raw.getXml(first), 'application/xml');
      const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const text = xml.getElementsByTagNameNS(w, 't')[0];
      for (const name of ['br', 'tab', 'noBreakHyphen']) text.after(xml.createElementNS(w, `w:${name}`));
      s.raw.replaceXml(first, new XMLSerializer().serializeToString(xml));
      const inserted = s.insertParagraph(first, 'after', 'An empty list item.');
      const second = inserted.created.find(ref => /^(p|h|li)$/.test(ref.kind))!.id;
      s.applyListFormat(second, 'bullet');
      s.replaceTextRange(second, 'An empty list item.', '');
      s.insertFootnote(first, 0, 'Footnote text.');
      s.insertTable(first, 'after', 2, 2);
      s.setHeaderText(first, 'default', 'Header text.');
    }
    const ids = Object.keys(c.getAnchorIndex());
    const bridge = window.rdv.getWasmExports().DocxSessionBridge;
    const original = bridge.GetAnchorInfo;
    let metadataCalls = 0;
    bridge.GetAnchorInfo = (...args) => { metadataCalls++; return original(...args); };
    const fast = ids.map(id => window.visibleBlockText(s, id));
    const fallbackCalls = metadataCalls;
    const native = ids.map(id => s.getAnchorInfo(id)?.visibleText ?? null);
    c.close();
    return { ids, fast, native, fallbackCalls };
  }, fixture);
  expect(result.fallbackCalls).toBe(0);
  expect(result.fast).toEqual(result.native);
  expect(result.ids.length).toBeGreaterThan(5);
});
