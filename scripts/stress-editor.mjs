import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const url = 'https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx';
const expected = 'd75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29';
const directory = join(tmpdir(), 'rdv-stress-fixtures');
const path = process.env.RDV_STRESS_DOCX || join(directory, 'NVCA-Model-COI-10-1-2025.docx');
await mkdir(directory, { recursive: true });
let bytes = await readFile(path).catch(() => null);
const verified = bytes => bytes && createHash('sha256').update(bytes).digest('hex') === expected;
if (!process.env.RDV_STRESS_DOCX && !verified(bytes)) bytes = null;
if (!bytes && !process.env.RDV_STRESS_DOCX) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Fixture download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (verified(bytes)) {
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  }
}
if (!verified(bytes)) {
  throw new Error('The stress fixture must match the pinned NVCA October 2025 document.');
}
const args = process.argv.slice(2);
const benchmark = args[0] === '--benchmark';
if (benchmark) args.shift();
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', benchmark ? 'performance.spec.ts' : 'nvca.spec.ts', ...args], {
  stdio: 'inherit', env: { ...process.env, RDV_STRESS_DOCX: path, ...(benchmark ? { RDV_PERFORMANCE: '1' } : {}) },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
