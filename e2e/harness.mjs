// Shared helpers for the end-to-end scenarios: start the built app with a fresh profile, answer native
// dialogs, count checks, take screenshots. Each scenario uses its own repository and profile, so scenarios
// are independent and can run at the same time (review T-01).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const outDir = join(root, 'e2e', 'out')
mkdirSync(outDir, { recursive: true })

/** Temporary folders of this scenario: removed when it passes (kept for a look when it fails). */
const made = []
export const temp = (name) => {
  const dir = mkdtempSync(join(tmpdir(), `reqman-e2e-${name}-`))
  made.push(dir)
  return dir
}
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
  // A cold Windows build machine (virus scanner on a freshly unpacked Electron) can take more than the default
  // 30 s for the first window to finish loading — 0.14.0's release run lost its first two scenarios to that.
  await win.waitForLoadState('domcontentloaded', { timeout: 120_000 }).catch(() => {})
  await win.locator('.splash').waitFor({ state: 'detached', timeout: 120_000 }).catch(() => {})
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
    /** Open dialogs (file / folder pickers): answer with these paths, one per dialog, in order. */
    openFiles: (...paths) =>
      app.evaluate(({ dialog }, list) => {
        const queue = [...list]
        dialog.showOpenDialog = async () => (queue.length ? { canceled: false, filePaths: [queue.shift()] } : { canceled: true, filePaths: [] })
      }, paths),
    /** Message boxes: answer with the button at this index. */
    answerMessageBox: (response) =>
      app.evaluate(({ dialog }, r) => {
        dialog.showMessageBox = async () => ({ response: r, checkboxChecked: false })
      }, response),
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
  // every run made new projects (the 1,500-item one is large): a full disk once made all scenarios fail (0.20.0)
  // clean-up never changes the result (Windows may still hold a file: EBUSY)
  if (failures === 0)
    for (const d of made) {
      try {
        rmSync(d, { recursive: true, force: true, maxRetries: 3 })
      } catch (e) {
        console.log(`(could not remove ${d}: ${e.code ?? e.message})`)
      }
    }
  console.log(failures === 0 ? `\n${name}: passed` : `\n${name}: ${failures} failure(s)`)
  process.exit(failures === 0 ? 0 : 1)
}

/**
 * Types into the editor's Text field. Saved text is shown formatted (UI review UX-08); a click on it opens the plain
 * text box first. New or empty items show the box straight away.
 */
export async function editText(win, text, title) {
  // after clicking a row: wait until the editor shows that item, not the one before
  if (title) await win.waitForFunction((t) => document.querySelector('input[placeholder="Short name of the requirement"]')?.value === t, title)
  const preview = win.locator('.editor .text-preview')
  // wait until the item has loaded (one of the two is shown) — checking at once raced on Windows CI
  await win.locator('.editor .text-preview, .editor textarea.textarea').first().waitFor()
  if (await preview.isVisible()) await preview.click()
  await win.getByPlaceholder('The system shall…').fill(text)
}

// ── 0.23.0: the bar above the table is menus now (the owner's ideas, Fable's review). Helpers so scenarios read as before.
const PLACE = { after: 'Below the selected item', inside: 'Inside the selected item', end: 'At the end' }

/** "New item": open the small panel, choose the type (value or { label }), optionally the place, Create. */
export async function newItem(win, type, where) {
  await win.locator('.new-item__btn').click()
  const panel = win.getByRole('dialog', { name: 'New item' })
  await panel.getByRole('combobox').selectOption(type)
  if (where) await panel.getByRole('radio', { name: PLACE[where] }).check()
  await panel.getByRole('button', { name: 'Create' }).click()
  // the draft is open when the editor's title is empty (on a slow runner the previous item can still show for a moment)
  await win.waitForFunction(() => document.querySelector('input[placeholder="Short name of the requirement"]')?.value === '', null, { timeout: 15_000 })
}

/** Expand all / Collapse all through the outline menu. */
export async function outline(win, what) {
  await win.getByRole('button', { name: 'Expand or collapse all' }).click()
  const line = win.getByRole('menuitem', { name: new RegExp(`^${what}`) })
  // greyed out = the tree is already like that (fully open / fully closed)
  if (await line.isDisabled()) return win.keyboard.press('Escape')
  await line.click()
}

/** Import… or Export… through the "More" menu. */
export async function more(win, what) {
  await win.getByRole('button', { name: 'More', exact: true }).click()
  await win.getByRole('menuitem', { name: what }).click()
}

/** Rows with text ↔ one line per item, through the View pop-up (it closes again). */
export async function toggleText(win) {
  await win.getByRole('button', { name: 'View', exact: true }).click()
  const view = win.getByRole('dialog', { name: 'View' })
  const withText = view.getByRole('radio', { name: 'Rows: title and text' })
  if (await withText.isChecked()) await view.getByRole('radio', { name: 'Rows: one line per item' }).check()
  else await withText.check()
  await win.keyboard.press('Escape')
}

/** The document button (its accessible name starts with "Document:"). */
export const documentButton = (win) => win.locator('.doc-btn')

/** Show a document: open the document menu and choose the line that starts with the label (e.g. "Software (1)"). */
export async function pickDocument(win, label) {
  await documentButton(win).click()
  await win.getByRole('menuitemradio', { name: label, exact: true }).click()
}

/** A document action from its menu: 'New document', 'Rename', 'Merge', 'Delete'. */
export async function documentAction(win, what) {
  await documentButton(win).click()
  await win.getByRole('menu', { name: 'Documents' }).getByRole('menuitem', { name: new RegExp(`^${what}`) }).click()
}

/** Waits until the document menu lists a line (the list can change after a refresh), then chooses it. */
export async function waitPickDocument(win, label, timeout = 15_000) {
  const until = Date.now() + timeout
  for (;;) {
    await documentButton(win).click()
    const line = win.getByRole('menuitemradio', { name: label, exact: true })
    if ((await line.count()) > 0) return line.click()
    await win.keyboard.press('Escape')
    if (Date.now() > until) throw new Error(`document "${label}" never appeared in the menu`)
    await win.waitForTimeout(300)
  }
}
