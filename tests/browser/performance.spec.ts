import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { DocxSessionController, PageMap } from '../../src';

interface Measurement { count: number; ms: number; max: number }
interface Event { name: string; at: number }
interface Phase {
  name: string;
  events: Event[];
  calls: Record<string, Measurement>;
  longTasks: { at: number; ms: number }[];
}
declare global {
  interface Window {
    performanceTest: {
      controller: DocxSessionController; map?: PageMap; errors: string[];
      events: Event[]; calls: Record<string, Measurement>; longTasks: { at: number; ms: number }[];
      targets: string[];
    };
  }
}

async function settled(page: Page) {
  await page.waitForFunction(() => {
    const state = window.performanceTest;
    return state.map?.documentVersion === state.controller.getSnapshot().version &&
      !document.querySelector('.rdv-conversion-progress, .rdv-paginated-document[aria-busy="true"]');
  }, undefined, { timeout: 90_000 });
  // Allow the Long Tasks observer to deliver the task containing the last callback.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function capture(page: Page, name: string): Promise<Phase> {
  return page.evaluate(name => {
    const { events, calls, longTasks } = window.performanceTest;
    const start = events[0].at;
    return { name, events: events.map(event => ({ ...event, at: Math.round(event.at - start) })),
      calls: Object.fromEntries(Object.entries(calls).map(([name, value]) => [name, { count: value.count, ms: Math.round(value.ms), max: Math.round(value.max) }])),
      longTasks: longTasks.map(task => ({ at: Math.round(task.at - start), ms: Math.round(task.ms) })) };
  }, name);
}
async function start(page: Page, name: string) {
  await page.evaluate(name => {
    const state = window.performanceTest;
    state.events = [{ name, at: performance.now() }]; state.calls = {}; state.longTasks = [];
  }, name);
}

test('NVCA performance: cold open, zoom, typing, native commit, and complete page layout', async ({ page, browser }, testInfo) => {
  test.skip(!process.env.RDV_PERFORMANCE, 'Run npm run test:performance to use the pinned NVCA fixture.');
  test.setTimeout(300_000);
  const bytes = readFileSync(process.env.RDV_STRESS_DOCX!);
  const hash = createHash('sha256').update(bytes).digest('hex');
  expect(hash).toBe('d75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29');
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1480, height: 1050 });
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  await page.evaluate(async bytes => {
    const controller = new window.rdv.DocxSessionController();
    const state = window.performanceTest = {
      controller, errors: [] as string[], events: [] as Event[], calls: {} as Record<string, Measurement>,
      longTasks: [] as { at: number; ms: number }[], targets: [] as string[], map: undefined as PageMap | undefined,
    };
    const event = (name: string) => state.events.push({ name, at: performance.now() });
    new PerformanceObserver(list => state.longTasks.push(...list.getEntries().map(entry => ({ at: entry.startTime, ms: entry.duration })))).observe({ type: 'longtask' });
    // Instrument the actual core objects used by the mounted components. No
    // source-only timers, network mocks, or duplicate dynamic module instances.
    const wrap = (target: object, name: string) => {
      const original = Reflect.get(target, name) as (...args: unknown[]) => unknown;
      Reflect.set(target, name, function (this: unknown, ...args: unknown[]) {
        const start = performance.now();
        try { return Reflect.apply(original, this, args); }
        finally {
          const ms = performance.now() - start;
          const calls = state.calls[name] ??= { count: 0, ms: 0, max: 0 };
          calls.count++; calls.ms += ms; calls.max = Math.max(calls.max, ms);
        }
      });
    };
    // This native helper runs exactly once at the start of both synchronous
    // and cooperative pagination. Its count measures full flow attempts; its
    // duration is only registry parsing, not the asynchronous layout duration.
    for (const name of ['parseHeaderFooterRegistry', 'normalizePageMapFragmentIdentities', 'materializePageMap']) wrap(window.rdv.PaginationEngine.prototype, name);
    event('open:start');
    const session = await controller.open(new Uint8Array(bytes), { emitMarkdownPatch: false }, '/wasm/');
    event('open:end');
    const anchors = Object.entries(session.project().anchorIndex);
    const body = anchors.filter(([, anchor]) => anchor.scope === 'body' && ['p', 'h', 'li'].includes(anchor.kind));
    const notes = anchors.filter(([, anchor]) => anchor.scope === 'fn' && ['p', 'h', 'li'].includes(anchor.kind));
    state.targets = [body[0][0], body[Math.floor(body.length / 2)][0], notes[Math.floor(notes.length / 2)][0]];
    const native = controller.read(session => session);
    for (const name of ['project', 'getFormatting', 'getAnchorInfos', 'listRevisions', 'listStyles', 'save', 'replaceMatch', 'executeBatch', 'renderBlock']) wrap(native, name);
    wrap(controller, 'renderBlocks');
    event('mount');
    window.mountEditors([{ session: controller, wasmBasePath: '/wasm/', style: { height: '100vh' },
      viewerProps: { onConversionStart: () => event('convert:start'), onConversionComplete: () => event('convert:end'),
        onPageMap: map => { state.map = map; event('layout:end'); } },
      onChange: () => event('change'), onError: error => state.errors.push(error.message),
    }]);
  }, [...bytes]);
  await settled(page);
  const phases: Phase[] = [await capture(page, 'open')];
  const pageCount = await page.evaluate(() => window.performanceTest.map!.pages.length);
  expect(pageCount).toBe(65);
  // Count-based guards are portable across machines. Timings are reported, not
  // asserted against arbitrary wall-clock budgets on shared CI runners.
  expect(phases[0].calls.parseHeaderFooterRegistry.count).toBe(1);
  for (const zoom of ['0.5', '2', '1']) {
    await start(page, 'zoom:start');
    const firstPage = page.locator('#pagination-container .page-box').first();
    await firstPage.evaluate(element => { (element as HTMLElement).dataset.benchmarkPage = 'retained'; });
    await page.getByRole('combobox', { name: 'Zoom level', exact: true }).selectOption(zoom);
    await expect.poll(() => firstPage.evaluate(element => getComputedStyle(element).zoom)).toBe(zoom);
    await settled(page);
    await expect(firstPage).toHaveAttribute('data-benchmark-page', 'retained');
    expect(await page.evaluate(() => window.performanceTest.map!.pages.length)).toBe(pageCount);
    const phase = await capture(page, `zoom:${zoom}`);
    expect(phase.calls.parseHeaderFooterRegistry?.count ?? 0).toBe(0);
    expect(phase.calls.getFormatting?.count ?? 0).toBeLessThan(5);
    phases.push(phase);
  }
  for (let index = 0; index < 3; index++) {
    const id = await page.evaluate(index => window.performanceTest.targets[index], index);
    const paragraph = page.locator(`#pagination-container [data-source-anchor-id="${id}"][data-rdv-editable="true"]`).last();
    await paragraph.click(); await page.keyboard.press('End');
    const before = await page.evaluate(id => window.performanceTest.controller.read(s => s.getFormatting(id)!.runs.map(r => r.text).join('')), id);
    await page.locator('#pagination-container .page-box').first().evaluate(element => { (element as HTMLElement).dataset.benchmarkPage = 'retained'; });
    await start(page, 'type:start');
    const marker = ` [Speed check ${index + 1}]`;
    await page.keyboard.type(marker, { delay: 15 });
    await page.evaluate(() => window.performanceTest.events.push({ name: 'type:end', at: performance.now() }));
    await page.waitForFunction(() => window.performanceTest.events.some(e => e.name === 'change'));
    await settled(page);
    const phase = await capture(page, `edit:${index + 1}`);
    // Unchanged native paragraph subtrees must not have their run formatting
    // recomputed. A contiguous insertion must remain a single native write.
    expect(phase.calls.getFormatting.count).toBeLessThan(25);
    expect(phase.calls.replaceMatch.count).toBe(1);
    expect(phase.calls.executeBatch?.count ?? 0).toBe(0);
    expect(phase.calls.save?.count ?? 0).toBe(0);
    expect(phase.calls.project?.count ?? 0).toBe(0);
    expect(phase.calls.renderBlocks.count).toBe(1);
    expect(phase.events.some(event => event.name === 'convert:start')).toBe(false);
    if (index < 2) {
      expect(phase.calls.parseHeaderFooterRegistry?.count ?? 0).toBe(0);
      await expect(page.locator('#pagination-container .page-box').first()).toHaveAttribute('data-benchmark-page', 'retained');
    } else expect(phase.calls.parseHeaderFooterRegistry?.count ?? 0).toBe(1); // Footnote reserves need reflow.
    phases.push(phase);
    const after = await page.evaluate(id => window.performanceTest.controller.read(s => s.getFormatting(id)!.runs.map(r => r.text).join('')), id);
    expect(after.replace(marker, '')).toBe(before);
    await expect(paragraph).toContainText(marker);
  }
  expect(await page.evaluate(() => window.performanceTest.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
  const report = { fixture: hash, browser: browser.version(), viewport: { width: 1480, height: 1050 }, pageCount,
    notes: 'Cold core/worker per fresh browser context; editor mounts after native open. Native editor profile: emitMarkdownPatch false. Typing uses 15 ms per character and a 350 ms commit debounce. Nested method timings overlap.', phases };
  const json = JSON.stringify(report, null, 2);
  writeFileSync(testInfo.outputPath('NVCA-performance.json'), json);
  await testInfo.attach('NVCA performance', { body: json, contentType: 'application/json' });
  for (const phase of phases) console.info(`${phase.name}: ${phase.events.map(e => `${e.name} ${e.at} ms`).join(', ')}`);
});
