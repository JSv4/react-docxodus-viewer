import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

// Run against a production preview; browser scenarios must run serially.
const directory = process.env.RDV_BENCH_OUTPUT || 'test-results/latency';
await mkdir(directory, { recursive: true });
const base = process.env.RDV_BENCH_URL || 'http://127.0.0.1:4191/';
const fixture = process.env.RDV_STRESS_DOCX || join(tmpdir(), 'rdv-stress-fixtures', 'NVCA-Model-COI-10-1-2025.docx');
const mode = process.env.RDV_BENCH_MODE || 'module';
const doc = process.env.RDV_BENCH_DOC || 'nvca';
const targetRegion = process.env.RDV_BENCH_TARGET || 'default';
if (!['default', 'late-body', 'footnote'].includes(targetRegion)) throw new Error('RDV_BENCH_TARGET must be default, late-body, or footnote');
if (doc === 'nvca') {
  let bytes = await readFile(fixture).catch(() => null);
  if (!bytes && !process.env.RDV_STRESS_DOCX) {
    const response = await fetch('https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx', { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Fixture download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(join(tmpdir(), 'rdv-stress-fixtures'), { recursive: true });
    await writeFile(fixture, bytes);
  }
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== 'd75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29') throw new Error('NVCA fixture hash mismatch');
}
const instrument = process.env.RDV_BENCH_PROFILE === '1';
const cpu = process.env.RDV_BENCH_CPU === '1';
const trace = process.env.RDV_BENCH_TRACE === '1';
const formatting = process.env.RDV_BENCH_FORMAT !== '0';
const wrapping = process.env.RDV_BENCH_WRAP !== '0';
const extended = process.env.RDV_BENCH_EXTENDED === '1';
const label = `${base.includes('github.io') ? 'pages' : 'local'}-${mode}-${doc}${targetRegion === 'default' ? '' : `-${targetRegion}`}${instrument ? '-profile' : ''}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1480, height: 1050 } });
page.setDefaultTimeout(90000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const quantiles = values => {
  const sorted = [...values].sort((a,b)=>a-b);
  return { n: sorted.length, p50: sorted[Math.floor((sorted.length-1)*.5)] ?? 0,
    p95: sorted[Math.floor((sorted.length-1)*.95)] ?? 0, max: sorted.at(-1) ?? 0 };
};
try {
  await page.goto(`${base}${mode === 'module' ? '?example=modules' : ''}`);
  if (mode === 'studio' && doc === 'sample') await page.getByRole('button', { name: 'Explore a sample document' }).click();
  // The module loads its sample asynchronously; finish that before replacing it.
  if (mode === 'module') await page.locator('#pagination-container [data-rdv-editable="true"]').first().waitFor({ state: 'visible' });
  if (doc === 'nvca') await page.getByLabel(mode === 'module' ? 'Open module document' : 'Open workspace document').setInputFiles(fixture);
  if (doc === 'nvca') await page.locator('#pagination-container [data-rdv-editable="true"]').filter({hasText:'The Certificate of Incorporation is a key document'}).first().waitFor({state:'visible'});
  await page.locator('#pagination-container [data-rdv-editable="true"]').first().waitFor({ state: 'visible' });
  if (mode === 'studio') await page.getByRole('button', {name:'edit',exact:true}).click();
  await page.locator('.rdv-format-toolbar').waitFor({state:'visible'});
  // Prepared incoming pages are intentionally inert until the final handoff.
  // Benchmark the active canvas, never a hidden preview or the prior document.
  await page.waitForFunction(() => {
    const toolbar = document.querySelector('.rdv-format-toolbar');
    let fiber = toolbar?.[Object.keys(toolbar).find(k => k.startsWith('__reactFiber'))];
    while (fiber && !fiber.memoizedProps?.editor) fiber = fiber.return;
    if (!fiber) return false;
    const { controller, canvasEditor: canvas } = fiber.memoizedProps.editor;
    const snapshot = controller.getSnapshot();
    return canvas.root?.isConnected && canvas.renderedOwner === snapshot.session && canvas.renderedVersion === snapshot.version &&
      snapshot.session.getPageMapStatus().availability === 'available' && !canvas.getSnapshot().suspended;
  });
  await page.waitForTimeout(200);
  const info = await page.evaluate(async ({instrument, targetRegion, trace}) => {
    const toolbar = document.querySelector('.rdv-format-toolbar');
    let fiber = toolbar[Object.keys(toolbar).find(k=>k.startsWith('__reactFiber'))];
    while (fiber && !fiber.memoizedProps?.editor) fiber = fiber.return;
    if (!fiber) throw new Error('No editor instance found');
    const editor = fiber.memoizedProps.editor;
    const controller = editor.controller;
    const canvas = editor.canvasEditor;
    const native = controller.read(s=>s);
    const root = canvas.root;
    window.latency = { editor, controller, native, canvas, root, active: false, events: [], frames: [], longTasks: [], longAnimationFrames: [], interactions: [], calls: [], versions: [] };
    const state = window.latency;
    state.reset = name => { state.name = name; state.start = performance.now(); state.events = []; state.frames = []; state.longTasks = []; state.longAnimationFrames = []; state.interactions = []; state.calls = []; state.versions = []; state.active = true; };
    for (const type of ['keydown', 'keyup', 'beforeinput', 'input']) {
      document.addEventListener(type, event => {
        if (!state.active) return;
        const entry = { type, key: event.key, inputType: event.inputType, at: performance.now(), timestamp: event.timeStamp };
        state.events.push(entry);
        if (type === 'keydown' || type === 'input') requestAnimationFrame(() => { entry.nextFrame = performance.now(); });
      }, true);
    }
    let previous = performance.now();
    const frame = now => { if (state.active) state.frames.push({ at: now, gap: now-previous }); previous=now; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    new PerformanceObserver(list=>{ if (state.active) state.longTasks.push(...list.getEntries().filter(e=>e.startTime>=state.start).map(e=>({ at:e.startTime, ms:e.duration }))); }).observe({ type:'longtask' });
    new PerformanceObserver(list=>{ if (state.active) state.interactions.push(...list.getEntries().filter(e=>e.startTime>=state.start).map(e=>({ type:e.name, id:e.interactionId, at:e.startTime, duration:e.duration, delay:e.processingStart-e.startTime, processing:e.processingEnd-e.processingStart }))); }).observe({ type:'event', durationThreshold:16 });
    if (trace && PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
      new PerformanceObserver(list => {
        if (state.active) state.longAnimationFrames.push(...list.getEntries().filter(e => e.startTime >= state.start).map(e => e.toJSON()));
      }).observe({ type: 'long-animation-frame' });
    }
    controller.subscribe(()=>{ if(state.active) state.versions.push({at:performance.now(), version:controller.getSnapshot().version, change:controller.getSnapshot().change, map:controller.read(session=>session.getPageMapStatus())}); });
    if (instrument) {
      let depth=0;
      const wrap = (target, name, prefix) => {
        const original = target[name];
        if (typeof original !== 'function') return;
        target[name] = function(...args) {
          if (!state.active) return original.apply(this,args);
          const entry = { name: `${prefix}.${name}`, at:performance.now(), depth:depth++, arg: typeof args[0]==='string' ? args[0] : undefined };
          try { return original.apply(this,args); } finally { entry.ms=performance.now()-entry.at; depth--;state.calls.push(entry); }
        };
      };
      for (const name of ['capture','canonical','text','notifySelection','storyBlocks','selectedSpans','prepareParagraphs','attach','beginDraft','commit','patch','patchMany','restore','updateLayout','navigate','publish']) wrap(canvas,name,'canvas');
      const bridge = controller.native.wasm;
      for (const name of Object.keys(bridge).filter(name=> name !== 'GetVersion')) wrap(bridge,name,'native');
      for (const name of ['renderBlocks','getAnchorIndex','run','publish']) wrap(controller,name,'controller');
    }
    const scope = targetRegion === 'footnote' ? ':fn:' : ':body:';
    const paragraphs = Array.from(root.querySelectorAll('[data-rdv-editable="true"]')).filter(el=>el.dataset.sourceAnchorId?.includes(scope));
    const target = targetRegion === 'default'
      ? paragraphs.find(el=>el.textContent.startsWith('Build a quieter')) || paragraphs.find(el=>el.textContent.trim().length>180) || paragraphs[0]
      : paragraphs.filter(el=>el.textContent.trim().length>180).at(-1);
    if (!target) throw new Error(`No suitable paragraph in ${targetRegion}`);
    state.target = target.dataset.sourceAnchorId;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',controller.originalBytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    return {target:state.target,targetRegion,text:target.textContent.slice(0,100), nativeText:native.getFormatting(state.target).runs.map(run=>run.text).join(''), hash, pages:root.querySelectorAll('.page-box').length, version:controller.getSnapshot().version, crossOriginIsolated, userAgent:navigator.userAgent, hardwareConcurrency:navigator.hardwareConcurrency};
  }, {instrument, targetRegion, trace});
  if(doc==='nvca' && info.hash!=='d75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29') throw new Error(`Wrong NVCA document: ${info.hash}`);
  const block = () => page.locator(`#pagination-container [data-source-anchor-id="${info.target}"][data-rdv-editable="true"]`).last();
  await block().click(); await page.keyboard.press('End'); await page.waitForTimeout(700);
  const cdp = cpu || trace ? await page.context().newCDPSession(page) : null;
  const phases=[];
  const runPhase = async (name, action) => {
    if (trace) await cdp.send('Tracing.start', {
      categories: '-*,toplevel,devtools.timeline,v8,blink.user_timing,input,latencyInfo,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,disabled-by-default-v8.cpu_profiler',
      options: 'record-as-much-as-possible',
      transferMode: 'ReturnAsStream', streamFormat: 'json', streamCompression: 'gzip',
    });
    await page.evaluate(({name, trace}) => {
      window.latency.reset(name);
      if (trace) performance.mark(`rdv-latency:${name}`, { startTime: window.latency.start });
    }, {name, trace});
    if (cpu) {await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');}
    const start=performance.now(); await action(); const actionMs=performance.now()-start;
    await page.waitForTimeout(2000);
    await page.waitForFunction(()=>{
      const s=window.latency;
      const map=s.native.getPageMapStatus();
      return !s.canvas.getSnapshot().pending && map.availability==='available' && map.documentVersion===s.controller.getSnapshot().version;
    });
    // The last layout task can finish just before Playwright's queued evaluation;
    // give observers and rAF a chance to report that task and its missed frames.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForTimeout(80);
    const phase = await page.evaluate(()=>{
      const s=window.latency; s.active=false;
      const after = s.native.getFormatting(s.target)?.runs.map(r=>r.text).join('');
      return { name:s.name,start:s.start,events:s.events,frames:s.frames,longTasks:s.longTasks,longAnimationFrames:s.longAnimationFrames,interactions:s.interactions,calls:s.calls,versions:s.versions,after,canvasState:s.canvas.getSnapshot() };
    });
    if(cpu) {const profile=await cdp.send('Profiler.stop'); await writeFile(`${directory}/${label}-${name}.cpuprofile`,JSON.stringify(profile.profile));}
    if (trace) {
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      const {stream, dataLossOccurred} = await complete;
      if (!stream) throw new Error('Chrome did not return a trace stream');
      const chunks = [];
      try {
        for (;;) {
          const chunk = await cdp.send('IO.read', {handle: stream});
          chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
          if (chunk.eof) break;
        }
      } finally { await cdp.send('IO.close', {handle: stream}); }
      const file = `${label}-${name}.trace.json.gz`;
      await writeFile(`${directory}/${file}`, Buffer.concat(chunks));
      phase.trace = {file, marker: `rdv-latency:${name}`, dataLossOccurred};
      if (dataLossOccurred) errors.push(`Trace data lost in ${name}`);
    }
    const keys=phase.events.filter(e=>e.type==='keydown');
    const inputs=phase.events.filter(e=>e.type==='input');
    const lastInput=inputs.at(-1)?.at;
    const lastTextEdit=phase.events.filter(e=>e.type==='beforeinput' || e.type==='input').at(-1)?.at;
    phase.summary={ actionMs, keyToFrame:quantiles(keys.filter(e=>e.nextFrame).map(e=>e.nextFrame-e.at)), inputToFrame:quantiles(inputs.filter(e=>e.nextFrame).map(e=>e.nextFrame-e.at)), eventTiming:quantiles(phase.interactions.filter(e=>e.id).map(e=>e.duration)), frameGaps:quantiles(phase.frames.map(e=>e.gap)), longTaskCount:phase.longTasks.length,longTaskTotal:phase.longTasks.reduce((sum,e)=>sum+e.ms,0), longestTask:Math.max(0,...phase.longTasks.map(e=>e.ms)), longTasksDuringTyping:phase.longTasks.filter(e=>e.at<=lastInput), lastInputToNextPublish:lastInput ? phase.versions.find(e=>e.at>=lastInput)?.at-lastInput : undefined };
    const lastEdit = lastTextEdit ?? (name === 'bold' || name === 'enter' ? keys.at(-1)?.at : undefined);
    phase.summary.longTasksDuringTyping = phase.longTasks.filter(e=>lastTextEdit !== undefined && e.at<=lastTextEdit);
    if (lastEdit !== undefined) phase.summary.lastEditToCurrentLayout = phase.versions.find(event => event.at >= lastEdit && event.map?.availability === 'available' && event.map.documentVersion === event.version)?.at - lastEdit;
    console.log(JSON.stringify({label,phase:name,summary:phase.summary})); phases.push(phase);
  };
  await runPhase('continuous',()=>page.keyboard.type(' The editor should follow every thought smoothly.',{delay:55}));
  await runPhase('caret',async()=>{for(let i=0;i<24;i++){await page.keyboard.press(i<12?'ArrowLeft':'ArrowRight');await page.waitForTimeout(30);}});
  await runPhase('pause_resume',async()=>{for(let i=0;i<6;i++){await page.keyboard.type(' word',{delay:65});await page.waitForTimeout(420);}});
  if (formatting) {
    await page.keyboard.press('Control+Shift+ArrowLeft');
    await page.waitForTimeout(120);
    const selected=await page.evaluate(()=>window.latency.canvas.selectedSpans());
    if(!selected.some(item=>item.span.length>0)) throw new Error('Formatting requires a selected word');
    const boldState = async () => page.evaluate(selected => selected.flatMap(part => window.latency.native.getFormatting(part.anchorId).runs
      .filter(run => run.span.start < part.span.start + part.span.length && run.span.start + run.span.length > part.span.start)
      .map(run => run.effective.bold === true)), selected);
    const expectedBold = !(await boldState()).every(Boolean);
    await runPhase('bold',()=>page.keyboard.press('Control+b'));
    const actualBold = await boldState();
    if (!actualBold.length || actualBold.some(value => value !== expectedBold)) errors.push('Selected-word Bold was not applied natively');
  }
  if (wrapping) {
    await page.keyboard.press('ArrowRight');
    await runPhase('wrap_resume', async () => {
      await page.keyboard.insertText(' A longer passage that forces the paragraph to wrap across additional lines.'.repeat(8));
      await page.waitForTimeout(430);
      await page.keyboard.type(' Still typing.', { delay: 55 });
    });
  }
  for (const phase of phases) {
    if(phase.name==='bold') continue;
    const count=phase.events.filter(e=>e.type==='keydown').length;
    if (count !== (phase.name==='continuous'?49:phase.name==='caret'?24:phase.name==='wrap_resume'?14:30)) errors.push(`Unexpected key count in ${phase.name}: ${count}`);
  }
  if(!phases[0].after.includes('The editor should follow every thought smoothly.')) errors.push('Continuous text was not saved');
  if(!phases[2].after.includes(' word word word word word word')) errors.push('Pause/resume text was not saved');
  if(wrapping && !phases.at(-1).after.includes(' Still typing.')) errors.push('Typing during reflow was not saved');
  const restored = phases.at(-1).after
    .replace(' The editor should follow every thought smoothly.', '')
    .replace(' word word word word word word', '')
    .replace(' A longer passage that forces the paragraph to wrap across additional lines.'.repeat(8), '')
    .replace(' Still typing.', '');
  if (restored !== info.nativeText) errors.push('Text outside the inserted passages changed');
  if (extended) {
    const beforeStyled = phases.at(-1).after;
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+b');
    const styledSetup = await page.evaluate(() => {
      const s = window.latency, offset = s.canvas.range.start.offset;
      const runs = s.native.getFormatting(s.target).runs;
      return { offset, runBoundary: offset === 0 || runs.some(run => run.span.start + run.span.length === offset) };
    });
    await runPhase('styled_pause_resume', async () => {
      await page.keyboard.type(' Styled text.', {delay:65});
      await page.waitForTimeout(420);
      await page.keyboard.type(' More style.', {delay:65});
    });
    phases.at(-1).setup = styledSetup;
    const styled = phases.at(-1).after;
    if (!styled.includes(' Styled text. More style.') || styled.replace(' Styled text. More style.', '') !== beforeStyled) errors.push('Styled typing changed surrounding text');
    const styledFormat = await page.evaluate(() => {
      const s=window.latency, runs=s.native.getFormatting(s.target).runs;
      const start=runs.map(run=>run.text).join('').indexOf(' Styled text. More style.');
      const relevant=runs.filter(run=>run.span.start<start+25 && run.span.start+run.span.length>start);
      return relevant.length>0 && relevant.every(run=>(run.effective.bold===true)===(s.canvas.getSnapshot().format.bold===true));
    });
    if (!styledFormat) errors.push('Styled typing did not retain its native Bold setting');
    await runPhase('enter', () => page.keyboard.press('Enter'));
    await page.keyboard.press('Control+z');
    const undone = await page.evaluate(() => window.latency.native.getFormatting(window.latency.target).runs.map(run=>run.text).join(''));
    if (undone !== styled) errors.push('Enter did not undo as one native edit');
    await page.waitForFunction(() => window.latency.native.getPageMapStatus().availability === 'available');
    // Keep the historical phases above intact. Explicitly exercise both sides
    // of the native insertion contract instead of assuming a caret sits
    // at a run boundary after the preceding wrapping and selection operations.
    for (const placement of ['boundary', 'interior']) {
      const setup = await page.evaluate(placement => {
        const s = window.latency, runs = s.native.getFormatting(s.target).runs;
        const before = runs.map(run => run.text).join('');
        const run = placement === 'boundary' ? runs.at(-1) : runs.find(run => run.text.length >= 12 && /^[\x20-\x7e]+$/.test(run.text));
        if (!run) throw new Error('No suitable native text run for the styled typing benchmark');
        const offset = placement === 'boundary' ? before.length : run.span.start + Math.floor(run.span.length / 2);
        const point = { anchorId: s.target, offset };
        s.canvas.range = { start: point, end: point, backward: false };
        s.canvas.focus();
        return { before, offset, runBoundary: placement === 'boundary', boldBefore: run.effective.bold === true };
      }, placement);
      await page.waitForTimeout(80);
      await page.keyboard.press('Control+b');
      const bold = await page.evaluate(() => window.latency.canvas.getSnapshot().format.bold === true);
      const first = placement === 'boundary' ? ' Boundary text.' : ' Interior text.';
      const second = placement === 'boundary' ? ' More boundary.' : ' More inside.';
      const added = first + second;
      await runPhase(`styled_${placement}_pause_resume`, async () => {
        await page.keyboard.type(first, {delay:65});
        await page.waitForTimeout(420);
        await page.keyboard.type(second, {delay:65});
      });
      const phase = phases.at(-1);
      phase.setup = setup;
      if (phase.after !== setup.before.slice(0, setup.offset) + added + setup.before.slice(setup.offset)) errors.push(`${placement} styled typing changed surrounding text`);
      if (phase.events.filter(event => event.type === 'keydown').length !== added.length) errors.push(`Unexpected key count for ${placement} styled typing`);
      const formatted = await page.evaluate(({start, length, bold}) => {
        const runs = window.latency.native.getFormatting(window.latency.target).runs
          .filter(run => run.span.start < start + length && run.span.start + run.span.length > start);
        return runs.length > 0 && runs.every(run => (run.effective.bold === true) === bold);
      }, { start: setup.offset, length: added.length, bold });
      if (!formatted) errors.push(`${placement} styled typing did not retain its native Bold setting`);
    }
  }
  if(await page.getByRole('alert').count()) errors.push('Visible editor alert');
  await page.screenshot({path:`${directory}/${label}.png`});
  const result={label,base,mode,doc,instrument,cpu,trace,extended,buildRevision:process.env.RDV_BENCH_REVISION || null,workspaceCommit:execFileSync('git', ['rev-parse', 'HEAD'], { encoding:'utf8' }).trim(),workspaceDirty:!!execFileSync('git', ['status', '--porcelain'], { encoding:'utf8' }).trim(),browser:browser.version(),info,errors,phases};
  await writeFile(`${directory}/${label}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({label,info,errors,output:`${directory}/${label}.json`}));
  if (errors.length) throw new Error(errors.join('; '));
  const limit = Number(process.env.RDV_LATENCY_LIMIT_MS);
  if (limit && phases.some(phase => phase.summary.eventTiming.max > limit)) throw new Error(`An input response exceeded ${limit} ms; see the saved diagnostic report.`);
} finally { await browser.close(); }
