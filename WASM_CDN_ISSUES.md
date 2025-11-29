# Docxodus WASM CDN Loading Issues

## Problem Summary

The Docxodus library uses .NET Blazor WebAssembly, which has compatibility issues when loaded from CDNs like jsDelivr or unpkg.

## Root Cause

The .NET WASM runtime (`dotnet.js`) uses `credentials: "same-origin"` for all fetch requests internally:

```javascript
// Inside dotnet.js
return globalThis.fetch(e, t || { credentials: "same-origin" })
```

When the WASM files are served from a CDN:
1. The CDN returns `Access-Control-Allow-Origin: *` (wildcard)
2. The browser sends credentials with cross-origin requests
3. **CORS spec forbids using `*` with credentials** - the browser blocks the request

Error message:
```
Cross-Origin Request Blocked: Credential is not supported if the CORS header
'Access-Control-Allow-Origin' is '*'
```

## Secondary Issue: Vite Bundler Conflicts

When hosting WASM files locally in `/public`, Vite's dev server has issues:

```
Failed to load url /wasm/_framework/dotnet.js. This file is in /public and will
be copied as-is during build without going through the plugin transforms, and
therefore should not be imported from source code.
```

This occurs because docxodus uses dynamic `import()` for the WASM loader, and Vite tries to analyze/resolve it during development.

## Potential Solutions

### Option 1: Modify dotnet.js Fetch Configuration (Recommended)

Before publishing, patch the `dotnet.js` file to use `credentials: "omit"` for cross-origin requests:

```javascript
// Change from:
{ credentials: "same-origin" }

// To:
{ credentials: url.startsWith(location.origin) ? "same-origin" : "omit" }
```

Or simply:
```javascript
{ credentials: "omit" }
```

### Option 2: Use a CORS Proxy

Set up a proxy that:
- Forwards requests to the CDN
- Strips credentials or adds proper CORS headers
- Returns `Access-Control-Allow-Origin` matching the requesting origin instead of `*`

### Option 3: Self-Host with Proper Headers

Host the WASM files on a server you control with:
```
Access-Control-Allow-Origin: <specific-origin>
Access-Control-Allow-Credentials: true
```

### Option 4: Pre-initialize via Script Tag

Load `dotnet.js` via a script tag in `index.html` (bypasses dynamic import issues):

```html
<script src="/wasm/_framework/dotnet.js"></script>
```

Then expose the `dotnet` global for the library to use.

## Vite Workaround (Verified Working)

For local development with Vite, use a transform plugin to make the dynamic import opaque to the bundler.

**This approach has been tested and verified working** with:
- Vite 7.2.4
- React 19
- docxodus 3.0.1
- Local WASM files hosted in `/public/wasm/`

```typescript
// vite.config.ts
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function wasmExternalPlugin(): Plugin {
  return {
    name: 'wasm-external',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('docxodus') && code.includes('import(')) {
        return code.replace(
          /await import\(\/\* webpackIgnore: true \*\/ dotnetPath\)/g,
          'await (new Function("path", "return import(path)"))(dotnetPath)'
        )
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [wasmExternalPlugin(), react()],
  server: {
    headers: {
      // Required for SharedArrayBuffer used by .NET WASM
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['docxodus'],
  },
})
```

**Setup steps:**
1. Copy WASM files: `cp -r node_modules/docxodus/dist/wasm/* public/wasm/`
2. Use the Vite config above
3. Pass `/wasm/` as the base path to docxodus hooks: `useConversion('/wasm/')`

## Recommended Fix for Package Maintainer

1. **Patch `dotnet.js`** during build to use `credentials: "omit"`
2. **Add Vite-compatible dynamic import** using `/* @vite-ignore */` comment
3. **Document** the CORS requirements for self-hosting

Example patched import in `index.ts`:
```typescript
const { dotnet } = await import(/* @vite-ignore */ dotnetPath);
```
