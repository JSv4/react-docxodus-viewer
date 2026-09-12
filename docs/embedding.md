# Embed the modules

The document studio is a demo application. Library components do not mount its
navigation, workspace header, welcome screen, history database, or keyboard
commands. Place them inside your own card, modal, route, or application shell.

## Viewer

```tsx
import { DocumentViewer } from 'react-docxodus-viewer/viewer';
import 'react-docxodus-viewer/styles.css';

<DocumentViewer
  document={docxBytes}
  wasmBasePath="/docxodus/wasm/"
  showUploadButton={false}
  allowRevisionResolution={false}
  fitMode="page-width"
  style={{ height: 600, maxHeight: 'none' }}
/>
```

The viewer supplies page navigation, zoom, and rendering settings. Use
`toolbar="none"` for a page surface with your own controls. Passing bytes without
an editing session makes the document read-only. With a shared session, set
`allowRevisionResolution={false}` to keep revision resolution out of that viewer.

## Compose editing controls with a viewer

```tsx
import { useState } from 'react';
import { DocumentViewer } from 'react-docxodus-viewer/viewer';
import { useDocxSession, SessionEditorPanel } from 'react-docxodus-viewer/editor';

function EditingBlock({ file }: { file: File }) {
  const document = useDocxSession(file, { wasmBasePath: '/docxodus/wasm/' });
  const [anchor, setAnchor] = useState<string>();

  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px' }}>
    <DocumentViewer session={document.controller}
      selectedAnchorId={anchor} onAnchorSelect={setAnchor}
      wasmBasePath="/docxodus/wasm/" showUploadButton={false} />
    <SessionEditorPanel session={document.controller}
      anchorId={anchor} onAnchorSelect={setAnchor} />
  </div>;
}
```

Each `useDocxSession` owns its document and closes it on unmount. Pass one
controller to multiple components when they should edit and display the same
document. Use separate controllers for independent documents. Call
`document.controller.save()` when your application needs current DOCX bytes.

The core engine, worker, browser export, and Node export remain separate entry
points. See [API reference](API.md) for lower-level commands and runtime setup.
