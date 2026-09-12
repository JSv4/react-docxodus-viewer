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

Click a paragraph to format the entire paragraph, or select text on the page to
format that range. **Edit text** or a double-click opens a paragraph text pane.
Type or paste plain text, then use **Apply text** or Ctrl/⌘ Enter. Text updates
preserve unchanged runs between edits and commit as one native undo step. Inserted
text inherits formatting from the replaced run. Generated list labels are kept
out of the text pane and native character offsets.

This is a paginated editor with paragraph text authoring, not a contenteditable
Word canvas. Range formatting is limited to one paragraph, including its page
fragments. Selections involving unmappable generated content fail without editing;
use the paragraph text pane to select the actual editable characters. A caret with
no selected characters applies formatting to the whole paragraph.

| Controls | Included behavior |
| --- | --- |
| History | Undo, redo, paragraph text editing |
| Font | Paragraph styles, family, size, bold, italic, underline, strike, superscript/subscript, color, highlight, clear character formatting |
| Paragraph | Alignment, bullets, numbering, indentation, line spacing |
| Insert | Links on selected text, tables, images, new paragraphs, page breaks |
| Review | Track subsequent edits; render native revisions |
| Viewer | Pages, zoom, rendering settings |

Ctrl/⌘ B, I, U, Z, Shift-Z, Y, and S work while focus is inside the editor.
Uncommitted textarea drafts retain normal text undo. Formatting, save, and paragraph
selection commit a pending draft first. If the paragraph changes elsewhere, the
draft remains available to copy or reload instead of overwriting the external edit.

### Host integration

`onChange` reports committed native versions, including undo/redo. It does not fire
for each draft keystroke or initial document loading. Its `getDocument()` function
reads current committed DOCX bytes on demand; you do not need to serialize on every
change. Keep the input `document` stable while editing. Passing newly saved bytes
back as `document` would open a replacement and reset its history.

Without `onSave`, the header downloads a DOCX. With it, your application controls
storage and receives errors through `onError`. A ref exposes `controller`,
`getDocument()`, `commit()`, and `focusText()`. The ref's `getDocument()` applies a
pending draft first and throws if it cannot commit. Call `commit()` before your
application unmounts the editor or switches documents; `false` means a draft needs
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
import { useRef } from 'react';
import { DocumentViewer } from 'react-docxodus-viewer/viewer';
import { EditorToolbar, ParagraphEditor, useDocxSession, useDocumentEditor,
  type ParagraphEditorHandle } from 'react-docxodus-viewer/editor';
import 'react-docxodus-viewer/styles.css';

function EditingBlock({ file }: { file: File }) {
  const document = useDocxSession(file, { wasmBasePath: '/docxodus/wasm/' });
  const editor = useDocumentEditor(document.controller);
  const text = useRef<ParagraphEditorHandle>(null);
  const commit = () => text.current?.commit() ?? true;

  return <section>
    <EditorToolbar editor={editor} beforeAction={commit}
      groups={['history', 'font', 'paragraph']} />
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
      <DocumentViewer {...editor.viewerProps}
        onAnchorSelect={id => { if (commit()) editor.selectAnchor(id); }}
        onTextSelectionChange={selection => { if (commit()) editor.selectText(selection); }}
        wasmBasePath="/docxodus/wasm/" theme="studio" showUploadButton={false}
        fitMode="page-width" rendererFingerprint="my-editor"
        defaultSettings={{ commentMode: 'disabled', annotationMode: 'disabled', showDeletedContent: false }}
        style={{ height: 650, maxHeight: 'none' }} />
      <ParagraphEditor ref={text} editor={editor} />
    </div>
    {editor.error && <p role="alert">{editor.error.message}</p>}
    <button onClick={() => { if (commit()) saveToYourApplication(document.controller.save()); }}>
      Save document
    </button>
  </section>;
}
```

The host coordinates pending drafts through `beforeAction` and the selection
callbacks, as shown above. Without a `ParagraphEditor`, spread `editor.viewerProps`
directly onto the viewer. `editor.select(anchorId, span)` selects native UTF-16
character offsets; `null` selects the whole paragraph. Common commands include
`format`, `paragraph`, `setStyle`, `setList`, `addLink`, `insertTable`, `insertImage`,
`insertParagraph`, `replaceText`, `undo`, and `redo`.

Use separate controllers for independent documents, or share a controller across
multiple viewers and controls. No global editor selection or undo state is used.
For comments, review resolution, structures, templates, and advanced operations,
compose the existing panels or use the complete session API. The core engine,
worker, browser export, and Node export remain separate entry points; see the
[API reference](API.md).
