// Shared helpers for the end-to-end scenarios: start the built app with a fresh profile, answer native
// dialogs, count checks, take screenshots. Each scenario uses its own repository and profile, so scenarios
// are independent and can run at the same time (review T-01).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const outDir = join(root, 'e2e', 'out')
mkdirSync(outDir, { recursive: true })

export const temp = (name) => mkdtempSync(join(tmpdir(), `reqman-e2e-${name}-`))
export const gitIn = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

/** A Git repository with a bare "GitHub" remote and an author. */
export function gitRepo(name, user = 'Alice') {
  const repo = temp(`${name}-repo`)
  const remote = temp(`${name}-remote`)
  gitIn(remote, 'init', '-q', '--bare', '-b', 'main')
  execFileSync('git', ['init', '-q', '-b', 'main', repo])
  gitIn(repo, 'remote', 'add', 'origin', remote)
  gitIn(repo, 'config', 'user.name', user)
  gitIn(repo, 'config', 'user.email', `${user.toLowerCase()}@example.com`)
  return { repo, remote }
}

/** Starts the built app. `openPath` answers the folder picker; `userData` = a fresh profile unless given. */
export async function launch({ openPath, userData = temp('user'), prefix = '' } = {}) {
  const electronPath = (await import('electron')).default
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.', `--user-data-dir=${userData}`, ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [])],
    cwd: root,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' }
  })
  if (openPath) {
    // The folder picker is a native dialog Playwright cannot click; answer it with the test repository.
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    }, openPath)
  }
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1400, height: 860 })
  let failures = 0
  return {
    app,
    win,
    userData,
    check(cond, what) {
      console.log(`${cond ? '  ✓' : '  ✗'} ${prefix}${what}`)
      if (!cond) failures++
    },
    fail() {
      failures++
    },
    get failures() {
      return failures
    },
    shot: (name) => win.screenshot({ path: join(outDir, `${name}.png`) }),
    /** Save dialogs (export): answer with this file. */
    saveAs: (file) =>
      app.evaluate(({ dialog }, f) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: f })
      }, file),
    // exit directly: a failed run may leave unsaved edits, and the "unsaved changes" dialog would block close()
    close: () => app.evaluate(({ app: a }) => a.exit(0)).catch(() => {})
  }
}

/**
 * Runs a scenario: `body(ctx)` sets `ctx.t = await launch(...)`. Errors count as a failure, a screenshot is
 * taken, the app is closed, and the process exits with 0 (passed) or 1.
 */
export async function scenario(name, body) {
  const ctx = { t: null }
  let crashed = false
  try {
    await body(ctx)
  } catch (e) {
    crashed = true
    console.error(e)
    await ctx.t?.shot(`${name}-failure`).catch(() => {})
  } finally {
    await ctx.t?.close()
  }
  const failures = (ctx.t?.failures ?? 0) + (crashed ? 1 : 0)
  console.log(failures === 0 ? `\n${name}: passed` : `\n${name}: ${failures} failure(s)`)
  process.exit(failures === 0 ? 0 : 1)
}
