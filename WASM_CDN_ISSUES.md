# Docxodus 12.6.2 runtime deployment

Deploy runtime files from the same package version as the JavaScript engine. The
React package pins 12.6.2; earlier .NET 8 assets cannot be mixed with its .NET 10
runtime. This document supersedes the older 3.x CDN workarounds.

## Copy verified static assets

```sh
npm install docxodus@12.6.2
npx rdv-copy-runtime public/docxodus
```

Or call the Node build helper:

```js
import { copyDocxodusRuntime } from 'react-docxodus-viewer/assets';
await copyDocxodusRuntime('public/docxodus');
```

It verifies every entry in the installed `export-assets.json` before copying,
then replaces the destination's `wasm/_framework` directory and copies the worker,
materializer, pagination bundle, schemas and manifest. Other files in the chosen
directory remain untouched. Deploy that directory as static files. The demo uses
`npm run sync:wasm` to place this same layout directly in `public/`.

```text
public/docxodus/
  export-assets.json
  export-browser.bundle.js
  export-resource-limits-v1.json
  render-report-v2.schema.json
  pagination.bundle.js
  docxodus.worker.js
  wasm/_framework/...
```

Configure `wasmBasePath="/docxodus/wasm/"`. For a site hosted under a URL prefix,
include that prefix, for example `"/my-app/docxodus/wasm/"`. The export hook derives
the materializer URL as a sibling of `wasm/`; an explicit `browserModuleUrl` is
available for custom hosting layouts.

## Export bundles must remain byte-identical

The 12.6.2 browser materializer fetches its own module and verifies its length and
SHA-256 against `export-assets.json`. Rebundling, minifying, rewriting imports or
appending a source-map comment changes those bytes and causes an explicit runtime
verification failure. Runtime WASM and worker files are also verified.

Use `useDocumentExport()` / `ExportPanel`, which load the raw static module, or:

```ts
const exporter = await loadBrowserExporter('/docxodus/export-browser.bundle.js');
const result = await exporter.convertDocxToPaginatedHtml(file, {
  wasmBasePath: '/docxodus/wasm/',
  reviewProfile: 'final', commentProfile: 'hidden',
});
```

The `/export-browser` package entry re-exports the upstream contract. Bundlers can
use its types and helpers, but actual materialization needs the unchanged static
module. Do not regenerate asset hashes to hide a transformed or mismatched runtime.

## Vite development

Vite may treat a dynamic import of a public `.js` file as a source import and
append `?import`. Its normal source transforms are incompatible with digest-checked
assets. Serve the runtime directory through a middleware before Vite's transforms.
The repository's `wasmPublicPlugin` in `vite.config.ts` is the working example for
the demo's `/wasm/` and root export files.

For the suggested `/docxodus/` layout, a small pre-transform middleware can serve
only known copied assets. The essential behavior is to ignore query strings and
return the original bytes with the correct MIME type. Keep path resolution bounded
to the configured static directory. Production Vite builds copy public files
unchanged; the production-preview integration test covers this configuration.

## HTTP serving

Serve `.wasm` as `application/wasm`, JavaScript as `application/javascript`, and JSON
as `application/json`. If serving `.br` precompressed variants, set
`Content-Encoding: br` and the original content type. Servers without precompressed
support can serve the uncompressed counterparts.

Use a same-origin runtime deployment. If cross-origin isolation is needed by the
hosting configuration, serve `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. The demo config supplies these headers;
its static hosting fallback also includes the existing COI service worker.

Do not patch `dotnet.js` fetch behavior. `credentials: "same-origin"` does not itself
send credentials to a different origin; the older recommendation to patch it was
not a sound basis for deployment and would invalidate the new asset identity.
Check the actual response headers, requested URLs and matching package version.

## Node/PDF export

Install `@docxodus/export@12.6.2` and import `/server` only in Node. The companion
owns its runtime deployment and browser materialization pipeline. It requires a
non-root host with Chromium's sandbox and, on Linux, permitted user namespaces.
`checkExportEnvironment()` reports deployment findings without rendering a file.

This development host currently denies unprivileged user namespaces, including
outside the command sandbox. The Node API boundary test passes; the real PDF test
therefore reports a skip. It can be required on an eligible render host with:

```sh
DOCXODUS_REQUIRE_PDF=1 npm run test:pdf
```

Browser standalone HTML export is exercised with networking disabled after export
and remains viewable as an offline artifact.
