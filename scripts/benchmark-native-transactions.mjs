import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';

// Native-only diagnostic: no React, editor canvas, rendering, or registered page map.
// Run browsers serially and keep builds/other CPU-heavy work out of the measurement.

const roots = {
  installed: resolve('node_modules/docxodus'),
  ...(process.env.RDV_NATIVE_COMPARE_ROOT ? { candidate: resolve(process.env.RDV_NATIVE_COMPARE_ROOT) } : {}),
};
// The optional comparison package supplies the legacy batch baseline. The
// installed package always supplies the public formatted replacement.
const insertionOnly = process.env.RDV_NATIVE_INSERTIONS_ONLY === '1';
const workloads = [
  { label: 'batch', root: roots.candidate ? 'candidate' : 'installed' },
  { label: 'formatted', root: 'installed' },
].filter(workload => !insertionOnly || workload.label === 'formatted');
if (!process.env.RDV_STRESS_DOCX) throw new Error('Set RDV_STRESS_DOCX to the pinned NVCA fixture.');
const fixture = await readFile(process.env.RDV_STRESS_DOCX);
const sha256 = createHash('sha256').update(fixture).digest('hex');
if (sha256 !== 'd75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29') throw new Error('NVCA fixture hash mismatch');
const packages = Object.fromEntries(await Promise.all(Object.entries(roots).map(async ([label, root]) => [label, {
  version: JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version,
  sessionHash: createHash('sha256').update(await readFile(resolve(root, 'dist/session.js'))).digest('hex'),
  runtimeHash: createHash('sha256').update(await readFile(resolve(root, 'dist/wasm/_framework/DocxodusWasm.wasm'))).digest('hex'),
  engineRuntimeHash: createHash('sha256').update(await readFile(resolve(root, 'dist/wasm/_framework/Docxodus.wasm'))).digest('hex'),
}])));
const server = createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Native batch benchmark</title>'); return; }
  if (url.pathname === '/fixture.docx') { res.end(fixture); return; }
  const [,version,...parts] = decodeURIComponent(url.pathname).split('/');
  const root = roots[version], file = root && resolve(root, ...parts);
  if (!file || !file.startsWith(root + sep)) { res.writeHead(404).end(); return; }
  try {
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.setHeader('Content-Type', ({'.js':'text/javascript','.wasm':'application/wasm','.json':'application/json'})[extname(file)] || 'application/octet-stream');
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({headless:true});
const runs = [];
const startedAt = new Date().toISOString();
try {
  // Alternate paths ABBA, in fresh contexts, with no parallel browser workload.
  for (const {label, root} of [...workloads, ...workloads.toReversed()]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    const result = await page.evaluate(async ({label, root, version, insertionOnly}) => {
      const api = await import(`/${root}/dist/core.js`);
      await api.initialize(`/${root}/dist/wasm/`);
      const bytes = new Uint8Array(await (await fetch('/fixture.docx')).arrayBuffer());
      const s = api.openDocxSession(bytes, {emitMarkdownPatch:false, persistAnchorIds:true});
      const anchorIndex = s.project().anchorIndex;
      const anchor = Object.entries(anchorIndex).find(([,item]) => item.scope==='body' && item.textPreview.startsWith('The Certificate of Incorporation'))[0];
      const formatting = () => s.getFormatting(anchor).runs.map(({text, span, effective}) => ({text, span, effective}));
      const beforeRuns = formatting();
      const before = beforeRuns.map(run=>run.text).join('');
      const at = before.indexOf('document');
      if (at<0) throw new Error('Fixture paragraph did not match');
      const bridge = api.getWasmExports().DocxSessionBridge;
      const calls = [];
      for (const name of ['BeginTransaction','GetPackageContentHash','ReplaceTextAtSpan','ReplaceTextAtSpanWithFormat','ApplyFormat','ListRevisions']) {
        const original=bridge[name];
        if (!original) continue;
        bridge[name]=function(...args) { const start=performance.now(); try {return original.apply(this,args);} finally {calls.push({name,ms:performance.now()-start});} };
      }
      const match = {text:'document', enclosingAnchor:{id:anchor,kind:'p',scope:'body',unid:anchor.split(':').at(-1)},span:{start:at,length:8},fragments:[],contextBefore:'',contextAfter:'',groups:[]};
      const attempts = [];
      // First transaction plus two repeats on the same session after undo/redo verification.
      for (let iteration = 0; iteration < (insertionOnly ? 0 : 3); iteration++) {
        const versionBefore = s.getVersion();
        calls.length = 0;
        const start=performance.now();
        const edit=label === 'formatted' ? s.replaceMatch(match,'new document',{bold:true}) : s.executeBatch([
          {tool:'benchmark',action:'text',mutation:()=>s.replaceMatch(match,'new document')},
          {tool:'benchmark',action:'format',mutation:()=>s.applyFormat(anchor,{start:at,length:12},{bold:true})},
        ]);
        const ms=performance.now()-start;
        const measuredCalls = [...calls];
        if(!edit.success) throw new Error(JSON.stringify(edit));
        if(s.getVersion() !== versionBefore + 1) throw new Error('Edit must advance the native version once');
        if(label === 'batch' && !edit.packageHash) throw new Error('Legacy batch must retain its package receipt');
        if(label === 'formatted' && (edit.packageHash || measuredCalls.some(call=>['BeginTransaction','GetPackageContentHash'].includes(call.name)))) throw new Error('Formatted replacement must avoid package checkpoints and receipts');
        const afterRuns = formatting();
        if(afterRuns.map(run=>run.text).join('')!==before.slice(0,at)+'new document'+before.slice(at+8)) throw new Error('Text mismatch');
        const formatted = afterRuns.filter(run=>run.span.start<at+12 && run.span.start+run.span.length>at);
        if(!formatted.length || !formatted.every(run=>run.effective.bold)) throw new Error('Formatting mismatch');
        const restored = () => JSON.stringify(formatting()) === JSON.stringify(beforeRuns);
        if(!s.undo() || !restored()) throw new Error('Native undo must restore text and formatting together');
        if(!s.redo() || JSON.stringify(formatting()) !== JSON.stringify(afterRuns)) throw new Error('Native redo mismatch');
        if(!s.undo() || !restored()) throw new Error('Native undo after redo mismatch');
        attempts.push({iteration, ms, calls:measuredCalls, hashPresent:!!edit.packageHash,
          checks:{text:true, bold:true, oneVersion:true, undo:true, redo:true}});
      }
      // Insertion-only mode starts with these probes in each fresh context.
      // Otherwise they follow the replacement workload and are warm measurements.
      const probeInsertion = (anchorId, offset, mixed = false) => {
        const formatting = () => s.getFormatting(anchorId).runs.map(({text, span, effective}) => ({text, span, effective}));
        const beforeRuns = formatting(), before = beforeRuns.map(run => run.text).join('');
        const versionBefore = s.getVersion(), beforeXml = s.raw.getXml(anchorId);
        if (!beforeRuns.some(run => run.span.start < offset && run.span.start + run.span.length > offset)) throw new Error('Probe requires a strict interior run offset');
        const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const xml = new DOMParser().parseFromString(beforeXml, 'application/xml');
        // Package snapshots can rename namespace prefixes (p2 -> p36). Compare
        // expanded element/attribute names, values, and ordered children instead.
        const normalizedXml = value => {
          const nodeValue = node => node.nodeType === 1
            ? [node.namespaceURI, node.localName, [...node.attributes].filter(attr => attr.namespaceURI !== 'http://www.w3.org/2000/xmlns/')
              .map(attr => [attr.namespaceURI, attr.localName, attr.value]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [...node.childNodes].map(nodeValue)]
            : [node.nodeType, node.nodeValue];
          return JSON.stringify(nodeValue(new DOMParser().parseFromString(value, 'application/xml').documentElement));
        };
        const beforeXmlTree = normalizedXml(beforeXml);
        const markers = value => {
          const nodes = new DOMParser().parseFromString(value, 'application/xml').getElementsByTagNameNS(word, '*');
          let position = 0;
          const result = [];
          for (const node of nodes) {
            if (node.localName === 't') position += node.textContent.length;
            else if (['tab', 'br', 'cr', 'footnoteRef', 'endnoteRef'].includes(node.localName)) {
              result.push({name:node.localName, offset:position, attributes:[...node.attributes].filter(attr => attr.namespaceURI === word).map(attr => [attr.localName,attr.value]).sort()});
            }
          }
          return result;
        };
        const beforeMarkers = markers(beforeXml);
        let position = 0, sourceRun;
        for (const run of xml.getElementsByTagNameNS(word, 'r')) {
          const text = [...run.getElementsByTagNameNS(word, 't')].map(t => t.textContent).join('');
          if (position < offset && position + text.length > offset) {
            sourceRun = {text, start:position, children:[...run.children].map(child => child.localName)}; break;
          }
          position += text.length;
        }
        if (!sourceRun || (mixed && !sourceRun.children.includes('tab'))) throw new Error('Insertion fixture structure did not match');
        const match = {text:'', enclosingAnchor:{id:anchorId,kind:anchorId.split(':')[0],scope:anchorId.split(':')[1],unid:anchorId.split(':').at(-1)},span:{start:offset,length:0},fragments:[],contextBefore:'',contextAfter:'',groups:[]};
        const inserted = ' inserted ';
        calls.length = 0;
        const start = performance.now();
        const edit = s.replaceMatch(match, inserted, {bold:true});
        const ms = performance.now() - start, measuredCalls = [...calls];
        const unchanged = s.getVersion() === versionBefore && JSON.stringify(formatting()) === JSON.stringify(beforeRuns) && s.raw.getXml(anchorId) === beforeXml;
        if (!edit.success && !unchanged) throw new Error('Rejected interior insertion changed the document');
        const verify = () => {
          if (s.getVersion() !== versionBefore + 1) throw new Error('Interior insertion must advance the native version once');
          const afterRuns = formatting();
          if (afterRuns.map(run => run.text).join('') !== before.slice(0, offset) + inserted + before.slice(offset)) throw new Error('Interior text mismatch');
          const characters = runs => runs.flatMap(run => run.text.split('').map(text => ({text, effective:run.effective})));
          const afterCharacters = characters(afterRuns);
          if (!afterCharacters.slice(offset, offset + inserted.length).every(char => char.effective.bold)) throw new Error('Interior formatting mismatch');
          if (JSON.stringify([...afterCharacters.slice(0, offset), ...afterCharacters.slice(offset + inserted.length)]) !== JSON.stringify(characters(beforeRuns))) throw new Error('Interior insertion changed neighboring formatting');
          if (JSON.stringify(markers(s.raw.getXml(anchorId))) !== JSON.stringify(beforeMarkers.map(marker => ({...marker, offset:marker.offset >= offset ? marker.offset + inserted.length : marker.offset})))) throw new Error('Interior insertion changed non-text markers');
          const restored = () => JSON.stringify(formatting()) === JSON.stringify(beforeRuns) && normalizedXml(s.raw.getXml(anchorId)) === beforeXmlTree;
          if (!s.undo() || !restored()) throw new Error(`Interior undo must restore text, formatting and XML: ${anchorId}`);
          if (!s.redo() || JSON.stringify(formatting()) !== JSON.stringify(afterRuns)) throw new Error('Interior redo mismatch');
          if (!s.undo() || !restored()) throw new Error('Interior undo after redo mismatch');
          return {text:true, bold:true, surroundingFormatting:true, nonTextMarkers:true, oneVersion:true, undo:true, redo:true, undoXml:true};
        };
        let checks, batchFallback;
        if (edit.success) {
          if (measuredCalls.some(call => ['BeginTransaction','GetPackageContentHash'].includes(call.name))) throw new Error('Interior insertion used a full-package checkpoint or receipt');
          checks = verify();
        } else if (mixed) {
          const borrowed = before.slice(offset - 1, offset);
          if (!/^[\x20-\x7e]$/.test(borrowed)) throw new Error('Fallback fixture requires an ordinary ASCII neighbor');
          calls.length = 0;
          const start = performance.now();
          const fallback = s.executeBatch([
            {tool:'benchmark', action:'text', mutation:() => s.replaceMatch({...match, text:borrowed, span:{start:offset-1,length:1}}, borrowed + inserted)},
            {tool:'benchmark', action:'format', mutation:() => s.applyFormat(anchorId, {start:offset,length:inserted.length}, {bold:true})},
          ]);
          const ms = performance.now() - start, measuredCalls = [...calls];
          if (!fallback.success || !fallback.packageHash) throw new Error('Mixed-run batch failed or omitted its receipt');
          batchFallback = {ms, calls:measuredCalls, hashPresent:true, checks:verify()};
        }
        return {anchorId, offset, sourceRun, supported:edit.success, error:edit.error, unchanged, ms, calls:measuredCalls, checks, batchFallback};
      };
      let interiorInsertion, mixedRunInsertion;
      if (label === 'formatted') {
        interiorInsertion = probeInsertion(anchor, at + 4);
        // Resolve the paragraph, rather than its containing footnote anchor,
        // from the current projection after the preceding history checks.
        const note = Object.entries(s.project().anchorIndex).find(([id,item]) => /^(p|h|li):fn:/.test(id) && item.textPreview.startsWith('Consider adding other exceptions'))?.[0];
        if (!note) throw new Error('Missing NVCA footnote fixture');
        mixedRunInsertion = probeInsertion(note, 24, true);
      }
      s.close();
      return {version,attempts,interiorInsertion,mixedRunInsertion,crossOriginIsolated};
    }, {label, root, version: packages[root].version, insertionOnly});
    runs.push({label,root,...result,errors}); console.log(JSON.stringify({label,root,...result,errors}));
    await context.close();
  }
  const output=process.env.RDV_NATIVE_BENCH_OUTPUT || 'test-results/native-transactions.json';
  await mkdir(dirname(output), {recursive:true});
  await writeFile(output,JSON.stringify({startedAt,sha256,packages,browser:browser.version(),
    machine:{cpu:cpus()[0]?.model, logicalCpus:cpus().length, platform:platform(), arch:arch()},
    workload:insertionOnly ? 'Two fresh formatted contexts: ordinary body interior insertion, then insertion inside a footnote run with a leading tab and its atomic batch fallback.' : 'The same text-plus-Bold edit via executeBatch and replaceMatch(match, text, format); first attempt and two repeats after undo/redo, in fresh batch/formatted/formatted/batch browser contexts. Each formatted context then measures warm ordinary and mixed-run interior insertions and verifies neighboring formatting and undo/redo.',
    cpuThrottling:false,runs},null,2)+'\n');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
