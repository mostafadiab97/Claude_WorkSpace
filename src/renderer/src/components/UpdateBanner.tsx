import type { UpdateStatus } from '../../../shared/api'
import { T } from '../../../shared/text'

/** Shown above the content while an update downloads or is ready to install. */
export function UpdateBanner({ status }: { status: UpdateStatus | null }) {
  if (status?.state === 'downloading') {
    return (
      <div className="banner" role="status">
        {T.updates.downloading(status.version, status.percent)}
      </div>
    )
  }
  if (status?.state === 'ready') {
    return (
      <div className="banner banner--ready" role="status">
        <span>{T.updates.ready(status.version)}</span>
        <button type="button" className="btn btn--primary" onClick={() => void window.reqman.installUpdate()}>
          {T.updates.restart}
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
      return T.updates.notChecked
    case 'disabled':
      return T.updates.off(status.reason)
    case 'checking':
      return T.common.checking
    case 'up-to-date':
      return T.updates.upToDate(new Date(status.checkedAt).toLocaleTimeString())
    case 'downloading':
      return T.updates.downloadingShort(status.version, status.percent)
    case 'ready':
      return T.updates.readyShort(status.version)
    case 'error':
      return status.message
  }
}
