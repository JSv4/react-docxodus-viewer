import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const paragraphs = (page: Page) => page.getByRole('textbox', { name: 'Document paragraph', exact: true });
async function open(page: Page, text = 'A sentence on the page.') {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.mountEditors);
  await page.evaluate(async text => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex)[0];
    if (text) session.replaceText(anchor, text);
    window.editorTest = { controllers: [controller], anchor, errors: [], changes: 0 };
    window.mountEditors([{ session: controller, wasmBasePath: '/wasm/', filename: 'On the page.docx',
      onError: error => window.editorTest.errors.push(error.message),
      onChange: () => window.editorTest.changes++, onSave: bytes => { window.editorTest.saved = bytes; } }]);
  }, text);
  await expect(paragraphs(page).first()).toBeVisible();
}
async function nativeText(page: Page) {
  return page.evaluate(() => window.editorTest.controllers[0].read(session => Object.entries(session.project().anchorIndex)
    .filter(([, anchor]) => anchor.scope === 'body' && ['p', 'h', 'li'].includes(anchor.kind))
    .map(([id]) => session.getFormatting(id)!.runs.map(run => run.text).join(''))));
}
async function settled(page: Page) {
  await expect(page.locator('.rdv-paginated-document[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('.rdv-conversion-progress')).toHaveCount(0);
}

test('click, type, keep the caret after reflow, and save the final keystroke into a real DOCX', async ({ page }) => {
  await open(page);
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Typed directly.');
  await expect.poll(() => nativeText(page)).toEqual(['A sentence on the page. Typed directly.']);
  await settled(page);
  // Let the native conversion finish, then continue without clicking again.
  await page.waitForTimeout(1500);
  await page.keyboard.type(' Still here.');
  await page.keyboard.press('Control+s');
  const saved = await page.evaluate(async () => {
    const controller = new window.rdv.DocxSessionController();
    const session = await controller.open(window.editorTest.saved!, {}, '/wasm/');
    const text = session.getFormatting(Object.keys(session.project().anchorIndex)[0])!.runs.map(run => run.text).join('');
    const valid = session.getPackageManifest().isValid;
    controller.close(); return { text, valid, errors: window.editorTest.errors };
  });
  expect(saved).toEqual({ text: 'A sentence on the page. Typed directly. Still here.', valid: true, errors: [] });
  await expect(page.getByRole('textbox', { name: 'Paragraph text', exact: true })).toHaveCount(0);
});

test('Enter splits at the caret, Backspace joins, and undo/redo restore native paragraphs', async ({ page }) => {
  await open(page, 'Hello world.');
  await paragraphs(page).first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('New ');
  await expect.poll(() => nativeText(page)).toEqual(['Hello ', 'New world.']);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect.poll(() => nativeText(page)).toEqual(['Hello New world.']);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual(['Hello ', 'New world.']);
  await page.keyboard.press('Control+y');
  await expect.poll(() => nativeText(page)).toEqual(['Hello New world.']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

for (const action of ['paste beside a numbered list', 'split a bullet item'] as const) test(`${action} avoids a numbering snapshot`, async ({ page }) => {
  await open(page, 'List item.');
  await page.evaluate(action => window.editorTest.controllers[0].run(s => {
    const first = window.editorTest.anchor;
    s.insertParagraph(first, 'after', 'Plain paragraph.');
    s.applyListFormat(first, action.startsWith('paste') ? 'decimal' : 'bullet');
  }), action);
  await expect(paragraphs(page)).toHaveCount(2);
  await expect(paragraphs(page).first().locator('[data-list-marker]').first()).toBeVisible();
  await settled(page);
  await paragraphs(page).nth(action.startsWith('paste') ? 1 : 0).click();
  await page.keyboard.press('End');
  await page.evaluate(() => {
    const bridge = window.rdv.getWasmExports().DocxSessionBridge, save = bridge.SaveWithAnchorIds;
    Reflect.set(window, 'numberingSnapshots', 0);
    bridge.SaveWithAnchorIds = handle => {
      Reflect.set(window, 'numberingSnapshots', Reflect.get(window, 'numberingSnapshots') + 1);
      return save(handle);
    };
  });
  if (action.startsWith('paste')) {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => navigator.clipboard.writeText(' Pasted.'));
    await page.keyboard.press('Control+v');
    await expect.poll(() => nativeText(page)).toEqual(['List item.', 'Plain paragraph. Pasted.']);
  } else {
    await page.keyboard.press('Enter');
    await expect.poll(() => nativeText(page)).toEqual(['List item.', '', 'Plain paragraph.']);
  }
  expect(await page.evaluate(() => Reflect.get(window, 'numberingSnapshots'))).toBe(0);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('collapsed Enter uses one native undo unit and one batch render', async ({ page }) => {
  await open(page, 'Hello world.');
  await paragraphs(page).first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const bridge = window.rdv.getWasmExports().DocxSessionBridge;
    const original = bridge.BeginTransaction;
    const renderOne = bridge.RenderBlockHtml;
    const renderMany = bridge.RenderEditorBlocksHtml;
    const listAnchors = bridge.ListAnchors;
    if (!renderMany || !listAnchors) throw new Error('The pinned native editor bridge is unavailable');
    let measuring = false, scans = 0;
    document.addEventListener('beforeinput', () => {
      measuring = true;
      requestAnimationFrame(() => { measuring = false; Reflect.set(window, 'splitAnchorScansBeforePaint', scans); });
    }, { once: true, capture: true });
    bridge.ListAnchors = handle => {
      if (measuring) scans++;
      return listAnchors(handle);
    };
    Reflect.set(window, 'splitTransactions', 0);
    Reflect.set(window, 'splitSingleRenders', 0);
    Reflect.set(window, 'splitBatchRenders', 0);
    bridge.BeginTransaction = handle => {
      Reflect.set(window, 'splitTransactions', Reflect.get(window, 'splitTransactions') + 1);
      return original(handle);
    };
    bridge.RenderBlockHtml = (...args) => {
      Reflect.set(window, 'splitSingleRenders', Reflect.get(window, 'splitSingleRenders') + 1);
      return renderOne(...args);
    };
    bridge.RenderEditorBlocksHtml = (...args) => {
      Reflect.set(window, 'splitBatchRenders', Reflect.get(window, 'splitBatchRenders') + 1);
      return renderMany(...args);
    };
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => nativeText(page)).toEqual(['Hello ', 'world.']);
  expect(await page.evaluate(() => Reflect.get(window, 'splitTransactions'))).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, 'splitSingleRenders'))).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, 'splitBatchRenders'))).toBe(1);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'splitAnchorScansBeforePaint'))).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual(['Hello world.']);
  await page.keyboard.press('Control+y');
  await expect.poll(() => nativeText(page)).toEqual(['Hello ', 'world.']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('caret formatting applies to new typing and selected text formats only that range', async ({ page }) => {
  await open(page, 'Plain text.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' Bold');
  await page.keyboard.press('Control+b');
  await page.keyboard.type(' plain');
  await page.keyboard.press('Control+s');
  const runs = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs));
  expect(runs.filter(run => run.effective.bold).map(run => run.text).join('')).toBe(' Bold');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.evaluate(() => {
    const bridge = window.rdv.getWasmExports().DocxSessionBridge;
    const original = bridge.GetPackageContentHash!;
    Reflect.set(window, 'formatBatchHashes', 0);
    bridge.GetPackageContentHash = handle => {
      Reflect.set(window, 'formatBatchHashes', Reflect.get(window, 'formatBatchHashes') + 1);
      return original(handle);
    };
  });
  await page.getByRole('button', { name: 'Italic', exact: true }).click();
  const italic = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs.filter(run => run.effective.italic).map(run => run.text).join('')));
  expect(italic).toBe('Plain');
  expect(await page.evaluate(() => Reflect.get(window, 'formatBatchHashes'))).toBe(0);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs.some(run => run.effective.italic)))).toBe(false);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

for (const sample of [
  { name: 'paragraph end', text: 'Plain text.', offset: 11, fast: true },
  { name: 'paragraph start', text: 'Plain text.', offset: 0, fast: true },
  { name: 'empty paragraph', text: '', offset: 0, fast: true },
  { name: 'inside a run', text: 'Plain text.', offset: 3, fast: true },
  { name: 'inside a run with one leading tab', text: 'Plain text.', offset: 3, fast: true, leadingTabs: 1 },
  { name: 'inside a run with two leading tabs', text: 'Plain text.', offset: 3, fast: true, leadingTabs: 2 },
  { name: 'before an identical space', text: 'Plain text.', offset: 5, fast: true },
  { name: 'before identical text', text: ' *B* original', offset: 0, fast: true },
  { name: 'inside a hyperlink', text: 'Plain link text.', markdown: 'Plain [link text.](https://example.com)', offset: 8, fast: false },
]) test(`formatted typing at ${sample.name} preserves surrounding runs and one-step undo`, async ({ page }) => {
  await open(page, sample.leadingTabs ? 'Source' : sample.markdown ?? sample.text.replace(/\*/g, '\\*'));
  if (sample.leadingTabs) {
    await page.evaluate(({tabs, text}) => window.editorTest.controllers[0].run(s => {
      const id = window.editorTest.anchor;
      const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const xml = new DOMParser().parseFromString(s.raw.getXml(id), 'application/xml');
      const node = xml.getElementsByTagNameNS(w, 't')[0];
      node.textContent = text;
      for (let index = 0; index < tabs; index++) node.before(xml.createElementNS(w, 'w:tab'));
      return s.raw.replaceXml(id, new XMLSerializer().serializeToString(xml));
    }), { tabs: sample.leadingTabs, text: sample.text });
    await expect(paragraphs(page).first()).toContainText(sample.text);
    await settled(page);
  }
  await paragraphs(page).first().click();
  // Native text offsets omit the tab's rendered padding. Approach these
  // interior positions from the text's end rather than counting that padding.
  await page.keyboard.press(sample.leadingTabs ? 'End' : 'Home');
  const movements = sample.leadingTabs ? sample.text.length - sample.offset : sample.offset;
  for (let i = 0; i < movements; i++) await page.keyboard.press(sample.leadingTabs ? 'ArrowLeft' : 'ArrowRight');
  await page.keyboard.press('Control+b');
  const before = await page.evaluate(() => {
    const controller = window.editorTest.controllers[0], s = controller.getSnapshot().session!;
    const bridge = window.rdv.getWasmExports().DocxSessionBridge;
    const counts = { formatted: 0, transaction: 0, hash: 0 };
    Reflect.set(window, 'typingCalls', counts);
    const formatted = bridge.ReplaceTextAtSpanWithFormat!, transaction = bridge.BeginTransaction, hash = bridge.GetPackageContentHash!;
    bridge.ReplaceTextAtSpanWithFormat = (...args) => { counts.formatted++; return formatted(...args); };
    bridge.BeginTransaction = (...args) => { counts.transaction++; return transaction(...args); };
    bridge.GetPackageContentHash = (...args) => { counts.hash++; return hash(...args); };
    return { version: s.getVersion(), runs: s.getFormatting(window.editorTest.anchor)!.runs };
  });
  const typed = ' *B* ';
  await page.keyboard.type(typed);
  await expect.poll(() => nativeText(page)).toEqual([sample.text.slice(0, sample.offset) + typed + sample.text.slice(sample.offset)]);
  const after = await page.evaluate(() => window.editorTest.controllers[0].read(s => ({
    version: s.getVersion(), runs: s.getFormatting(window.editorTest.anchor)!.runs,
  })));
  expect(after.version).toBe(before.version + 1);
  expect(after.runs.filter(run => run.effective.bold).map(run => run.text).join('')).toBe(typed);
  expect(after.runs.filter(run => !run.effective.bold).map(run => run.text).join('')).toBe(sample.text);
  if (sample.leadingTabs) {
    const markers = await page.evaluate(() => {
      const xml = new DOMParser().parseFromString(window.editorTest.controllers[0].read(s => s.raw.getXml(window.editorTest.anchor)), 'application/xml');
      let offset = 0;
      const positions = [];
      for (const node of xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', '*')) {
        if (node.localName === 't') offset += node.textContent!.length;
        else if (node.localName === 'tab') positions.push(offset);
      }
      return positions;
    });
    expect(markers).toEqual(Array(sample.leadingTabs).fill(0));
  }
  expect(await page.evaluate(() => Reflect.get(window, 'typingCalls'))).toEqual(sample.fast
    ? { formatted: 1, transaction: 0, hash: 0 } : { formatted: 1, transaction: 1, hash: 1 });
  if (sample.markdown) expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.listHyperlinks()))).toMatchObject([{ target: 'https://example.com/' }]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual([sample.text]);
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs))).toEqual(before.runs);
  await page.keyboard.press('Control+y');
  await expect.poll(() => nativeText(page)).toEqual([sample.text.slice(0, sample.offset) + typed + sample.text.slice(sample.offset)]);
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs))).toEqual(after.runs);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('blank documents accept literal typing and viewer blocks remain read only', async ({ page }) => {
  await open(page, '');
  await paragraphs(page).first().click();
  await page.keyboard.type('My *literal* [document].');
  await expect.poll(() => nativeText(page)).toEqual(['My *literal* [document].']);
  await page.evaluate(() => window.mountEditors([{ session: window.editorTest.controllers[0], readOnly: true, wasmBasePath: '/wasm/' }]));
  await expect(paragraphs(page)).toHaveCount(0);
  await page.locator('#pagination-container').getByText('My *literal* [document].', { exact: true }).click();
  await page.keyboard.type(' must not edit');
  expect(await nativeText(page)).toEqual(['My *literal* [document].']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('plain-text paste creates paragraphs and cell typing stays in its cell', async ({ page }) => {
  await open(page, 'Start here.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText(' Pasted.\nSecond <literal> paragraph.'));
  await page.keyboard.press('Control+v');
  await expect.poll(() => nativeText(page)).toEqual(['Start here. Pasted.', 'Second <literal> paragraph.']);
  await page.getByRole('button', { name: 'Insert table', exact: true }).click();
  await page.getByRole('dialog', { name: 'Insert table', exact: true }).getByRole('button', { name: 'Insert', exact: true }).click();
  const cells = page.locator('#pagination-container td');
  await expect(cells).toHaveCount(4);
  await cells.first().getByRole('textbox', { name: 'Document paragraph' }).click();
  await page.keyboard.type('Cell one');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Cell two');
  await page.keyboard.press('Control+s');
  await expect(cells.nth(0)).toContainText('Cell one');
  await expect(cells.nth(1)).toContainText('Cell two');
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('IME composition remains on the page until confirmed', async ({ page }) => {
  await open(page, 'Say: ');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '日本', selectionStart: 2, selectionEnd: 2 });
  await page.waitForTimeout(700);
  expect(await nativeText(page)).toEqual(['Say: ']);
  await cdp.send('Input.imeSetComposition', { text: '日本語', selectionStart: 3, selectionEnd: 3 });
  await cdp.send('Input.insertText', { text: '日本語' });
  await expect.poll(() => nativeText(page)).toEqual(['Say: 日本語']);
  await page.waitForTimeout(1000);
  await page.keyboard.type('!');
  await page.keyboard.press('Control+s');
  expect(await nativeText(page)).toEqual(['Say: 日本語!']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('incoming layout waits for composition and discards superseded preparation', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await open(page, 'Say: ');
  await settled(page);
  const firstPage = page.locator('#pagination-container .page-box').first();
  await firstPage.evaluate(element => { (element as HTMLElement).dataset.layoutRetained = 'true'; });
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '日本', selectionStart: 2, selectionEnd: 2 });
  // A host layout setting may change while the active canvas has an IME draft.
  // Both requests must wait before creating another document tree; the second
  // cancels the first without disturbing the active page or its composition.
  for (const gap of ['32px', '40px']) {
    await page.locator('.rdv-viewer').evaluate((element, gap) => {
      (element as HTMLElement).style.setProperty('--rdv-page-gap', gap);
      window.dispatchEvent(new Event('resize'));
    }, gap);
    await expect(page.locator('.rdv-paginated-document[aria-busy="true"]')).toHaveCount(1);
    await page.waitForTimeout(100);
    await expect(page.locator('.rdv-document-html')).toHaveCount(1);
    await expect(firstPage).toHaveAttribute('data-layout-retained', 'true');
  }
  expect(await nativeText(page)).toEqual(['Say: ']);
  await cdp.send('Input.imeSetComposition', { text: '日本語', selectionStart: 3, selectionEnd: 3 });
  await cdp.send('Input.insertText', { text: '日本語' });
  await expect.poll(() => nativeText(page)).toEqual(['Say: 日本語']);
  await settled(page);
  await expect(page.locator('.rdv-document-html')).toHaveCount(1);
  await expect(firstPage).not.toHaveAttribute('data-layout-retained');
  await page.keyboard.type('!');
  await page.keyboard.press('Control+s');
  expect(await nativeText(page)).toEqual(['Say: 日本語!']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('conflicting external text edits preserve typing for recovery', async ({ page }) => {
  await open(page, 'Original.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' My draft.');
  await page.evaluate(() => window.editorTest.controllers[0].run(s => s.replaceText(window.editorTest.anchor, 'Changed elsewhere.')));
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  await expect(paragraphs(page).first()).toContainText('Original. My draft.');
  expect(await nativeText(page)).toEqual(['Changed elsewhere.']);
  await page.getByRole('button', { name: 'Reload document text', exact: true }).click();
  await expect(paragraphs(page).first()).toContainText('Changed elsewhere.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Continuing.');
  await expect.poll(() => nativeText(page)).toEqual(['Changed elsewhere. Continuing.']);
});

test('unmount flushes pending typing and leaves a host-owned session open', async ({ page }) => {
  await open(page, 'Keep me.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Including this.');
  await page.evaluate(() => window.mountEditors([]));
  await expect(paragraphs(page)).toHaveCount(0);
  expect(await nativeText(page)).toEqual(['Keep me. Including this.']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('keyboard navigation and select-all work across paragraphs', async ({ page }) => {
  await open(page, 'First.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second.');
  await page.waitForTimeout(1300);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type(' End of first.');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+b');
  const before = await nativeText(page);
  expect(before).toEqual(['First. End of first.', 'Second.']);
  expect(await page.evaluate(() => window.editorTest.controllers[0].read(s => Object.keys(s.project().anchorIndex).filter(id => id.startsWith('p:body:')).every(id => s.getFormatting(id)!.runs.every(run => run.effective.bold))))).toBe(true);
  // The structural replacement and following typing burst are separate undo steps.
  await page.keyboard.type('One paragraph now.');
  await expect.poll(() => nativeText(page)).toEqual(['One paragraph now.']);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual(['O']);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual(before);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('font controls return the caret to the page and preserve prior text', async ({ page }) => {
  await open(page, 'Keep this font.');
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.getByRole('combobox', { name: 'Font family', exact: true }).selectOption('Georgia');
  await page.getByRole('combobox', { name: 'Font size', exact: true }).selectOption('18');
  await page.keyboard.type(' New font.');
  await page.keyboard.press('Control+s');
  const runs = await page.evaluate(() => window.editorTest.controllers[0].read(s => s.getFormatting(window.editorTest.anchor)!.runs));
  expect(runs.filter(run => run.effective.fontFamily === 'Georgia' && run.effective.fontSizePts === 18).map(run => run.text).join('')).toBe(' New font.');
  expect(runs[0].text).toBe('Keep this font.');
  expect(runs[0].effective.fontFamily).toBe('Calibri');
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('typing across page fragments preserves the rest of a long paragraph', async ({ page }) => {
  const text = 'A long repeated phrase with alpha and omega. '.repeat(180);
  await open(page, text);
  const fragments = paragraphs(page);
  await expect.poll(() => fragments.count()).toBeGreaterThan(1);
  await fragments.nth(1).click();
  await page.keyboard.type('EDITED HERE', { delay: 30 });
  await expect.poll(async () => (await nativeText(page))[0].length).toBe(text.length + 11);
  await page.waitForTimeout(1400);
  await page.keyboard.type(' AGAIN');
  await page.keyboard.press('Control+s');
  const result = (await nativeText(page))[0];
  expect(result.replace('EDITED HERE AGAIN', '')).toBe(text);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('Word breaks, tabs, and nonbreaking hyphens stay intact while editing surrounding text', async ({ page }) => {
  await open(page, 'Source');
  await page.evaluate(() => window.editorTest.controllers[0].run(s => {
    const id = window.editorTest.anchor;
    return s.raw.replaceXml(id, s.raw.getXml(id).replace('Source', 'First</w:t><w:br/><w:t>Second</w:t><w:tab/><w:t>Non</w:t><w:noBreakHyphen/><w:t>breaking last.'));
  }));
  await expect(paragraphs(page).first()).toContainText('breaking last.');
  await settled(page);
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Typed.');
  await page.keyboard.press('Control+s');
  const saved = await page.evaluate(async () => {
    const controller = new window.rdv.DocxSessionController();
    const s = await controller.open(window.editorTest.saved!, {}, '/wasm/');
    const xml = new DOMParser().parseFromString(s.raw.getXml(window.editorTest.anchor), 'application/xml');
    const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const text = s.getFormatting(window.editorTest.anchor)!.runs.map(r => r.text).join('');
    const tokens = ['br', 'tab', 'noBreakHyphen'].map(name => xml.getElementsByTagNameNS(w, name).length);
    controller.close(); return { text, tokens };
  });
  expect(saved).toEqual({ text: 'FirstSecondNonbreaking last. Typed.', tokens: [1, 1, 1] });
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('Backspace rejoins a split word without adding a space', async ({ page }) => {
  await open(page, 'Alphabeta');
  await paragraphs(page).first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => nativeText(page)).toEqual(['Alpha', 'beta']);
  await page.keyboard.press('Backspace');
  await expect.poll(() => nativeText(page)).toEqual(['Alphabeta']);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nativeText(page)).toEqual(['Alpha', 'beta']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

test('select-all formats body paragraphs without changing their interleaved footnotes', async ({ page }) => {
  await open(page, 'Body paragraph.');
  await page.evaluate(() => window.editorTest.controllers[0].run(s => {
    s.insertParagraph(window.editorTest.anchor, 'after', 'Another body paragraph.');
    s.insertFootnote(window.editorTest.anchor, 4, 'Keep this footnote unchanged.');
  }));
  await expect(paragraphs(page).filter({ hasText: 'Keep this footnote unchanged.' })).toHaveCount(1);
  await paragraphs(page).filter({ hasText: 'Body paragraph.' }).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+b');
  const formatted = await page.evaluate(() => window.editorTest.controllers[0].read(s => Object.entries(s.project().anchorIndex)
    .filter(([, a]) => ['p', 'h', 'li'].includes(a.kind)).map(([id, a]) => ({ scope: a.scope, runs: s.getFormatting(id)!.runs }))));
  expect(formatted.filter(p => p.scope === 'body').every(p => p.runs.every(r => r.effective.bold))).toBe(true);
  expect(formatted.filter(p => p.scope === 'fn').every(p => p.runs.every(r => !r.effective.bold))).toBe(true);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});

for (const sample of [
  { name: 'decimal with a separate restart', format: 'decimal', start: 1, restart: 10, before: ['1.', '2.', '10.'], after: ['1.', '2.', '3.', '10.'] },
  { name: 'Roman with custom start and parentheses', format: 'upperRomanParenthesis', start: 8, restart: null, before: ['(VIII)', '(IX)', '(X)'], after: ['(VIII)', '(IX)', '(X)', '(XI)'] },
] as const) test(`Enter immediately renumbers ${sample.name} and Backspace restores the labels`, async ({ page }) => {
  await open(page, 'First item.');
  await page.evaluate(sample => window.editorTest.controllers[0].run(s => {
    const first = window.editorTest.anchor;
    const second = s.insertParagraph(first, 'after', 'Second item.').created[0].id;
    const third = s.insertParagraph(second, 'after', 'Third item.').created[0].id;
    s.applyListFormatRange(first, third, sample.format);
    if (sample.start !== 1) s.setListStartOverride(first, sample.start);
    if (sample.restart !== null) s.setListStartOverride(third, sample.restart);
  }), sample);
  const markers = page.locator('#pagination-container [data-rdv-editable] > [data-list-marker]');
  await expect(markers).toHaveText([...sample.before]);
  await settled(page);
  await paragraphs(page).first().click();
  await page.keyboard.press('End');
  await paragraphs(page).first().evaluate(element => {
    const root = element.getRootNode() as ShadowRoot;
    const followingMarkers = Array.from(root.querySelectorAll('#pagination-container [data-rdv-editable] > [data-list-marker]')).slice(1);
    root.addEventListener('beforeinput', () => {
      // Observe the completed synchronous edit, before a later full render can hide stale labels.
      Reflect.set(window, 'immediateListLabels', Array.from(root.querySelectorAll('#pagination-container [data-rdv-editable] > [data-list-marker]')).map(marker => marker.textContent?.trim()));
      Reflect.set(window, 'retainedMarkers', followingMarkers.filter(marker => marker.isConnected && marker.querySelector('[data-docx-tab]')).length);
    });
  });
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => Reflect.get(window, 'immediateListLabels'))).toEqual(sample.after);
  expect(await page.evaluate(() => Reflect.get(window, 'retainedMarkers'))).toBe(2);
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => Reflect.get(window, 'immediateListLabels'))).toEqual(sample.before);
  expect(await nativeText(page)).toEqual(['First item.', 'Second item.', 'Third item.']);
  expect(await page.evaluate(() => window.editorTest.errors)).toEqual([]);
});
