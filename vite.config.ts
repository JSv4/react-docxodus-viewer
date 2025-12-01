import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

// Plugin to serve WASM files from public directory during dev
function wasmPublicPlugin(): Plugin {
  const publicDir = join(process.cwd(), 'public')

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

        if (url.startsWith('/wasm/')) {
          const filePath = join(publicDir, url)

          if (existsSync(filePath)) {
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
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ReactDocxodusViewer',
      fileName: (format) => `react-docxodus-viewer.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'docxodus', 'docxodus/react'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          docxodus: 'docxodus',
          'docxodus/react': 'docxodusReact',
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
  base: process.env.GITHUB_ACTIONS ? '/Docxodus-Viewer/' : '/',
  plugins: [wasmPublicPlugin(), react()],
  root: '.',
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
    outDir: 'dist-demo',
    rollupOptions: {
      input: resolve(__dirname, 'demo/index.html'),
    },
  },
})

export default isLibBuild ? libConfig : demoConfig
