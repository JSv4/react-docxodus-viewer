import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as server from '../../dist/server.es.js';
import * as upstream from '@docxodus/export';

test('Node export entry preserves the complete companion API', () => {
  for (const [name, value] of Object.entries(upstream)) assert.equal(server[name], value, name);
});

test('renders a verified PDF with the host Chromium sandbox', async context => {
  const environment = await server.checkExportEnvironment();
  if (!environment.ok) {
    const reason = environment.findings.map(finding => `${finding.code}: ${finding.message}`).join('; ');
    if (process.env.DOCXODUS_REQUIRE_PDF) assert.fail(reason);
    context.skip(reason); return;
  }
  const document = new Uint8Array(await readFile(new URL('../fixtures/content-controls.docx', import.meta.url)));
  const result = await server.convertDocxToPdf(document, { reviewProfile: 'final', commentProfile: 'hidden' });
  assert.equal(Buffer.from(result.pdf.subarray(0, 5)).toString(), '%PDF-');
  assert(result.pageCount > 0);
  assert.equal(result.pageCount, result.pageMap.pages.length);
});
