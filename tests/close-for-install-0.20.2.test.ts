// 0.20.2 W-09 / CR-11: before an installer runs, the window closes the normal way (unsaved-changes question first).
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const quit = vi.fn()
let current: FakeWindow | null = null
vi.mock('electron', () => ({ app: { quit: () => quit() }, BrowserWindow: { fromWebContents: () => current } }))

class FakeWindow extends EventEmitter {
  destroyed = false
  webContents = new EventEmitter()
  /** what the user answers in the "Unsaved changes" dialog; null = nothing unsaved (no question) */
  constructor(private answer: 'discard' | 'keep' | null) {
    super()
    // the dialog's listener is registered when the window is made, so it runs first (as in main/index.ts)
    this.webContents.on('will-prevent-unload', (event: { preventDefault: () => void }) => {
      if (this.answer === 'discard') event.preventDefault()
    })
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
  close(): void {
    setTimeout(() => {
      if (this.answer !== null) {
        const event = { defaultPrevented: false, preventDefault(): void { this.defaultPrevented = true } }
        this.webContents.emit('will-prevent-unload', event)
        if (!event.defaultPrevented) return // kept editing: the window stays
      }
      this.destroyed = true
      this.emit('closed')
    }, 0)
  }
}

describe('closeForInstall (W-09)', () => {
  beforeEach(() => {
    vi.resetModules()
    quit.mockClear()
    vi.useRealTimers()
  })

  it('nothing unsaved: the window closes, quitting is held for the installer, and a fallback quit follows', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const m = await import('../src/main/closeForInstall')
    current = new FakeWindow(null)
    const p = m.closeForInstall({} as never)
    await vi.advanceTimersByTimeAsync(1)
    expect(await p).toBe(true)
    expect(m.quitHeld()).toBe(true)
    expect(quit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(m.INSTALLER_GRACE_MS)
    expect(quit).toHaveBeenCalledOnce() // no installer took over: never left running without a window (CR-03)
  })

  it('unsaved, "Keep editing": nothing closes and quitting is no longer held', async () => {
    const m = await import('../src/main/closeForInstall')
    current = new FakeWindow('keep')
    expect(await m.closeForInstall({} as never)).toBe(false)
    expect(m.quitHeld()).toBe(false)
    expect(current.isDestroyed()).toBe(false)
  })

  it('unsaved, "Discard changes": the window closes', async () => {
    const m = await import('../src/main/closeForInstall')
    current = new FakeWindow('discard')
    expect(await m.closeForInstall({} as never)).toBe(true)
  })

  it('no window: goes ahead', async () => {
    const m = await import('../src/main/closeForInstall')
    current = null
    expect(await m.closeForInstall({} as never)).toBe(true)
  })
})
