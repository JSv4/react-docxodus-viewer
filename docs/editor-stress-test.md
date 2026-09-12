# Editor stress test

From a repository checkout, run the real [NVCA October 2025 Model Certificate of Incorporation](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx)
through the editor:

```sh
npm run test:stress
```

Requires the development dependencies, Playwright Chromium, and Python 3. The
runner downloads the document to the OS temporary directory and verifies SHA-256
`d75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29`.
It reuses a verified cached copy on subsequent runs. To use an existing download:

```sh
RDV_STRESS_DOCX=/path/to/NVCA-Model-COI-10-1-2025.docx npm run test:stress
```

`RDV_TEST_PORT` selects a local development-server port. The stress test uses the
source API harness and is separate from production preview tests. The normal
browser suite skips it, keeping routine checks independent of an external download.

The fixture contains 234 body paragraphs, about 126,000 body characters, 94
footnote references, 110 rendered footnote paragraphs, four sections, 392 body
bookmarks, and 405 body field markers. It also includes tabs, manual line breaks,
numbered headings, field results, and a Word nonbreaking hyphen.

The test checks every body and footnote paragraph for canvas editability, then
uses actual keyboard and toolbar input at twelve scattered locations. It covers
zoom, typing through repeated native commits and background conversion,
undo/redo, selected formatting, paragraph splitting, multiline paste, merging,
and saving a pending final keystroke. It reopens the edited DOCX in a new native
session and checks all original paragraph text against the intended changes.

A separate Python ZIP/XML inspection compares the original, initial native save,
and edited save. It checks fields, bookmarks, section properties, note references,
tabs, breaks, numbering, unchanged paragraph XML, and unrelated package parts.
Persisted PowerTools anchor IDs are excluded from semantic XML hashes; they are
expected native session metadata. Equivalent relative/absolute OPC relationship
targets and default/override content-type declarations are normalized before
comparison, so package serialization changes do not masquerade as content edits.

Playwright writes `NVCA-report.json`, `NVCA-editor.png`, `baseline.docx`, and
`NVCA-edited.docx` into the test's directory under `test-results`. The report
includes cold-load and per-edit timings. Saved copies contain explicit test text;
the downloaded fixture is never modified.

The September 12, 2026 Chromium run passed with 65 pages, 31 native commits,
13 intentionally modified paragraphs, and one added paragraph. Opening and
pagination took 19.1 seconds. The scripted typing bursts and native commits took
1.3–2.9 seconds; the complete edit-to-reflow cycles took 8.1–11.5 seconds. These
include the test's typing delay and commit debounce. Full-document reflow remains
a performance limitation; continued typing during conversion is checked.

The [performance campaign](performance.md) adds a shorter, phase-by-phase benchmark
with `npm run test:performance`, along with guards against redundant pagination
and native formatting work. The timings above describe the pre-optimization run
merged in PR #40.

Pagination is measured in Chromium; pixel-identical pagination with Microsoft
Word is outside this test's scope. Repeated headers/footers and
generated page-number fields use the advanced session controls. There are no
tables, images, comments, or tracked revisions in this fixture; the regular browser
suite covers those features separately. Enter and Shift+Enter currently create
paragraph breaks, and paste imports plain text.
