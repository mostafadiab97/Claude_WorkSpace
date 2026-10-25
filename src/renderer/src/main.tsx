import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './app/App'

// Any error in the UI is written to the log file, so testers can attach it to bug reports.
window.addEventListener('error', (e) => {
  window.reqman.reportUiError(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ''}`)
})
window.addEventListener('unhandledrejection', (e) => {
  const r: unknown = e.reason
  window.reqman.reportUiError(`Unhandled promise rejection: ${r instanceof Error ? (r.stack ?? r.message) : String(r)}`)
})

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
