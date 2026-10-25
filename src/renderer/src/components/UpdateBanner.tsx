import type { UpdateStatus } from '../../../shared/api'

/** Shown above the content while an update downloads or is ready to install. */
export function UpdateBanner({ status }: { status: UpdateStatus | null }) {
  if (status?.state === 'downloading') {
    return (
      <div className="banner" role="status">
        Downloading ReqMan {status.version}… {status.percent}%
      </div>
    )
  }
  if (status?.state === 'ready') {
    return (
      <div className="banner banner--ready" role="status">
        <span>ReqMan {status.version} is ready to install.</span>
        <button type="button" className="btn btn--primary" onClick={() => void window.reqman.installUpdate()}>
          Restart and update
        </button>
      </div>
    )
  }
  return null
}

export function describeUpdate(status: UpdateStatus | null): string {
  switch (status?.state) {
    case undefined:
    case 'idle':
      return 'Not checked yet'
    case 'disabled':
      return `Off (${status.reason})`
    case 'checking':
      return 'Checking…'
    case 'up-to-date':
      return `Up to date (checked ${new Date(status.checkedAt).toLocaleTimeString()})`
    case 'downloading':
      return `Downloading ${status.version} — ${status.percent}%`
    case 'ready':
      return `Version ${status.version} ready — restart to install`
    case 'error':
      return status.message
  }
}
