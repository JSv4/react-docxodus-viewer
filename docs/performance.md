# Editor performance campaign

The current follow-up targets interaction responses under 150 ms. The first
changes remove atomic batch/receipt overhead from single-paragraph formatting,
share formatting and style reads across controls, preserve cached formatting
only for anchors proven unchanged by the native edit journal, and keep page-map
notifications from refreshing document-only queries. Normal typing now builds
its verified native span from formatting instead of requesting a full Markdown
projection for anchor metadata. Caret selection avoids repeated document scans.

In a local Chromium production benchmark of the pinned NVCA document, selected-word
Bold improved from about 1.3 seconds to 80 ms event-to-paint. Twenty-four arrow
presses caused no additional native formatting queries (previously 72). These
first results still left page-map registration and page-flow updates blocking the
main thread for hundreds of milliseconds or longer, motivating the cooperative
layout work below.

## Cooperative layout and reproducible interaction measurements

The follow-up preserves Docxodus's page-flow decisions while yielding between
blocks/pages and preparing incoming editable paragraphs in small chunks. The
active canvas stays mounted during this work. Input, commit timers and React
updates run ahead of background layout tasks; owner/version checks discard
superseded layouts before handoff. Zoom changes during preparation trigger fresh
measurements at the final scale.

The adapter is generated from the pinned 12.4.1 pagination implementation by
`node scripts/generate-cooperative-pagination.mjs`. It uses the same engine
instance and native helpers, with asynchronous traversal calls and checkpoints.
The generator verifies the upstream file's SHA-256; `npm run check:api` also
verifies the generated output. A dependency upgrade requires reviewing this
adapter and rerunning native page/fragment equivalence tests. There is no runtime
code generation. Attribution is in [third-party-notices.md](third-party-notices.md).

Page-map updates reuse previously native-validated anchor ownership only across
journaled local text/run edits. Every new geometry/order/version constraint is
checked again. Structural or unobserved changes, a changed renderer/mode, unknown
fields, non-ASCII identifiers and table-comment presentations use full native
validation. Native transactions and embedded search citations retain their native
semantics. The inspector reads native XML text and list labels without triggering
the full Markdown projection; native differential tests cover that text contract.

Run a production build and preview, then the interaction benchmark in another
terminal:

```sh
npm run build:demo
npm run preview -- --host 127.0.0.1 --port 4191 --strictPort
# In another terminal:
npm run test:latency
RDV_BENCH_MODE=studio npm run test:latency
```

The benchmark downloads/verifies the pinned NVCA fixture, or accepts
`RDV_STRESS_DOCX=/path/to/NVCA.docx`. It waits for the active canvas's native owner,
version and current page map, rather than treating the inert incoming pages as
ready. It exercises steady typing, caret movement, pause/resume bursts,
selected-word Bold and typing during forced reflow. Key counts, persisted text,
untouched surrounding text and browser errors are checked.

Reports and a screenshot go to `test-results/latency` (override with
`RDV_BENCH_OUTPUT`). `RDV_BENCH_PROFILE=1` adds native/canvas call timings;
`RDV_BENCH_CPU=1` independently adds CPU profiles. Use separate output directories
for repeated runs. `RDV_BENCH_DOC=sample` selects the small sample, and
`RDV_BENCH_URL` selects a deployed production build. Run browser benchmarks
serially without concurrent builds or other CPU-heavy work.

Key-handler-to-rAF timing excludes prior input queuing and measures a paint
opportunity. Chrome Event Timing includes queuing, processing and presentation,
uses quantized durations, and is collected with a 16 ms threshold. Its observed
percentiles are not whole-population INP. Long Tasks separately measures main
thread tasks of at least 50 ms, including layout after the final keystroke.
`lastEditToCurrentLayout` separately records the wait for a current page map;
it includes the typing debounce and background layout work. Full repagination
can take longer than an individual input response while the canvas stays usable.
`RDV_LATENCY_LIMIT_MS=150` optionally fails a run when an observed input response
exceeds that threshold. Timing is hardware/workload dependent, so normal CI
checks correctness and structural requirements rather than enforcing wall time.

`useSessionQuery(controller, selector, { scope: 'document' })` opts a read into
document/settings updates only. Its default still observes the full session,
including page-map availability. The controller's shared formatting/styles reads
must be treated as read-only. Unknown mutations, raw native version gaps, session
replacement, and atomic shadow reads invalidate or bypass these caches. Enriched
`editor.details.info` metadata is now evaluated only when accessed and is
non-enumerable so framework prop inspection cannot trigger a native query. Hosts
should explicitly read it from the current details object when they need it.

The reference workload is the 65-page October 2025 NVCA Model Certificate of
Incorporation. Its 234 body paragraphs, 110 footnote paragraphs, fields, lists,
bookmarks, and section changes exercise more than a short sample document.

```sh
npm run test:performance
npm run test:stress
```

Both commands download and verify the same pinned fixture, or reuse
`RDV_STRESS_DOCX=/path/to/document.docx`. Set `RDV_TEST_PORT` to select the local
development server. The performance command needs Playwright Chromium; the full
integrity test also needs Python 3. Normal browser tests skip these opt-in runs.

`test:performance` writes `NVCA-performance.json` under `test-results`. It measures
native opening, first conversion and layout, three zoom levels, and actual typing
in two body paragraphs and a footnote. It records conversion callbacks, native
commit notifications, completed page maps, native method counts/durations, and
browser long tasks. Native method timings can overlap; do not add them together.
Typing uses a 15 ms delay per character and the editor's 350 ms commit debounce.
Opening uses a fresh browser context with cold core/worker runtimes, after the
test harness has loaded; it excludes the fixture download. The harness mounts an
editor after opening a host-owned session.

Compare runs on the same machine without other CPU-heavy work. Wall-clock values
are diagnostic measurements rather than CI pass/fail thresholds. The benchmark
also enforces structural performance requirements: one initial pagination,
retained page DOM during zoom, bounded formatting inspections after an edit, and
one native write for a contiguous typing burst. Complete page maps and preserved
text remain correctness requirements. Ordinary edits must use one native block
batch and zero saved-package conversions; the two body edits retain their pages,
while the footnote edit repaginates from updated source HTML.

## First pass

The full stress test passed before and after this change on September 12, 2026:

| NVCA stress measurement | PR #40 baseline | First pass |
| --- | ---: | ---: |
| Median typing burst → native commit | 2.48 s | 1.45 s |
| Median typing burst → settled layout | 9.20 s | 6.23 s |
| Slowest of twelve edit/layout cycles | 11.51 s | 6.51 s |
| Opening, including the test's native text inventory | 19.12 s | 18.86 s |

That is a 42% reduction in median commit time and a 32% reduction in median
edit-to-layout time. Opening has not materially improved in this full test.
Both runs retained 65 pages, 31 native commits, 13 intentionally modified
paragraphs, one added paragraph, and all integrity assertions. These local
measurements include scripted typing and debounce time.

A separate matched source-harness profile measured zoom at 3.02–3.29 s before
and 0.45–0.60 s after, with no pagination calls after the change. Formatting
inspections during a redraw dropped from 363–364 to 10. That shorter profile's
cold open improved from 13.56 s to 11.49 s; it does not perform the full stress
test's initial paragraph inventory. Tracing and fixture setup differ between
the profiler and Playwright's test runner, so compare each workload to itself.

- Zoom scales existing page elements and remeasures their portable page geometry.
  It does not reconvert, repaginate, detach the canvas, or validate every paragraph.
  Initial fit-to-width uses the same path. Drafts and superseded document versions
  cannot publish a newly measured page map from an outdated canvas.
- Canvas preparation caches native run text under each paragraph's exact native
  subtree hash. A batched `getAnchorInfos` lookup validates the hashes. Changed
  paragraphs receive fresh formatting inspection; document replacement clears
  the cache. Native checks before committing typing remain in place.
- Contiguous insertions and deletions stay single native edits. Word-level diffing
  remains available for drafts that contain multiple changes, preserving the
  formatting of unchanged words without turning a simple insertion into a batch.
- `npm run test:performance` makes these costs and regressions reproducible.

The full NVCA integrity suite verifies the saved document separately, including
unchanged paragraph XML, fields, bookmarks, notes, sections, and unrelated package
parts. See [the stress-test details](editor-stress-test.md).

## Live native blocks

React now shares one native session handle between its complete editing API and
Docxodus 12.4.1's `ListAnchors` and `RenderEditorBlocksHtml` bridge. It does not
instantiate a second upstream editor or save/reopen the document to render a
typing burst. A bounded journal follows successful text/character-formatting
mutations, including synchronous nested batches. Unknown changes, rollbacks,
missing history, and owner replacement cannot be published as local block edits.

The viewer retains authoritative unpaginated HTML, including hidden footnote and
endnote registries. Native block updates preserve pagination metadata and the
document's note reference ordinals. For unfragmented body paragraphs, geometry is
compared with the last committed layout, before browser typing changed the DOM.
Unchanged geometry retains page elements and the canvas event handlers; the page
map is measured for the new native version. Changed wrapping, fragments, tables,
and notes repaginate the updated source. Structural/global edits, image-bearing
blocks, nested source identities, and unsupported custom render profiles retain
the full converter fallback.

Editor-owned sessions and demo sessions also use `emitMarkdownPatch: false`, as
the native TypeScript editor does. General host-owned controllers retain the
upstream default for consumers that need Markdown patches. The performance
benchmark explicitly opts out; the full integrity stress test continues to
exercise the general controller default. The studio no longer saves snapshots on
every notification: it requests them when Verify or Export is open.

The first live-block benchmark on September 12, 2026 measured:

| Same NVCA benchmark | Previous pass | Native blocks |
| --- | ---: | ---: |
| First body typing → settled layout | 5.43 s | 1.71 s |
| Middle body typing → settled layout | 5.36 s | 1.80 s |
| Footnote typing → settled layout | 5.36 s | 2.55 s |
| Native write duration | 148–158 ms | 8–49 ms |
| Saves / whole conversions per ordinary edit | 1 / 1 | 0 / 0 |
| Pagination calls per body edit | 1 | 0 |

These timings include scripted typing and the 350 ms debounce. The new profile's
Markdown setting contributes to the native write improvement. Body commit →
settled geometry was about 0.51–0.52 s; footnote reflow took 1.39 s after commit.
Cold open remains a full conversion and layout, and is a separate performance
problem. The native block render itself measured 9–102 ms for these paragraphs.

The full NVCA integrity workload also passed with the host controller's original
Markdown-patch setting. Its median typing → settled layout fell from 6.23 s to
3.53 s (43% faster); median typing → commit was 1.29 s and the slowest edit was
4.92 s. It retained 65 pages, 31 commits, 13 intentional paragraph changes, one
added paragraph, and all independent XML/package assertions. That run's cold
opening plus complete native text inventory took 20.62 s, versus 18.86 s in the
previous pass; this change does not claim a cold-open improvement.

After the paragraph-presentation fix, a final repeat passed all integrity checks
with a 2.59 s median typing → settled layout. Its body benchmark cycles were
1.79 / 1.78 s and its footnote cycle was 2.51 s, with the same zero-save,
zero-conversion guards. Timings vary with the local run; the count-based guards
and document integrity assertions are the portable regression requirements.

## Next work

1. Repaginate the affected story/section, then downstream pages until layout
   stabilizes. Preserve footnote placement, paragraph fragments, focus, and exact
   versioned page-map completeness. Avoid substituting stale geometry for a fresh
   layout.
2. Reduce cold opening and main-thread work through runtime startup overlap,
   demand-driven text validation, and bounded scheduling. Measure time to the
   first editable page separately from the time to a complete document layout.

The current implementation updates blocks incrementally and can retain an
unchanged page layout. It does not yet paginate only a subset of changed pages.
