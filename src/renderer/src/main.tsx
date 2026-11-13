import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './app/App'
import { loadSavedMode, resolveMode } from './theme/applyTheme'

// Before the theme arrives the window already has the user's light or dark (splash, UX16-02 / BR-09).
document.documentElement.style.colorScheme = resolveMode(loadSavedMode()) === 'light' ? 'light' : 'dark'

// Any error in the UI is written to the log file, so testers can attach it to bug reports.
window.addEventListener('error', (e) => {
  window.reqochet.reportUiError(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ''}`)
})
window.addEventListener('unhandledrejection', (e) => {
  const r: unknown = e.reason
  window.reqochet.reportUiError(`Unhandled promise rejection: ${r instanceof Error ? (r.stack ?? r.message) : String(r)}`)
})

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
