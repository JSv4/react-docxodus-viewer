# react-docxodus-viewer

React components and hooks for viewing, editing, reviewing, comparing, verifying,
and exporting Word documents with **Docxodus 12.4.1**. The viewer uses the core
engine and a React-owned pagination component; it does not load the upstream
browser editor or ribbon.

[Demo](https://jsv4.github.io/react-docxodus-viewer/) ·
[API guide](docs/API.md) · [Migration from 0.6–0.7](docs/MIGRATION-0.8.md) ·
[Runtime deployment](WASM_CDN_ISSUES.md)

## Install

Requires React 18+ and an ESM-capable application bundler.

```sh
npm install react-docxodus-viewer docxodus@12.4.1
npx rdv-copy-runtime public/docxodus
```

The copy command verifies the package's asset digests and stages matching WASM,
worker, pagination and export assets. Run it after installing dependencies and
before your application's build. See the deployment guide for Vite development.

```tsx
import { DocumentViewer } from 'react-docxodus-viewer';
import 'react-docxodus-viewer/styles.css';

export default function App() {
  return <DocumentViewer wasmBasePath="/docxodus/wasm/" fitMode="page-width" />;
}
```

## Live document sessions

A session retains all 140 native synchronous methods, including atomic batches,
preconditions, undo/redo and structured error results. Committed edits notify
React and refresh attached viewers. Opening a replacement succeeds before the
previous native handle is closed.

```tsx
import { DocxodusProvider, DocumentViewer, SessionEditorPanel, CommentsPanel,
  useDocxSession } from 'react-docxodus-viewer';
import { useState } from 'react';
import 'react-docxodus-viewer/styles.css';

function Workspace() {
  const document = useDocxSession();
  const [anchor, setAnchor] = useState<string>();
  return <>
    <button onClick={() => document.create().catch(console.error)}>New document</button>
    {document.error && <p role="alert">{document.error.message}</p>}
    <DocumentViewer session={document.controller} onAnchorSelect={setAnchor}
      rendererFingerprint="my-layout-v1" fitMode="page-width" />
    <SessionEditorPanel session={document.controller} anchorId={anchor} />
    <CommentsPanel session={document.controller} anchorId={anchor} />
  </>;
}
export default function App() {
  return <DocxodusProvider wasmBasePath="/docxodus/wasm/"><Workspace /></DocxodusProvider>;
}
```

## Capabilities

| Area | React surface |
| --- | --- |
| Paginated viewing, zoom, fit, placeholders, canonical anchors, PageMaps and citations | `DocumentViewer`, `PaginatedDocument` |
| Complete programmatic editing, search, templates, structures, tables, lists, styles, page setup, fields, notes, images, content controls, bookmarks and links | `useDocxSession`, `useSessionCommands`, `useSessionQuery`, `SessionEditorPanel` |
| Native tracked revisions, grouped moves, structural revisions and selective/bulk accept/reject | `RevisionPanel`, live `DocumentViewer` |
| Comments, replies, resolution and native annotations | `CommentsPanel`, `AnnotationsPanel`, `useDocumentComments`, `useSessionAnnotations` |
| Redlines, revision records, edit scripts, semantic changes, batched comparisons, reviewer consolidation and conflicts | `ComparisonPanel`, `SemanticChangesPanel`, `useDocumentComparison` |
| External annotation sets, offset search, validation, HTML projection and OpenContracts exports | `useExternalAnnotations` |
| Package manifests, deliverable and receipt verification, redline reversibility | `VerificationPanel`, `useDocumentVerification` |
| Standalone HTML, reports, font/resource policies and optional host PDF export | `ExportPanel`, `useDocumentExport`, `loadBrowserExporter` |
| Memory/custom/IndexedDB history, checkpoints, restore/retry, timeline queries and portable archives | `HistoryPanel`, `useDocumentHistory` |
| Every core engine function, with typed arguments and loading/error state | `useDocxodusApi`, `useDocxodusOperation` |

The smaller panels expose common workflows. Every upstream engine operation and
option remains available for applications that supply their own controls. See
[the API guide](docs/API.md) for complete families and examples.

## Viewer props

| Prop | Default | Purpose |
| --- | --- | --- |
| `file`, `document` | uncontrolled | A controlled `File` or `File \| Uint8Array`; `document` takes precedence |
| `session` | — | Live `DocxSessionController`; takes precedence over file/document |
| `html` | undefined | Host-generated paginated HTML; supplying it skips conversion |
| `revisions` | extracted | Native `RevisionListEntry[]` for a host-rendered view |
| `settings`, `defaultSettings` | `DEFAULT_SETTINGS` | Controlled or initial viewer settings |
| `conversionOptions` | — | Complete converter overrides, except pagination mode/scale |
| `defaultZoom`, `fitMode` | `0.8`, `manual` | Initial scale or `page-width`/`page` fitting |
| `toolbar`, `toolbarActions` | `top`, `[]` | Toolbar placement and custom icon actions |
| `showUploadButton`, `showSettingsButton`, `showRevisionsTab` | true | Built-in controls |
| `allowRevisionResolution` | true | Accept/reject actions with a live session |
| `rendererFingerprint`, `layoutToken`, `citation` | — | Exact measured layout identity and citation navigation |
| `selectedAnchorId` | — | Highlight the selected block without changing document formatting |
| `onAnchorSelect`, `onPageMap`, `onPaginationComplete` | — | Selection and layout callbacks |
| `onFileChange`, `onConversionStart`, `onConversionComplete`, `onError` | — | Document lifecycle callbacks |
| `onPageChange`, `onRevisionsExtracted`, `onRevisionSelect`, `onSettingsChange` | — | Review and control callbacks |
| `wasmBasePath`, `useWorker`, `warmup` | auto, true, false | Runtime location, conversion worker and optional warmup |
| `className`, `style`, `placeholder` | — | Container customization |

Use `onFileChange={setFile}` to control the input. Omit `html` when the viewer
should convert the file; `html={null}` explicitly supplies an empty rendered view.
Settings that affect conversion use the settings dialog's **Apply** action; zoom,
page numbers and paragraph fragmentation update layout directly.

```tsx
const [file, setFile] = useState<File | null>(null);
<DocumentViewer file={file} onFileChange={setFile} wasmBasePath="/docxodus/wasm/" />;
```

`ViewerSettings` includes all earlier rendering options plus `fragmentParagraphs`
and `stampAnchors` (both default true). Comment modes are `disabled`, `endnote`,
`inline`, `margin`; annotation modes are `disabled`, `above`, `inline`, `tooltip`,
`none`. Documents render in an open ShadowRoot to isolate their styles. Set
`conversionOptions.additionalCss` to customize document content; host selectors
continue to style the viewer controls and panels.

```css
.rdv-viewer {
  --rdv-page-gap: 20px;
  height: 75vh;
}
```

## Entry points

- `react-docxodus-viewer`: React UI/hooks, all core engine exports and worker APIs.
- `/engine`: the complete `docxodus/core` API, without React UI.
- `/worker`: the complete worker proxy API.
- `/export-browser`: complete upstream browser export contracts/helpers. Keep the
  materializer bundle static; use `loadBrowserExporter()` for actual bundled apps.
- `/server`: complete `@docxodus/export` Node/PDF API. Install the optional companion
  with `npm install @docxodus/export@12.4.1`.
- `/assets`: Node build helper `copyDocxodusRuntime(directory)`.
- `/styles.css`: viewer and feature-panel styles.

ESM is the supported module format. CommonJS hosts can use asynchronous `import()`.
The Node export companion is not imported by browser entry points.

## Runtime and data ownership

Use a current browser with WebAssembly and ES modules. Browser integration tests
run in Chromium; older minimum browser versions from 0.6 are no longer asserted
for the .NET 10 runtime. Core sessions run synchronously on the main thread;
worker conversion remains available. Full sessions are broader than upstream
worker sessions.

The default components process documents in the browser. Host-provided history
storage or a PDF exporter may use a service according to the host's implementation.
History defaults to memory; IndexedDB requires an explicit database name. The demo
uses IndexedDB. Input bytes and document content are not sent to a service by the
library itself.

## Development

The demo is a document studio with a built-in sample, paragraph quick actions,
text search and heading navigation, tracked and semantic review, checkpoint previews,
and a focus mode. Press Ctrl/⌘ K for commands, Ctrl/⌘ F to search the document,
and Ctrl/⌘ S to download the current DOCX. Checkpoints use a separate local history
for each opened file. Downloads retain the document name.

```sh
npm install
npm run dev              # sync verified assets, then start Vite
npm run check            # lint, unit tests, types, library/demo builds, API audit
npm run test:browser     # actual 12.4.1 WASM workflows
npm run test:package     # packed consumer imports, types and runtime-copy command
npm run test:pdf         # Node boundary + PDF when the host supports its sandbox
```

Set `DOCXODUS_REQUIRE_PDF=1` to make an unavailable PDF environment fail that test.
Set `RDV_TEST_PORT` to run browser checks on a different local port. Use
`RDV_TEST_PREVIEW=1` after building to exercise the production demo.
The API audit compares every published export against the installed 12.4.1
TypeScript declarations and checks identity of the built runtime exports.

MIT. Powered by [Docxodus](https://github.com/JSv4/Docxodus).
