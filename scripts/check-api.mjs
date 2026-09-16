import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = ts.readConfigFile('tsconfig.lib.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true, emitDeclarationOnly: false });
const checker = program.getTypeChecker();
const names = filename => {
  const source = program.getSourceFile(filename);
  assert(source, `Missing declaration module ${filename}`);
  const symbol = checker.getSymbolAtLocation(source);
  return checker.getExportsOfModule(symbol).map(value => value.name);
};
const surfaces = [
  ['src/index.ts', 'node_modules/docxodus/dist/core.d.ts'],
  ['src/index.ts', 'node_modules/docxodus/dist/worker-proxy.d.ts'],
  ['src/engine.ts', 'node_modules/docxodus/dist/core.d.ts'],
  ['src/worker.ts', 'node_modules/docxodus/dist/worker-proxy.d.ts'],
  ['src/export-browser.ts', 'node_modules/docxodus/dist/export-browser.d.ts'],
  ['src/server.ts', 'node_modules/@docxodus/export/dist/index.d.ts'],
];
for (const [entry, upstream] of surfaces) {
  const offered = new Set(names(entry));
  const required = names(upstream);
  assert.deepEqual(required.filter(name => !offered.has(name)), [], `Missing exports from ${entry}`);
  console.log(`${entry}: all ${required.length} upstream exports covered (${upstream})`);
}
const entry = await readFile('dist/react-docxodus-viewer.es.js', 'utf8');
assert(!entry.includes('docxodus/react') && !entry.includes('docxodus/editor') && !entry.includes('@docxodus/export'), 'Browser root must not load editor or Node export dependencies');
const metadata = JSON.parse(await readFile('node_modules/docxodus/package.json', 'utf8'));
assert.equal(metadata.version, '12.6.2');
const built = await import('../dist/react-docxodus-viewer.es.js');
const core = await import('docxodus/core');
for (const [name, value] of Object.entries(core)) assert.equal(built[name], value, `Runtime export ${name} changed`);
console.log(`Built ESM root: ${Object.keys(core).length} runtime engine exports retain identity; no editor or Node dependency.`);
