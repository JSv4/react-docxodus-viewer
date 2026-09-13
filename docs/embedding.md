# Embed the modules

The studio remains a complete demo application. Use the library's viewer or editor
inside your own card, modal, route, or application shell. The components do not
mount the studio's navigation, history database, or global keyboard commands.

Explore all three layouts in the demo at `?example=modules`.

## Runtime setup

```sh
npm install react-docxodus-viewer docxodus@12.4.1
npx rdv-copy-runtime public/docxodus
```

Import `react-docxodus-viewer/styles.css` once. Set `wasmBasePath` on each block or
wrap your app in `DocxodusProvider`. See [runtime deployment](../WASM_CDN_ISSUES.md)
for deployment paths and asset verification.

## Just the viewer

```tsx
import { DocumentViewer } from 'react-docxodus-viewer/viewer';
import 'react-docxodus-viewer/styles.css';

<DocumentViewer
  document={docxBytes}
  wasmBasePath="/docxodus/wasm/"
  theme="studio"
  showUploadButton={false}
  allowRevisionResolution={false}
  fitMode="page-width"
  style={{ height: 600, maxHeight: 'none' }}
/>
```

The viewer supplies page navigation, zoom, rendering settings, and revision
display. Use `toolbar="none"` for a page surface with your own controls.
`theme="studio"` gives the controls a light sage palette; `classic` remains the
default. A chosen zoom stays in effect through document edits; changing the host
`fitMode` re-enables automatic fitting. Document fonts and page colors retain their source formatting.

Passing bytes without an editing session makes the document read-only. With a
shared session, set `allowRevisionResolution={false}` to hide accept/reject actions.

## Just the editor

```tsx
import { DocumentEditor } from 'react-docxodus-viewer/editor';
import 'react-docxodus-viewer/styles.css';

<DocumentEditor
  document={docxBytes}
  filename="Proposal.docx"
  wasmBasePath="/docxodus/wasm/"
  style={{ height: 760 }}
  onChange={({ version }) => setLastEditedVersion(version)}
  onSave={async (bytes, filename) => {
    await saveToYourApplication(bytes, filename);
  }}
/>
```

`document` accepts a `File` or `Uint8Array`. Omit it to create a blank document;
pass `null` for an empty editor. Each block owns and disposes its native session.
Supply `session={controller}` to use a host-owned session instead. That controller
takes precedence over `document` and remains open when the block unmounts.

**Click on the page and type.** Headings, paragraphs, list text, and table cells
are editable directly. Enter splits a paragraph at the caret; Backspace and Delete
join adjacent paragraphs at their boundaries. Paste inserts plain text, including
multiple paragraphs. Arrow keys move between paragraphs, and Ctrl/⌘ A selects
the document text. Double-click selects a word normally.

Selecting text applies character formatting to that range, including selections
across paragraphs and page fragments. With only a caret, font controls change
what you type next. Paragraph controls affect the current paragraph. Generated
list labels and comment/note markers stay outside native character offsets.
Existing Word tabs, line breaks, and nonbreaking hyphens also retain their source
structure while editing surrounding text. See the [NVCA stress test](editor-stress-test.md)
for a reproducible test against a substantial document with footnotes and fields.

Typing appears immediately, then commits to the native DOCX after a short pause.
Ordinary text and character formatting render changed blocks from the same live
native session. Pages stay mounted when paragraph geometry is unchanged; text
that changes page flow repaginates from the updated source HTML, preserving the
caret and scroll position. Structural edits and unsupported render profiles use
the full converter. IME composition waits until confirmation before committing. Text
updates preserve unchanged runs, links, and formatting. Typing bursts and
structural operations use native undo steps.

**Edit text** opens an optional paragraph pane for plain-text authoring. Use
**Apply text** or Ctrl/⌘ Enter to commit that pane; returning to the canvas also
commits its pending draft. The pane is not required for on-page typing.

The canvas is not a full Word replacement: it edits text that maps exactly to
native paragraph runs. Complex generated content and paragraphs with inline
objects that change text coordinates remain viewable with the advanced text and
session controls available. Cross-cell structural deletion is rejected. Enter
and Shift+Enter currently create paragraph breaks.

| Controls | Included behavior |
| --- | --- |
| History | Undo, redo, optional paragraph text pane |
| Font | Paragraph styles, family, size, bold, italic, underline, strike, superscript/subscript, color, highlight, clear character formatting |
| Paragraph | Alignment, bullets, numbering, indentation, line spacing |
| Insert | Links on selected text, tables, images, new paragraphs, page breaks |
| Review | Track subsequent edits; render native revisions |
| Viewer | Pages, zoom, rendering settings |

Ctrl/⌘ B, I, U, Z, Shift-Z, Y, and S work while focus is inside the editor.
Uncommitted textarea drafts retain normal text undo. Formatting and save commit
pending typing first. If the paragraph changes elsewhere, the draft remains on
the page to copy or reload instead of overwriting the external edit.

### Host integration

`onChange` reports committed native versions, including undo/redo. It does not fire
for each draft keystroke or initial document loading. Its `getDocument()` function
reads current committed DOCX bytes on demand; you do not need to serialize on every
change. Keep the input `document` stable while editing. Passing newly saved bytes
back as `document` would open a replacement and reset its history.

An editor-owned session defaults to `emitMarkdownPatch: false`, matching the native
TypeScript editor. React does not need a Markdown projection after each edit.
For a host-owned session, pass `settings: { emitMarkdownPatch: false }` to
`useDocxSession`, or to `controller.open`. The general controller keeps the upstream
default for applications that consume `EditResult.patch`; editor callers can also
opt back in through `sessionSettings`.

Without `onSave`, the header downloads a DOCX. With it, your application controls
storage and receives errors through `onError`. A ref exposes `controller`,
`getDocument()`, `commit()`, `focusCanvas()`, and `focusText()`. `focusCanvas()` returns
to the document caret; `focusText()` opens the optional pane. The ref's `getDocument()` applies a
pending draft first and throws if it cannot commit. Unmounting flushes canvas
typing while the native session is still open. Call `commit()` before switching
documents or layouts so you can handle a conflict; `false` means a draft needs
attention.

Use `readOnly` to keep the canvas and download action while hiding editing controls.
Use `showHeader={false}` or `showFormattingToolbar={false}` to let your application
supply those areas. `toolbarGroups` accepts any subset of `history`, `font`,
`paragraph`, `insert`, and `review`; `toolbarChildren` appends custom controls.
`viewerProps` configures the contained viewer without replacing the editor's
session or selection handlers.

## Compose your own layout

`useDocumentEditor` provides selection, formatting state, native commands, and
viewer bindings. `EditorToolbar` and `ParagraphEditor` use that shared state and
can live anywhere inside your component tree.

```tsx
import { DocumentViewer } from 'react-docxodus-viewer/viewer';
import { EditorToolbar, useDocxSession, useDocumentEditor }
  from 'react-docxodus-viewer/editor';
import 'react-docxodus-viewer/styles.css';

function EditingBlock({ file }: { file: File }) {
  const document = useDocxSession(file, { wasmBasePath: '/docxodus/wasm/' });
  const editor = useDocumentEditor(document.controller);

  return <section>
    <EditorToolbar editor={editor} groups={['history', 'font', 'paragraph']} />
    <DocumentViewer {...editor.viewerProps}
      wasmBasePath="/docxodus/wasm/" theme="studio" showUploadButton={false}
      fitMode="page-width" rendererFingerprint="my-editor"
      defaultSettings={{ showDeletedContent: false }}
      style={{ height: 650, maxHeight: 'none' }} />
    {editor.error && <p role="alert">{editor.error.message}</p>}
    {editor.canvasState.conflict && <button onClick={() => editor.canvasEditor.discard()}>
      Reload document text
    </button>}
    <button onClick={() => {
      if (editor.canvasEditor.commit()) saveToYourApplication(document.controller.save());
    }}>Save document</button>
  </section>;
}
```

Spread `editor.viewerProps` to connect direct typing, selection, formatting, and
native document updates. `DocumentViewer` alone remains a viewer.
`editor.canvasEditor.commit()` flushes typing before a host saves or replaces the
document. `canvasState` exposes pending typing, composition, and conflict status.
`editor.canvasEditor.focus()` returns focus to the last document caret.

An optional `<ParagraphEditor editor={editor} ref={textRef} />` can live in a
sidebar or below the page. It coordinates selection with the canvas. Pass
`beforeAction={() => textRef.current?.commit() ?? true}` to the toolbar and commit
both the canvas and pane before host save/navigation actions.

`editor.select(anchorId, span)` selects native UTF-16 character offsets; `null`
selects the whole paragraph. Common commands include `format`, `paragraph`,
`setStyle`, `setList`, `addLink`, `insertTable`, `insertImage`, `insertParagraph`,
`replaceText`, `undo`, and `redo`.

Use separate controllers for independent documents, or share a controller across
multiple viewers and controls. No global editor selection or undo state is used.
For comments, review resolution, structures, templates, and advanced operations,
compose the existing panels or use the complete session API. The core engine,
worker, browser export, and Node export remain separate entry points; see the
[API reference](API.md).
