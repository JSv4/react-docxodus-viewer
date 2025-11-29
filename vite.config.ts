import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages - uses repo name from env or defaults to '/'
  base: process.env.GITHUB_ACTIONS ? '/Docxodus-Viewer/' : '/',
  plugins: [react()],
  server: {
    headers: {
      // Required for SharedArrayBuffer used by .NET WASM
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Serve WASM files from public directory without transformation
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // Don't pre-bundle docxodus - it has dynamic imports to WASM files
    exclude: ['docxodus'],
    // Explicitly exclude WASM-related entries
    entries: ['!public/wasm/**/*'],
  },
  build: {
    // Don't warn about large chunks from WASM
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Don't try to resolve external WASM imports
      external: [/^\/wasm\/.*/],
    },
  },
})
