# Editor performance campaign

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
