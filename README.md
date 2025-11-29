# Docxodus Viewer

A client-side DOCX document viewer and comparison tool built with React. All document processing happens entirely in your browser using WebAssembly - no files are uploaded to any server.

**[Live Demo](https://jsv4.github.io/Docxodus-Viewer/)** | **[Docxodus Engine](https://github.com/JSv4/Docxodus)**

## Features

### Document Viewer
- Convert DOCX files to HTML for viewing in the browser
- **Comment rendering** with multiple display modes:
  - **Disabled** - Hide all comments
  - **Endnotes** - Comments appear at the end with numbered references
  - **Inline** - Comments shown as tooltips on hover
  - **Margin** - Comments displayed in a side column

### Document Comparison
- Compare two DOCX files and generate a redlined document with tracked changes
- Visual diff with insertions (green) and deletions (red) highlighted
- **Configurable comparison options:**
  - **Detail Level** - Control comparison granularity (lower = more detailed)
  - **Case-insensitive** - Ignore case differences when comparing
  - **Author name** - Set the author for tracked changes
- Download the comparison result as a DOCX file with tracked changes

### Revision Extraction
- Extract structured revision data from documents with tracked changes
- View revision details: type, author, date, and changed text
- Summary statistics for insertions and deletions

## Technology

- **React 19** with TypeScript
- **Vite** for fast development and optimized builds
- **[Docxodus](https://github.com/docxodus/docxodus)** - WebAssembly-powered DOCX processing engine

## Privacy

All document processing happens locally in your browser. Your files never leave your device - there's no server-side processing, no uploads, and no data collection.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/JSv4/Docxodus-Viewer.git
cd Docxodus-Viewer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deployment

### GitHub Pages

This repository includes a GitHub Actions workflow that automatically builds and deploys to GitHub Pages on push to `main`.

To enable:
1. Go to your repository Settings > Pages
2. Set Source to "GitHub Actions"
3. Push to `main` branch

**Important:** GitHub Pages doesn't support custom HTTP headers. The required COOP/COEP headers for SharedArrayBuffer are injected via a service worker. This is handled automatically by the build.

### Netlify

Add a `netlify.toml` to your repo root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### Vercel

Add a `vercel.json` to your repo root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### Other Platforms

The app requires specific CORS headers for the .NET WebAssembly runtime:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Ensure your hosting platform sets these headers. Platforms like Netlify and Vercel support custom headers via configuration files.

## Project Structure

```
src/
├── App.tsx                    # Main app with tab navigation
├── App.css                    # Application styles
├── components/
│   ├── DocumentViewer.tsx     # DOCX to HTML conversion
│   ├── DocumentComparer.tsx   # Two-document comparison
│   └── RevisionViewer.tsx     # Revision extraction
└── main.tsx                   # Entry point
```

## Docxodus Library

This viewer is powered by [Docxodus](https://github.com/docxodus/docxodus), a WebAssembly library for DOCX processing. For more information about the underlying engine, including:

- API documentation
- Comment rendering architecture
- Comparison algorithm details
- Bundle size and browser support

Visit the [Docxodus repository](https://github.com/JSv4/Docxodus).

## Browser Support

- Chrome 89+
- Firefox 89+
- Safari 15+
- Edge 89+

Requires WebAssembly SIMD support.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
