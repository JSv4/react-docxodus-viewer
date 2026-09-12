#!/usr/bin/env node
import { copyDocxodusRuntime } from './copy-runtime.mjs';
if (process.argv.includes('--help')) console.log('Usage: rdv-copy-runtime [public/docxodus]\nCopies the verified Docxodus 12.4.1 runtime to a static asset directory.');
else {
  const result = await copyDocxodusRuntime(process.argv[2] ?? 'public/docxodus');
  console.log(`Copied Docxodus ${result.version} (${result.verifiedAssets} verified assets) to ${result.directory}`);
}
