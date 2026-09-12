# Migrating from 0.6–0.7 / Docxodus 6.2–7.0.1

Version 0.8 integrates Docxodus **12.4.1**, including its .NET 10 WASM runtime.
The earlier peer range accepted engine versions whose revision contracts were
incompatible with the viewer. Both the peer and development dependency are now
pinned to 12.4.1. Replace the entire runtime asset set during deployment.

## Required changes

1. Install `docxodus@12.4.1`; run `npx rdv-copy-runtime public/docxodus` and set
   `wasmBasePath="/docxodus/wasm/"`. Deploy the generated static files unchanged.
2. Use ESM imports. The new engine only publishes ESM import conditions, so the
   viewer no longer advertises a nonworking CommonJS bundle. A CommonJS application
   can `await import('react-docxodus-viewer')` inside an async function.
3. Update consumers of native revision callbacks to `RevisionListEntry`.
4. Remove deprecated comparison options such as `engine` and `detailThreshold`.
   Use the current DocxDiff settings instead.
5. Review document-content CSS: pages now use an open ShadowRoot. Pass content
   styles through `additionalCss`; viewer/chrome CSS customization stays outside it.

## Native revisions and comparison records are distinct

| 6.2 native revision | 12.4.1 native revision |
| --- | --- |
| `revisionType` | `type`: insert/delete/move/format/structure |
| `date` | Optional `date`, plus `dateUtc` when carried by the markup |
| `text` | `text` (may be empty for structural changes) |
| Separate move records | One atomic move record with a stable `id` |
| Limited revision details | `family`, `affectedAnchors`, `constituentKeys`, `resolutionStatus`, optional diagnostic |

Native records no longer carry comparison `formatChange` details. Do not cast them
to the older shape. `RevisionPanel` accepts native records and the separate
`DocxDiffRevision` comparison records. Comparison records retain `revisionType`,
`date`, move halves, `leftAnchor`/`rightAnchor`, and optional `formatChange`.
Native accept/reject actions use the atomic native **revision ID**.

The deprecated exported `Revision` type aliases `RevisionListEntry` to ease import
migration; it does not restore the old fields. The panel preserves revision
expansion while filters change and disables unsupported/ambiguous resolution.

## Capability delta

| Capability | Previous wrapper | 0.8 integration |
| --- | --- | --- |
| Native revision review | Display only | Structural families, grouped moves, diagnostics, selective/bulk resolution |
| Comparison | Basic two-document demo | All DocxDiff settings/products, semantic changes, fan-out batches, consolidation/conflicts |
| Editing | No React session ownership | Complete 140-method native session API; observed changes, queries and commands |
| Document manipulation | Not integrated | Text/formatting, tables, lists, page setup, fields, notes, images, content controls, links/bookmarks |
| Comments and annotations | Display/basic annotation demo | Native comment lifecycle/replies, native annotation editing, external validation/projection/OpenContracts |
| Pagination | Upstream React paginator | React-owned core pagination, paragraph fragments, exact PageMaps/citations and invalidation |
| Verification | Not integrated | Package manifests, deliverable and receipt verification, redline reversibility proofs |
| Exports | DOCX download examples | Standalone HTML with reports/policies; optional Node PDF and file/batch exports |
| Durable history | Not integrated | Custom/memory/IndexedDB storage, checkpoints/restore/retry, timelines, operations, proposals and archives |

The upstream web editor and ribbon are not part of this integration. The React
form-based panels are optional compositions over the same complete engine API.
Applications can implement their own controls without losing upstream operations.

## Behavioral details

- A provider shares worker conversion; full editable sessions initialize the core
  runtime on demand. The full session retains synchronous return values and native
  batch callback semantics. Do not pass async callbacks to `controller.run()`.
- `persistAnchorIds` defaults to true in the React controller because a live viewer
  renders saved snapshots. This retains canonical identities across save/reopen and
  can enlarge DOCX packages. Set it false for workflows that do not need identity
  continuity. Page citations require identities to survive the rendered snapshot.
- `html={null}` is an explicitly empty controlled HTML view. Omit `html` to enable
  conversion of a supplied file. Source precedence is session → document → file.
- Core engine operations return their own structured failures and unsupported
  diagnostics. The React layer does not invent support for unsupported OOXML or
  make a verification/proof result successful merely because analysis completed.
- The comparison hook defaults to accepting pre-existing input revisions before
  comparison, preserving the earlier demo's behavior. Pass
  `preserveInputRevisions: true` to retain input review state; this takes precedence.
- `useDocumentHistory` is explicit checkpoint history, not autosave. A pending
  publication must be retried with the original request. Restoring creates a new
  checkpoint; it does not delete older versions. Archive readers are read-only.
- Browser HTML export verifies its own bundle and runtime digests. Copy the export
  assets with the matching engine; minifying or bundling the materializer invalidates
  that verification. See [deployment](../WASM_CDN_ISSUES.md).
- Node PDF requires the optional matching companion and a host capable of launching
  Chromium with its sandbox. Run `checkExportEnvironment()` during deployment.

## Verification scope

The integration's API audit covers all 363 core exports, six worker exports, 57
browser-export exports and 48 Node-companion exports. All 118 core runtime exports
retain identity in the built package. Browser tests exercise the actual WASM
runtime across viewing, editing, rollback, comparison, history, verification and
standalone HTML export. These checks cover representative operations in each
family; they are not a claim that every possible Word document renders identically.
