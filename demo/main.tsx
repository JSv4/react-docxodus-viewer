import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './DemoRouter'
import '../src/styles/DocumentViewer.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p role="status">Opening workspace…</p>}><App /></Suspense>
  </StrictMode>,
)
