import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Plugin to serve WASM files from public directory during dev
// This works around Vite's restriction on dynamic imports from /public
// See: https://github.com/vitejs/vite/issues/14850
function wasmPublicPlugin(): Plugin {
  const publicDir = join(process.cwd(), 'public')

  return {
    name: 'wasm-public-plugin',
    configureServer(server) {
      // Add middleware to intercept WASM-related requests before Vite processes them
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''

        // Check if this is a request for files in /wasm/_framework/
        if (url.startsWith('/wasm/_framework/')) {
          const filePath = join(publicDir, url)

          if (existsSync(filePath)) {
            const content = readFileSync(filePath)

            // Set appropriate content type
            if (url.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript')
            } else if (url.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm')
            } else if (url.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json')
            }

            // Add CORS headers for WASM
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

            res.end(content)
            return
          }
        }

        next()
      })
    },
    // Prevent Vite from trying to resolve/transform these imports
    resolveId(source) {
      if (source.startsWith('/wasm/_framework/') || source.includes('/wasm/_framework/')) {
        return { id: source, external: true }
      }
      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages - uses repo name from env or defaults to '/'
  base: process.env.GITHUB_ACTIONS ? '/Docxodus-Viewer/' : '/',
  plugins: [wasmPublicPlugin(), react()],
  server: {
    headers: {
      // Required for SharedArrayBuffer used by .NET WASM
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    hmr: {
      // Disable error overlay - WASM loading errors can be misleading
      overlay: false,
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
  },
  build: {
    // Don't warn about large chunks
    chunkSizeWarningLimit: 1000,
  },
})
