import { fileURLToPath } from 'node:url';
import { copyDocxodusRuntime } from './copy-runtime.mjs';
const result = await copyDocxodusRuntime(fileURLToPath(new URL('../public/', import.meta.url)));
console.log(`Synchronized and verified Docxodus ${result.version} WASM and export runtime assets.`);
