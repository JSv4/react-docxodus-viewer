import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'rdv-consumer-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  return result.stdout;
}
const [pack] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--cache', join(temp, 'cache'), '--pack-destination', temp]));
assert(!pack.files.some(file => /(?:\.test\.|test-results|node_modules|\.cjs\.js)/.test(file.path)), 'Package includes test files or stale CommonJS bundles');
run('tar', ['-xzf', join(temp, pack.filename), '-C', temp]);
const modules = join(temp, 'node_modules');
await mkdir(join(modules, '@docxodus'), { recursive: true });
await symlink(join(temp, 'package'), join(modules, 'react-docxodus-viewer'));
for (const name of ['react', 'docxodus', '@types']) await symlink(resolve(root, 'node_modules', name), join(modules, name));
await symlink(resolve(root, 'node_modules/@docxodus/export'), join(modules, '@docxodus/export'));
await writeFile(join(temp, 'package.json'), '{"type":"module"}');
await writeFile(join(temp, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import * as viewer from 'react-docxodus-viewer';
import * as engine from 'react-docxodus-viewer/engine';
import * as worker from 'react-docxodus-viewer/worker';
import * as browser from 'react-docxodus-viewer/export-browser';
import * as server from 'react-docxodus-viewer/server';
import { copyDocxodusRuntime } from 'react-docxodus-viewer/assets';
assert.equal(viewer.openDocxSession, engine.openDocxSession);
assert.equal(typeof worker.createWorkerDocxodus, 'function');
assert.equal(typeof browser.convertDocxToPaginatedHtml, 'function');
assert.equal(typeof server.convertDocxToPdf, 'function');
const copied = await copyDocxodusRuntime('./runtime');
assert.equal(copied.version, '12.4.1');
console.log('Packed ESM entry points and runtime-copy helper passed.');
`);
process.stdout.write(run(process.execPath, [join(temp, 'consumer.mjs')], temp));
await writeFile(join(temp, 'consumer.tsx'), `
import { DocumentViewer, useDocxSession, useSessionCommands, useDocumentHistory, useDocxodusOperation, type DocxSession } from 'react-docxodus-viewer';
import { copyDocxodusRuntime } from 'react-docxodus-viewer/assets';
import { convertDocxToPdf } from 'react-docxodus-viewer/server';
export function Consumer() {
  const document = useDocxSession();
  const commands: Pick<DocxSession, 'executeBatch' | 'fillContentControlPicture' | 'getDiff'> = useSessionCommands(document.controller, ['executeBatch', 'fillContentControlPicture', 'getDiff']);
  const comparison = useDocxodusOperation('docxDiffCompareProducts');
  const history = useDocumentHistory({ documentId: 'consumer', indexedDbName: 'consumer' });
  void commands; void comparison; void history; void copyDocxodusRuntime; void convertDocxToPdf;
  return <DocumentViewer session={document.controller} />;
}
`);
run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--jsx', 'react-jsx', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'bundler', '--types', 'react,node', 'consumer.tsx'], temp);
const metadata = JSON.parse(await readFile(join(temp, 'package/package.json'), 'utf8'));
assert.equal(metadata.peerDependencies.docxodus, '12.4.1');
assert.equal(metadata.peerDependenciesMeta['@docxodus/export'].optional, true);
console.log(`Packed consumer types passed. ${pack.entryCount} files, ${pack.size} compressed bytes. Artifacts: ${temp}`);
