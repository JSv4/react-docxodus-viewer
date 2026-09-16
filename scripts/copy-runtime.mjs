import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** Copy the matching, unmodified engine/export runtime into a host's static directory. */
export async function copyDocxodusRuntime(destination) {
  const dist = dirname(fileURLToPath(import.meta.resolve('docxodus/core')));
  const { version } = JSON.parse(await readFile(resolve(dist, '../package.json'), 'utf8'));
  if (version !== '12.6.2') throw new Error(`Expected Docxodus 12.6.2, found ${version}`);
  const manifest = JSON.parse(await readFile(resolve(dist, 'export-assets.json'), 'utf8'));
  if (manifest.packageVersion !== version) throw new Error('Export assets do not match the engine version.');
  for (const asset of manifest.assets) {
    if (!/^\.\/[\w./-]+$/.test(asset.path) || asset.path.includes('..')) throw new Error(`Invalid runtime asset path: ${asset.path}`);
    const bytes = await readFile(resolve(dist, asset.path));
    if (bytes.length !== asset.byteLength || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Invalid runtime asset: ${asset.path}`);
  }
  const target = resolve(destination);
  await mkdir(target, { recursive: true });
  await rm(resolve(target, 'wasm/_framework'), { recursive: true, force: true });
  await cp(resolve(dist, 'wasm/_framework'), resolve(target, 'wasm/_framework'), { recursive: true });
  for (const asset of manifest.assets) {
    if (!asset.path.startsWith('./wasm/')) await cp(resolve(dist, asset.path), resolve(target, asset.path));
  }
  await cp(resolve(dist, 'export-assets.json'), resolve(target, 'export-assets.json'));
  return { version, directory: target, verifiedAssets: manifest.assets.length };
}
