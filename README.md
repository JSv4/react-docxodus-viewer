# react-docxodus-viewer

A React component for viewing DOCX documents in the browser, powered by [Docxodus](https://github.com/JSv4/Docxodus). All document processing happens entirely in the browser using WebAssembly - no server required.

**[Live Demo](https://jsv4.github.io/react-docxodus-viewer/)** | **[Docxodus Engine](https://github.com/JSv4/Docxodus)** | **[npm](https://www.npmjs.com/package/react-docxodus-viewer)**

## Features

- 📄 **DOCX to HTML conversion** - View Word documents directly in the browser
- 🔄 **Web Worker support** - Non-blocking conversion in background thread (enabled by default)
- 📊 **Progressive loading** - Page placeholders show while documents convert
- 📝 **Tracked changes** - View insertions, deletions, moves, and formatting changes
- 💬 **Comments** - Multiple rendering modes (endnotes, inline, margin)
- 📑 **Pagination** - PDF.js-style page view with smooth scrolling
- ⚙️ **Customizable** - CSS variables for theming, configurable height

## Installation

```bash
npm install react-docxodus-viewer docxodus
```

## Quick Start

```tsx
import { DocumentViewer } from 'react-docxodus-viewer';
import 'react-docxodus-viewer/styles.css';

function App() {
  return (
    <DocumentViewer
      placeholder="Select a DOCX file to view"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `file` | `File \| null` | - | Controlled file input |
| `html` | `string \| null` | - | Controlled HTML output |
| `onFileChange` | `(file: File \| null) => void` | - | Called when file changes |
| `onConversionComplete` | `(html: string) => void` | - | Called when conversion finishes |
| `onError` | `(error: Error) => void` | - | Called on conversion error |
| `settings` | `ViewerSettings` | - | Controlled viewer settings |
| `defaultSettings` | `Partial<ViewerSettings>` | - | Initial settings (uncontrolled) |
| `toolbar` | `'top' \| 'bottom' \| 'none'` | `'top'` | Toolbar position |
| `showSettingsButton` | `boolean` | `true` | Show settings gear icon |
| `showRevisionsTab` | `boolean` | `true` | Show tracked changes tab |
| `placeholder` | `string` | `'Open a DOCX file to view'` | Empty state message |
| `useWorker` | `boolean` | `true` | Use Web Worker for conversion |
| `wasmBasePath` | `string` | - | Custom WASM file location |
| `fitMode` | `'manual' \| 'page-width' \| 'page'` | `'manual'` | Auto-fit zoom on render and resize |
| `className` | `string` | - | Additional CSS class |
| `style` | `CSSProperties` | - | Inline styles |

## Viewer Settings

```tsx
interface ViewerSettings {
  commentMode: 'disabled' | 'endnote' | 'inline' | 'margin';
  annotationMode: 'disabled' | 'above' | 'inline' | 'tooltip' | 'none';
  paginationScale: number; // 0.3 - 2.0
  showPageNumbers: boolean;
  renderFootnotesAndEndnotes: boolean;
  renderHeadersAndFooters: boolean;
  renderTrackedChanges: boolean;
  showDeletedContent: boolean;
  renderMoveOperations: boolean;
}
```

## CSS Customization

Override CSS variables to customize the viewer:

```css
.rdv-viewer {
  /* Height constraints */
  --rdv-height: 80vh;
  --rdv-min-height: 400px;
  --rdv-max-height: 90vh;

  /* Colors */
  --rdv-background: #525659;
  --rdv-toolbar-bg: #323639;
  --rdv-btn-bg: #474c50;
  --rdv-btn-color: #d4d4d4;

  /* Gap between pages (placeholders and rendered) */
  --rdv-page-gap: 20px;
}
```

## Controlled Mode

For full control over state:

```tsx
function ControlledViewer() {
  const [file, setFile] = useState<File | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  return (
    <DocumentViewer
      file={file}
      html={html}
      onFileChange={setFile}
      onConversionComplete={setHtml}
    />
  );
}
```

## Browser Support

- Chrome 89+
- Firefox 89+
- Safari 15+
- Edge 89+

Requires WebAssembly SIMD support.

## Privacy

All document processing happens locally in your browser. Files are never uploaded to any server.

## Related

- [Docxodus](https://github.com/JSv4/Docxodus) - The WebAssembly engine powering this viewer
- [Live Demo](https://jsv4.github.io/react-docxodus-viewer/) - Try it out

## License

MIT
