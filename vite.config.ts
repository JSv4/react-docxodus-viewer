import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin to prevent Vite from trying to resolve dynamic imports to /wasm/ paths
function wasmExternalPlugin(): Plugin {
  return {
    name: 'wasm-external',
    enforce: 'pre',
    // Transform the docxodus source to use a workaround for dynamic import
    transform(code, id) {
      if (id.includes('docxodus') && code.includes('import(')) {
        // Replace the dynamic import with a version that uses a variable
        // This prevents Vite from trying to analyze and resolve it
        return code.replace(
          /await import\(\/\* webpackIgnore: true \*\/ dotnetPath\)/g,
          'await (new Function("path", "return import(path)"))(dotnetPath)'
        )
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages - uses repo name from env or defaults to '/'
  base: process.env.GITHUB_ACTIONS ? '/Docxodus-Viewer/' : '/',
  plugins: [wasmExternalPlugin(), react()],
  server: {
    headers: {
      // Required for SharedArrayBuffer used by .NET WASM
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // Don't pre-bundle docxodus - let the transform plugin handle it
    exclude: ['docxodus'],
  },
})
