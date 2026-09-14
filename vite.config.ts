import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

// Plugin to serve WASM files from public directory during dev
function wasmPublicPlugin(): Plugin {
  const publicDir = join(process.cwd(), 'public')
  const staticExportAssets = new Set(['/export-browser.bundle.js', '/docxodus.worker.js', '/pagination.bundle.js', '/export-assets.json', '/export-resource-limits-v1.json', '/render-report-v2.schema.json'])

  return {
    name: 'wasm-public-plugin',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let url = req.url || ''

        const queryIndex = url.indexOf('?')
        if (queryIndex > -1) {
          url = url.substring(0, queryIndex)
        }

        if (url.startsWith('/wasm/') || staticExportAssets.has(url)) {
          const filePath = join(publicDir, url)

          if (existsSync(filePath)) {
            if (!resolve(filePath).startsWith(resolve(publicDir) + '/')) { next(); return }
            const content = readFileSync(filePath)

            if (url.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript')
            } else if (url.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm')
            } else if (url.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json')
            } else if (url.endsWith('.map')) {
              res.setHeader('Content-Type', 'application/json')
            }

            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

            res.end(content)
            return
          }
        }

        next()
      })
    },
    resolveId(source) {
      if (source.includes('/wasm/')) {
        return false
      }
      return null
    },
    load(id) {
      if (id.includes('/wasm/')) {
        return ''
      }
      return null
    },
  }
}

const isLibBuild = process.env.BUILD_LIB === 'true'

// Library build configuration
const libConfig = defineConfig({
  plugins: [react()],
  publicDir: false, // Don't copy public assets to lib dist
  build: {
    lib: {
      entry: Object.fromEntries(['index', 'viewer', 'editor', 'engine', 'worker', 'export-browser', 'server'].map(name => [name, resolve(__dirname, `src/${name}.ts`)])),
      name: 'ReactDocxodusViewer',
      fileName: (format, name) => `${name === 'index' ? 'react-docxodus-viewer' : name}.${format}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: id => /^(react(?:-dom)?|docxodus)(\/|$)/.test(id) || id === '@docxodus/export',
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          docxodus: 'docxodus',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'react-docxodus-viewer.css'
          }
          return assetInfo.name || 'asset'
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
})

// Demo app configuration
const demoConfig = defineConfig({
  base: process.env.RDV_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/react-docxodus-viewer/' : '/'),
  plugins: [wasmPublicPlugin(), react()],
  root: 'demo',
  publicDir: resolve(__dirname, 'public'),
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    hmr: {
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
    exclude: ['docxodus'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
  },
})

export default isLibBuild ? libConfig : demoConfig
