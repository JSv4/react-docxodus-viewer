# React API guide

Import UI/hooks from `react-docxodus-viewer` and its stylesheet once. All engine
exports are also available from `/engine`; all worker APIs from `/worker`.
The public declaration files are the authoritative parameter and return types.
The integration preserves native method signatures, overloaded methods, structured
results and unsupported-operation diagnostics.

For standalone `DocumentViewer` and `DocumentEditor` blocks, formatting toolbars,
direct page typing, optional paragraph authoring, and custom layouts, see [embedding modules](embedding.md).

## Runtime and operation hooks

`DocxodusProvider` shares the conversion worker across descendants. Set
`wasmBasePath`, `useWorker` and optional `warmup` on the provider; its configuration
applies to descendants. Without a provider, a hook/viewer owns its runtime.
Workers terminate on unmount, including initialization still in progress.
Full editable sessions use the main-thread core because the worker session only
supports annotation mutations, manifests, verification and semantic changes.

```tsx
const { call } = useDocxodusApi({ wasmBasePath: '/docxodus/wasm/' });
const projection = await call('convertWmlToMarkdown', file, {
  scopes: ProjectionScopes.All,
});

const metadata = useDocxodusOperation('getDocumentMetadata');
await metadata.execute(file);
// metadata.data, metadata.error, metadata.isRunning, metadata.cancel(), metadata.reset()
```

`useDocxodusApi().call(name, ...args)` initializes the core and supports **every
exported engine function**, with inferred arguments/results. Constructors and
pure helpers can also be imported directly. Operation hooks suppress stale state
updates and abort owned work when supported. Cancellation cannot interrupt a
synchronous WASM call already executing; the Promise returned to its caller still
settles normally unless the underlying operation honors the signal.

## Session ownership and all editing families

```tsx
const document = useDocxSession(file, {
  settings: { undoDepth: 50, undoMemoryBudgetBytes: 128 * 1024 * 1024 },
});
const { controller, session, version, error, isLoading } = document;
// Omit file for manual document.open(file), document.create(), document.close().
// source=null closes the session; an invalid replacement retains the previous one.

// Memoize selectors with React's useCallback (or declare them outside the component).
const readProjection = useCallback((s: DocxSession) => s.project(), []);
const projection = useSessionQuery(controller, readProjection);
const commands = useSessionCommands(controller, ['replaceText', 'insertTable', 'undo']);
const result = commands.replaceText(anchorId, '**Revised clause**');
if (!result.success) console.error(result.error?.code, result.error?.message);
```

`session` exposes all 140 public native methods. Calls through that session or
`controller.run()` observe mutations and notify subscribers. `useSessionCommands`
returns any requested subset with the original signatures. `useSessionQuery`
executes a read-only selector again when the session changes. Its optional
`{ scope: 'document' }` excludes page-map notifications; `{ deferred: true }`
lets React defer noncritical previews within the same owner. Deferred values may
briefly lag edits, while document replacement and close discard prior-owner
results immediately. Keep selectors stable and use current native state to
validate mutations. `controller.read()`
is read-only by contract; do not mutate through a selector. `controller.save()`
returns current DOCX bytes; `controller.originalBytes` returns a detached copy of
the opening document.

`controller.getAnchorIndex()` reads the native anchor inventory without building
the Markdown projection. Internally the viewer uses `getRenderChanges(owner,
fromVersion)` and `renderBlocks(ids, options)` to render local text/formatting edits
from that same session. A `null` change set requires the full converter. Batches,
rollbacks, unknown mutations, and replaced session owners are checked before a
block update can advance the displayed version. `onConversionStart` and
`onConversionComplete` report full conversions; `onPageMap` and
`onPaginationComplete` also report layouts updated through native blocks.

| Family | Native operations available through the session |
| --- | --- |
| Projection and inspection | `project`, `projectAnchor`, `renderBlock`, `exists`, anchor/block metadata and bulk lookups, inline spans, formatting, styles, section info |
| Search | `findByText`, `findAllByText`, `findByRegex`, `findByKind`, `grep`, `grepCrossBlock`, bookmark/annotation/label discovery |
| Text and templates | `replaceText`, `replaceTextRange`, `replaceMatch`, `replaceInner`, placeholder discovery/filling/remaining placeholders |
| Blocks | insert/split/merge paragraphs, delete/move blocks, delete ranges/sections, horizontal rules |
| Formatting | whole-block/span/substring/match formatting, paragraph format/style, font, size, highlight, capitals and script position |
| Lists | apply/remove membership, ranges, nesting, numbering start overrides and inspection |
| Tables | insert table/rows/columns, delete rows/columns, replace cell content, merge/unmerge, widths, borders, shading, repeat headers, row options and coordinate/anchor resolution |
| Pages and running stories | page setup/numbering, header/footer text, first/even/default visibility, page-number fields |
| Reference fields and notes | table of contents/figures/authorities, cross-references, footnotes/endnotes |
| Images | capabilities, insert/replace/remove, dimensions, alt text/title, floating layout and occurrence inspection |
| Content controls | plain/rich text, checkbox/date/choice/picture values, repeating-section add/remove, binding/lock/capability inspection |
| Hyperlinks and bookmarks | list/add/update/rename/move/remove, external/internal links and ranges |
| Review | native revisions, selective/all accept/reject, tracked changes and author, comments/replies/resolve/delete, annotations/update/move/remove |
| Transactions | precondition checks, guarded mutations, atomic/best-effort batches, shadow previews, undo/redo |
| Changes and verification | edit summary, JSON/unified/side-by-side diff, semantic changes, manifest and deliverable verification |
| Citations | PageMap registration/status and page citations |

`SessionEditorPanel` supplies a compact form-based editing UI. The focused hooks
`useDocumentProjection`, `useDocumentImages`, `useContentControls`,
`useDocumentComments`, and `useSessionAnnotations` combine reactive lists with
commands for their respective families. All other native operations remain
available through `session`/`controller.run`/`useSessionCommands`.

### Atomic changes and previews

```tsx
const batch = controller.run(s => s.executeBatch([
  { tool: 'replace', action: 'Update clause',
    mutation: () => s.replaceText(anchorId, 'New clause', {
      expectedVersion: s.getVersion(), expectedContentHash: capturedHash,
    }) },
  { tool: 'format', action: 'Emphasize clause',
    mutation: () => s.applyFormat(anchorId, null, { bold: true }) },
], 'atomic'));
// Atomic failures roll back document changes; inspect batch.failure/steps/warnings.

const preview = controller.run(s => s.previewBatch([
  { tool: 'replace', action: 'Preview clause',
    mutation: shadow => shadow.replaceText(anchorId, 'Proposed clause') },
], 'atomic', { html: 'full' }));
// Preview callbacks must mutate the provided shadow, not the live session.
```

Native callbacks are synchronous. Await uploads, network data or image reads
**before** entering `controller.run()` or a batch. Handle unsuccessful `EditResult`
values explicitly. Do not assume a false result throws an exception.

### Rich structures and controls

```tsx
controller.run(s => {
  s.setParagraphFormat(anchorId, { alignment: 'center' });
  s.applyListFormat(anchorId, 'upperRoman');
  s.setHeaderText(anchorId, 'default', '**Agreement**');
  s.setFooterText(anchorId, 'default', 'Confidential');
  s.setPageSetup(anchorId, { landscape: true, marginLeftTwips: 1440 });
  s.insertFootnote(anchorId, 0, 'Source note');
  s.insertTableOfContents(anchorId, 'before');
});

const imageBytes = new Uint8Array(await imageFile.arrayBuffer());
controller.run(s => {
  const inserted = s.insertImage(anchorId, 0, imageBytes,
    { widthPoints: 144, heightPoints: 72 });
  if (inserted.success && inserted.imageId) {
    s.setImageMetadata(inserted.imageId, 'Diagram description', 'Diagram');
    s.setImageFloatingLayout(inserted.imageId, {
      horizontalRelativeFrom: 'margin', horizontalAlignment: 'right',
      verticalRelativeFrom: 'paragraph', verticalOffsetEmu: 0, wrapMode: 'square',
    });
  }
});

controller.run(s => {
  const controls = s.listContentControls();
  const target = controls.find(control => control.tag === 'ClientName');
  if (target?.canMutate) s.fillContentControlText(target.anchorId, 'Example LLC');
  // Other native control methods retain ContentControlFillOptions, including
  // explicit binding policy. A lock or unsupported placement remains a failure.
});
```

## Revision, comment and annotation review

`RevisionPanel` accepts `RevisionListEntry[]` or `DocxDiffRevision[]`. Native
`onAccept`/`onReject` receive stable revision IDs. `formatDetails` can supply
separately obtained formatting details keyed by native revision ID. Unsupported,
malformed and ambiguous native revisions retain diagnostics and disable resolution.
Live `DocumentViewer` wires selective and bulk resolution automatically.

```tsx
<CommentsPanel session={controller} anchorId={selectedAnchor} author="Reviewer" />
// Alternatively pass revisionId to attach a comment to a native revision.
<AnnotationsPanel session={controller} anchorId={selectedAnchor} />
```

`useExternalAnnotations` keeps annotation sets outside DOCX bytes. `create()` also
fills missing label definitions from embedded annotations; the raw engine's
`createExternalAnnotationSet()` leaves those definitions to the host.

```tsx
const external = useExternalAnnotations();
const set = await external.create(file, 'agreement-123');
const mark = createAnnotationFromSearch('clause-1', 'IMPORTANT', set.content, 'shall');
set.textLabels.IMPORTANT = { id: 'IMPORTANT', text: 'Important', color: '#ffeb3b',
  description: '', icon: '', labelType: 'text' };
if (mark) set.labelledText.push(mark);
const validation = await external.validate(file, set);
const html = await external.project(file, { paginationMode: PaginationMode.Paginated },
  { labelMode: AnnotationLabelMode.Above }, set);
const openContracts = await external.exportOpenContracts(file);
```

The full helpers for offsets, search, adding/removing/projecting annotations onto
existing HTML, and generated label CSS are available through `external.call` and
core exports. Persist modified annotation sets using host state/storage.

## Comparison and semantic changes

```tsx
const review = useDocumentComparison();
const combined = await review.compare(before, after, {
  preserveInputRevisions: true, detectMoves: true,
  compareHeadersFooters: true, trackBlockFormatChanges: true,
});
// One engine pass returns redline, revisions, parsed editScript and semanticChanges.
const candidates = await review.compareBatch(before,
  [{ name: 'First reviewer', document: first }, { name: 'Second reviewer', document: second }]);
const consolidated = await review.consolidate(before,
  [{ author: 'First', document: firstBytes }, { author: 'Second', document: secondBytes }],
  { conflictResolution: ConflictResolution.StackAll });
// consolidated.document/html/conflicts/revisions/editScript
```

A batch failure is attached to that candidate; other candidates retain their
products. `compare()` and `compareBatch()` accept a product list when only some
outputs are needed. Every `DocxDiffSettings` option is forwarded. Single-product
functions, comparison aliases, consolidation conflict queries, and accepted/
rejected projections remain available through `review.call` or direct imports.
`ComparisonPanel` provides file selection and all three review modes.
`SemanticChangesPanel` renders typed before/after values by semantic family.

## Measured pages and citations

```tsx
<DocumentViewer session={controller} rendererFingerprint={layoutFingerprint}
  citation={selectedCitation} onPageMap={map => saveMeasuredMap(map)}
  selectedAnchorId={selectedAnchor} onAnchorSelect={setSelectedAnchor} />

const citation = controller.run(s => s.getPageCitation(selectedAnchor, {
  documentVersion: s.getVersion(), rendererFingerprint: layoutFingerprint,
}));
```

A PageMap is actual browser layout, not an estimated page count. The viewer
registers a completed map only when its document version still matches the live
session. Editing invalidates the old map; citations explicitly report unavailable
until the matching new map arrives. The host fingerprint must identify its layout
inputs (fonts, CSS, rendering settings and renderer build). Change it when those
inputs change. Zoom coordinates remain page-relative points.

`onAnchorSelect` selects the containing paragraph when inline comment or revision
markup is clicked. Pass that anchor back as `selectedAnchorId` to draw a selection
outline; it does not modify the DOCX. Customize its color with
`--rdv-selection-color`. The editor panel reads the complete anchor text, including
content longer than the projection preview, and refreshes it after apply/undo/redo.
Hidden viewers wait until they have a measurable layout before paginating.

When using host-generated HTML, pass `layoutToken` matching the exact document
snapshot used to generate it. The pure `PaginatedDocument` component supports
`fragmentParagraphs`, `layoutToken`, `citation`, `selectedAnchorId`, `onPageVisible` and
`onPaginationComplete` without an editor. Its `onRootChange` callback exposes the
isolated document DOM for host navigation.

## Verification

```tsx
const verification = useDocumentVerification();
await verification.inspect(finalDocument);
await verification.verify(finalDocument, baseline);
await verification.prove(baseline, finalDocument, redline);
await verification.verifyReceipt(receiptJson, { final: finalBytes, redline: redlineBytes });
await verification.compareSemantics(baseline, finalDocument);
```

Read each result's decision/findings; `analysisCompleted` does not imply approval.
Receipt results distinguish envelope/contract/digest/citation validity and artifact
availability. The hook preserves structured engine errors and full proof results.
`VerificationPanel` renders and downloads these reports.

## Export

```tsx
const exporter = useDocumentExport({
  wasmBasePath: '/docxodus/wasm/',
  browserModuleUrl: '/docxodus/export-browser.bundle.js', // optional with this WASM path
});
const html = await exporter.exportHtml(file, {
  reviewProfile: 'markup', commentProfile: 'margin',
  title: 'Agreement review', strictFonts: false, unsupportedContent: 'warn',
  timeoutMs: 60000, limits: { finalPages: 1000 },
  // fontResolver, documentVersion, expectedSourceDigest and signal are also forwarded.
});
downloadDocument(html.html, 'agreement.html', 'text/html');
// html.pageMap, html.renderReport, html.warnings, html.rendererFingerprint
```

Profiles: `final`/`original`/`markup`; comments: `hidden`/`inline`/`endnotes`/`margin`.
All native font, resource-limit, timeout, signal and digest options are supported.
Render errors retain structured diagnostics and any failed render report.
`ExportPanel` accepts native options plus an optional `pdfExporter` callback.
That callback is host-owned; the browser package never imports Node PDF tooling.

```ts
// Node ESM: install @docxodus/export@12.4.1
import { checkExportEnvironment, convertDocxToPdf, renderDocxArtifacts,
  renderDocxFile } from 'react-docxodus-viewer/server';
const environment = await checkExportEnvironment();
if (!environment.ok) throw new Error(JSON.stringify(environment.findings));
const pdf = await convertDocxToPdf(bytes, { reviewProfile: 'final', commentProfile: 'hidden' });
const bundle = await renderDocxArtifacts(bytes,
  { outputs: ['html', 'pdf'], reviewProfile: 'markup', commentProfile: 'margin' });
await renderDocxFile('input.docx', { pdfPath: 'output.pdf', reportPath: 'report.json' },
  { reviewProfile: 'final', commentProfile: 'hidden' });
```

The full companion API includes standalone HTML, batch/file outputs, host browser
ownership, font directories/resolvers/license attestations, environment reports
and resource-policy errors. Chromium must run with its sandbox; unsupported hosts
are reported by the environment preflight.

## Durable history and archives

```tsx
const history = useDocumentHistory({
  documentId: 'agreement-123', indexedDbName: 'agreements', pageSize: 20,
});
<HistoryPanel history={history} getDocument={() => controller.save()}
  author="Reviewer" onPreview={showPreview}
  onRestore={async bytes => { await controller.open(bytes); }} />;

await history.save(controller.save(), {
  author: 'Reviewer', createdAt: new Date().toISOString(), label: 'Client review',
});
const acknowledged = await history.restore(versionId, {
  author: 'Reviewer', createdAt: new Date().toISOString(), label: 'Restored review',
});
await controller.open(await history.preview(acknowledged.version.id));
```

The hook owns the native client/database until active calls finish. Default
storage and checkpoint journal are in memory. For custom persistent storage, pass
both `storage` and a durable `journal`; otherwise a pending request does not survive
a page reload. The journal must implement the upstream insert-only, document-scoped
contract. IndexedDB supplies both storage and journal.

`pendingRequest` retains the original save/restore inputs after an uncertain
publication. Call `retry()` explicitly; do not clear it and start a different
request. `needsRefresh` requires explicit `refresh()`. A restore returns the exact
acknowledged version; opening it is a separate host action. A failed list refresh
after a successful checkpoint reports a warning while preserving its acknowledgement.

Additional methods cover `loadMore`, `preview`, `compare`, `exportArchive`,
`importArchive`, `resolveTime`, `materialize`, `replay`, `readChangesSince`,
`readOperationsSince`, `getOperation` and `exportOperationProposal`.
Sequences are decimal **strings**, never JavaScript numbers.

```tsx
const archived = useDocumentHistory({ documentId: 'archive-view', archive: archiveFile });
// Archived history is read-only. documentId in the reader comes from the archive.
const operation = await history.getOperation(operationId);
const proposal = await history.exportOperationProposal(operation.id);
const bytesAtTime = await history.materialize(await history.resolveTime(cutoffIso));
// Full typed reader/client/checkpoint APIs, including native optional limits:
const version = await history.execute(({ reader }) => reader.getVersion(versionId));
```

`execute()` leases the current native handles for the duration of the awaited
callback. Do not retain those handles or fire-and-forget native work beyond it.
Host storage controls persistence and concurrency; this library adds no network
transport, subscriptions, autosave timer or automatic retry policy.
