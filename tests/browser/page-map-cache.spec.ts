import { expect, test } from '@playwright/test';
import type { PageMap } from '../../src';

test('cached layout registration matches native validation and every citation surface', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const c = new window.rdv.DocxSessionController();
    let s = await c.open('blank', { emitMarkdownPatch: false }, '/wasm/');
    const anchor = Object.keys(c.getAnchorIndex())[0];
    s.replaceText(anchor, 'Alpha beta.');
    s.insertTable(anchor, 'after', 1, 1);
    s.insertFootnote(anchor, 0, 'A footnote.');
    const bytes = c.save();
    s = await c.open(bytes, { emitMarkdownPatch: false }, '/wasm/');
    const native = window.rdv.openDocxSession(bytes, { persistAnchorIds: true, emitMarkdownPatch: false });
    const entries = Object.entries(c.getAnchorIndex());
    const cell = entries.find(([, item]) => item.kind === 'tc')![0];
    const note = entries.find(([, item]) => item.kind === 'p' && item.scope === 'fn')![0];
    const map: PageMap = { schemaVersion: 1, mode: 'paginated', availability: 'available', documentVersion: 0, rendererFingerprint: 'map-cache',
      pages: [{ pageNumber: 1, pageInSection: 1, width: 612, height: 792, sectionIndex: 0, pageName: 'section-0' }],
      fragments: [anchor, cell, note].map((id, i) => ({ fragmentId: `fragment-${i}`, anchorId: id, fragmentIndex: 0, pageNumber: 1,
        geometry: { x: 72, y: 72 + i * 30, width: 200, height: 20 }, story: i === 2 ? 'footnote' : 'body', inTableCell: i === 1 })) };
    const bridge = window.rdv.getWasmExports().DocxSessionBridge;
    const register = bridge.RegisterPageMap;
    let calls = 0;
    bridge.RegisterPageMap = (...args) => { calls++; return register(...args); };
    const results: { cached: unknown; native: unknown }[] = [];
    results.push({ cached: s.registerPageMap(map, 'map-cache'), native: native.registerPageMap(map, 'map-cache') });
    s.applyFormat(anchor, null, { bold: true }); native.applyFormat(anchor, null, { bold: true });
    map.documentVersion = s.getVersion(); map.fragments[0].geometry.width = 220;
    calls = 0;
    const registered = s.registerPageMap(map, 'map-cache');
    const localCalls = calls;
    results.push({ cached: registered, native: native.registerPageMap(map, 'map-cache') });
    const request = { documentVersion: map.documentVersion, rendererFingerprint: 'map-cache' };
    for (const input of [undefined, request, { ...request, documentVersion: 999 }, { ...request, rendererFingerprint: 'other' }]) {
      results.push({ cached: s.getPageMapStatus(input), native: native.getPageMapStatus(input) });
      if (input) for (const id of [anchor, cell, note, 'p:body:missing']) results.push({ cached: s.getPageCitation(id, input), native: native.getPageCitation(id, input) });
    }
    results.push({ cached: s.projectAnchor(anchor, undefined, request), native: native.projectAnchor(anchor, undefined, request) });
    results.push({ cached: s.grep('Alpha', { citation: request }), native: native.grep('Alpha', { citation: request }) });
    results.push({ cached: s.grepCrossBlock('Alpha', { citation: request }), native: native.grepCrossBlock('Alpha', { citation: request }) });
    results.push({ cached: s.findByKind('p', undefined, request), native: native.findByKind('p', undefined, request) });
    results.push({ cached: s.findByText('Alpha', { citation: request }), native: native.findByText('Alpha', { citation: request }) });
    // Caller mutations must not rewrite a previously registered layout.
    map.fragments[0].geometry.width = 240;
    results.push({ cached: s.getPageCitation(anchor, request), native: native.getPageCitation(anchor, request) });
    const transforms: ((value: PageMap) => void)[] = [
      value => { value.documentVersion = 999; },
      value => { value.rendererFingerprint = 'other'; },
      value => { value.fragments[1].fragmentId = value.fragments[0].fragmentId; },
      value => { value.fragments[0].geometry.width = 0; },
      value => { value.fragments[0].geometry.x = 700; },
      value => { value.pages[0].pageInSection = 2; },
      value => { value.fragments[0].fragmentIndex = 1; },
      value => { value.fragments[1].inTableCell = false; },
      value => { value.fragments[0].anchorId = 'p:body:missing'; },
      value => { value.fragments[0].story = 'footnote'; },
      value => { value.pages[0].sectionIndex = 2 ** 40; },
    ];
    const attempt = (action: () => unknown) => { try { return action(); } catch (error) { return { error: String(error) }; } };
    for (const transform of transforms) {
      const candidate = structuredClone(map); transform(candidate);
      results.push({ cached: attempt(() => s.registerPageMap(candidate, 'map-cache')), native: attempt(() => native.registerPageMap(candidate, 'map-cache')) });
    }
    for (const invalid of [{ ...request, documentVersion: 0.5 }, { ...request, extra: true }, { ...request, rendererFingerprint: null }]) {
      const input = invalid as unknown as typeof request;
      results.push({ cached: attempt(() => s.getPageMapStatus(input)), native: attempt(() => native.getPageMapStatus(input)) });
      results.push({ cached: attempt(() => s.getPageCitation(anchor, input)), native: attempt(() => native.getPageCitation(anchor, input)) });
    }
    s.insertParagraph(anchor, 'after', 'A structural change.'); native.insertParagraph(anchor, 'after', 'A structural change.');
    map.documentVersion = s.getVersion(); calls = 0;
    const structural = s.registerPageMap(map, 'map-cache');
    const structuralCalls = calls;
    results.push({ cached: structural, native: native.registerPageMap(map, 'map-cache') });
    // Even a read-callback escape-hatch mutation must invalidate the reuse proof.
    c.read(current => current.applyFormat(anchor, null, { italic: true })); native.applyFormat(anchor, null, { italic: true });
    map.documentVersion = native.getVersion(); calls = 0;
    const unknown = s.registerPageMap(map, 'map-cache');
    const unknownCalls = calls;
    results.push({ cached: unknown, native: native.registerPageMap(map, 'map-cache') });
    // Shadow sessions, rollback and a later stale map retain native semantics.
    s.applyFormat(anchor, null, { bold: false }); native.applyFormat(anchor, null, { bold: false });
    map.documentVersion = s.getVersion();
    s.registerPageMap(map, 'map-cache'); native.registerPageMap(map, 'map-cache');
    let shadowCached: unknown, shadowNative: unknown;
    s.previewBatch([{ tool: 'test', action: 'preview', mutation: current => { shadowCached = current.getPageMapStatus(); return current.applyFormat(anchor, null, { italic: false }); } }]);
    native.previewBatch([{ tool: 'test', action: 'preview', mutation: current => { shadowNative = current.getPageMapStatus(); return current.applyFormat(anchor, null, { italic: false }); } }]);
    results.push({ cached: shadowCached, native: shadowNative });
    results.push({ cached: s.getPageMapStatus(), native: native.getPageMapStatus() });
    s.undo(); native.undo();
    results.push({ cached: s.getPageMapStatus(), native: native.getPageMapStatus() });
    native.close(); c.close();
    return { results, localCalls, structuralCalls, unknownCalls };
  });
  for (const [i, pair] of result.results.entries()) expect(pair.cached, `native contract case ${i}`).toEqual(pair.native);
  expect(result.localCalls).toBe(0);
  expect(result.structuralCalls).toBe(1);
  expect(result.unknownCalls).toBe(1);
});
