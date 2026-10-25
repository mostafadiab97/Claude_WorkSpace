import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  copied: boolean
}

/**
 * Catches errors while drawing a part of the screen, so one broken view does not leave a blank window.
 * The error goes to the log file; the user can copy diagnostics for a bug report and try again.
 * Files are never affected: everything saved stays saved.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; area: string }, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    window.reqman.reportUiError(`${this.props.area} crashed: ${error.stack ?? error.message}\n${info.componentStack ?? ''}`)
  }

  private copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${await window.reqman.getDiagnostics()}\n\nError: ${this.state.error?.stack ?? this.state.error?.message ?? ''}`)
      this.setState({ copied: true })
    } catch {
      // clipboard unavailable: the log file has it too
    }
  }

  render(): ReactNode {
    const { error, copied } = this.state
    if (!error) return this.props.children
    return (
      <div className="page" role="alert">
        <div className="page__inner">
          <h2>Something went wrong in {this.props.area}</h2>
          <p>
            ReqMan hit an unexpected error while showing this part of the window. Your saved work is not affected — only
            unsaved typing in the editor may be lost. The details were written to the log file.
          </p>
          <p className="notice notice--error">{error.message}</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={() => this.setState({ error: null, copied: false })}>
              Try again
            </button>
            <button type="button" className="btn" onClick={() => void this.copy()}>
              {copied ? 'Copied ✓' : 'Copy diagnostics for a bug report'}
            </button>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload the window
            </button>
          </div>
        </div>
      </div>
    )
  }
}
