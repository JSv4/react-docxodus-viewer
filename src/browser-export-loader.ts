/**
 * Load the byte-identical export bundle from the static runtime deployment.
 * The exporter verifies its own digest, so bundlers must not rewrite this file.
 */
export async function loadBrowserExporter(moduleUrl: string): Promise<typeof import('docxodus/export-browser')> {
  return import(/* @vite-ignore */ moduleUrl);
}
