// PUBLIC ENTRY of the self-test module. Other code may import only from this file.
// Responsibility: the RELEASE SELF-TEST the owner runs on his own PC after each update (Diagnostics →
// "Run release self-test"). It does the main things a user does — create, edit, move, link, suspect links,
// commit, push, a colleague's change, a pull that stops on a clash, undo + discard, pull, compare, history,
// export, a renamed file — on a PRACTICE repository with a fake "GitHub" (a bare repository) in a temporary
// folder. It never touches the user's repositories or Git settings, and deletes everything afterwards.
// Why on his PC: the automated tests run on GitHub's Windows machines; this checks the things only his PC
// has — his Git version and settings, antivirus, file system and speed.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReleaseSelfTestResult, ReleaseSelfTestStep } from '../../shared/api'
import type { WorkspaceService } from '../workspace'

export interface SelfTestDeps {
  /** A fresh workspace whose index caches and settings live in `userDir` (not the user's own). */
  createWorkspace(userDir: string): WorkspaceService
  version: string
  /** Installed Git version, or null. */
  gitVersion(): Promise<string | null>
}

class StepFailed extends Error {}
const expect = (cond: unknown, message: string): void => {
  if (!cond) throw new StepFailed(message)
}

/** Runs git with arguments (no shell), isolated from the user's own hooks and signing settings. */
function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=', ...args],
      { cwd, windowsHide: true, timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, stdout, stderr) => (err ? reject(new Error(`git ${args[0]}: ${stderr || err.message}`)) : resolve(stdout))
    )
  })
}

export async function runReleaseSelfTest(deps: SelfTestDeps): Promise<ReleaseSelfTestResult> {
  const started = performance.now()
  const startedAt = new Date().toISOString()
  const steps: ReleaseSelfTestStep[] = []
  const gitVersion = await deps.gitVersion()
  const base = await mkdtemp(join(tmpdir(), 'reqman-selftest-'))
  const remote = join(base, 'github.git')
  const mine = join(base, 'my-pc')
  const colleague = join(base, 'colleague-pc')
  let ws: WorkspaceService | null = null
  let failed = false

  const step = async (name: string, fn: () => Promise<string | void>): Promise<void> => {
    if (failed) {
      steps.push({ name, ok: false, ms: 0, detail: 'Not run (an earlier step failed)' })
      return
    }
    const t = performance.now()
    try {
      const note = await fn()
      steps.push({ name, ok: true, ms: Math.round(performance.now() - t), ...(note ? { detail: note } : {}) })
    } catch (e) {
      failed = true
      steps.push({ name, ok: false, ms: Math.round(performance.now() - t), detail: (e as Error).message })
    }
  }
  const W = (): WorkspaceService => {
    if (!ws) throw new StepFailed('The practice repository is not open.')
    return ws
  }
  const ids: Record<string, string> = {}
  const save = async (key: string, type: string, title: string, text: string, parent?: string): Promise<void> => {
    const it = W().newItem(type, parent)
    it.title = title
    it.text = text
    const r = await W().saveItem(it, null)
    expect(r.ok, `Saving "${title}" failed: ${r.ok ? '' : r.message}`)
    ids[key] = it.id
  }
  const id = (key: string): string => ids[key] ?? ''
  const edit = async (key: string, change: (it: Parameters<WorkspaceService['saveItem']>[0]) => void): Promise<void> => {
    const d = await W().getItem(id(key))
    expect(d, `${id(key)} could not be read.`)
    if (!d) return
    change(d.item)
    const r = await W().saveItem(d.item, d.revision)
    expect(r.ok, `Saving ${id(key)} failed: ${r.ok ? '' : r.message}`)
  }

  try {
    await step('Git is installed', async () => {
      expect(gitVersion, 'Git was not found. Install Git for Windows.')
      return `Git ${gitVersion}`
    })

    await step('Create a practice repository and a fake "GitHub"', async () => {
      await git(base, ['init', '-q', '--bare', '-b', 'main', remote])
      await git(base, ['clone', '-q', remote, mine])
      // local settings of the practice repository only: a name for its commits, no signing, no hooks
      const noHooks = join(base, 'no-hooks')
      await mkdir(noHooks)
      for (const [k, val] of [['user.name', 'Self-test'], ['user.email', 'self-test@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', noHooks]]) {
        await git(mine, ['config', k as string, val as string])
      }
      ws = deps.createWorkspace(join(base, 'appdata'))
      const info = await W().initialize(mine)
      expect(info.itemCount === 0, 'The new requirements folder is not empty.')
    })

    await step('Create items (heading, requirement, test)', async () => {
      await save('heading', 'information', 'Temperature control', 'Section for the self-test.')
      await save('req', 'system-requirement', 'Temperature accuracy', 'The system shall measure temperature within 0.5 °C.', id('heading'))
      await save('test', 'test-case', 'Check accuracy', 'Compare with a reference thermometer.', id('heading'))
      expect((await W().refresh()).itemCount === 3, 'Expected 3 items.')
    })

    await step('Edit, and refuse a save over a newer version', async () => {
      const d = await W().getItem(id('req'))
      expect(d, 'The requirement could not be read.')
      if (!d) return
      await edit('req', (it) => (it.fields['status'] = 'Review'))
      const stale = await W().saveItem({ ...d.item, title: 'Stale edit' }, d.revision)
      expect(!stale.ok && stale.reason === 'conflict', 'A save with an outdated version was not refused.')
    })

    await step('Search and filter', async () => {
      const r = W().query({ text: 'accuracy', sort: { by: 'relevance' } })
      expect(r.total === 2 && r.items.some((i) => i.id === id('req')), `Search for "accuracy" found ${r.total} items, expected 2.`)
      expect(W().query({ fields: { status: ['Review'] } }).total === 1, 'The Status filter does not find the edited item.')
    })

    await step('Move an item in the hierarchy', async () => {
      const r = await W().reparentItem(id('test'), id('heading'), id('req'))
      expect(r.ok, r.ok ? '' : r.message)
      const order = W().query({ parent: id('heading'), sort: { by: 'order' } }).items.map((i) => i.id)
      expect(order[0] === id('test'), 'The moved item is not first.')
    })

    await step('Link, suspect link, confirm', async () => {
      const r = await W().addLink(id('test'), 'verifies', id('req'))
      expect(r.ok, r.ok ? '' : r.message)
      await edit('req', (it) => (it.text += ' Measured every second.'))
      expect(W().query({ links: 'suspect' }).total === 1, 'The link did not become suspect after the text changed.')
      const c = await W().confirmLinks(id('test'))
      expect(c.ok && W().query({ links: 'suspect' }).total === 0, 'Confirming the link did not clear the suspect mark.')
    })

    await step('Commit and push to the fake GitHub', async () => {
      const st = await W().gitState()
      expect(st.available && st.changes.length > 0, `Git status shows no changes (${st.reason ?? ''}).`)
      const c = await W().commit('Self-test: first items')
      expect(c.ok, c.message)
      const p = await W().push()
      expect(p.ok, p.message)
      expect((await git(remote, ['log', '--oneline', 'main'])).trim().split('\n').length === 1, 'The fake GitHub did not receive the commit.')
    })

    await step('A colleague changes the requirement and pushes', async () => {
      await git(base, ['clone', '-q', remote, colleague])
      for (const [k, val] of [['user.name', 'Colleague'], ['user.email', 'colleague@example.invalid']]) await git(colleague, ['config', k as string, val as string])
      const file = join(colleague, 'requirements', 'items', `${id('req')}.md`)
      const text = await readFile(file, 'utf8')
      await writeFile(file, text.replace('Temperature accuracy', 'Temperature accuracy (colleague)'), 'utf8')
      await git(colleague, ['commit', '-q', '-am', 'Colleague edit'])
      await git(colleague, ['push', '-q'])
    })

    await step('Pull stops on an item changed on both sides', async () => {
      await edit('req', (it) => (it.title = 'Temperature accuracy (mine)'))
      const c = await W().commit('My edit')
      expect(c.ok, c.message)
      const p = await W().pull()
      expect(!p.ok && (p.items ?? []).some((i) => i.id === id('req')), `Pull did not stop on the clash: ${p.message}`)
      const d = await W().getItem(id('req'))
      expect(d?.item.title === 'Temperature accuracy (mine)', 'The stopped pull changed my item.')
    })

    await step('Undo my commit, discard, pull', async () => {
      const u = await W().undoLastCommit()
      expect(u.ok, u.message)
      const st = await W().gitState()
      const d = await W().discardChanges(st.changes.map((c) => c.path))
      expect(d.ok, d.message)
      const p = await W().pull()
      expect(p.ok, p.message)
      const it = await W().getItem(id('req'))
      expect(it?.item.title === 'Temperature accuracy (colleague)', 'After the pull the item does not have the colleague\'s title.')
    })

    await step('Compare: what the last pull brought in', async () => {
      const o = await W().compareOptions()
      expect(o.lastPull, 'The last pull was not found in Git\'s record.')
      if (!o.lastPull) return
      const r = await W().compareVersions(o.lastPull.from, o.lastPull.to)
      expect(r.entries.some((e) => e.id === id('req') && e.kind === 'modified'), 'Compare does not show the colleague\'s change.')
      return `${r.durationMs} ms`
    })

    await step('History of an item', async () => {
      const h = await W().itemHistory(id('req'))
      expect(h.length >= 2, `Expected at least 2 history entries, got ${h.length}.`)
      const c = await W().compareItemVersion(id('req'), h[0]?.hash ?? '')
      expect(c.diff.rows.some((r) => r.key === 'title'), 'The history comparison does not show the title change.')
    })

    await step('Export CSV and Markdown', async () => {
      const csv = await W().exportItems({ scope: 'all', columns: ['id', 'title', 'level', 'parent', 'text', 'links'], format: 'csv' })
      expect(csv.count === 3 && csv.content.includes(id('req')), 'The CSV export is incomplete.')
      const md = await W().exportItems({ scope: 'all', columns: ['id', 'title', 'text'], format: 'markdown' })
      expect(md.content.includes('Temperature control'), 'The Markdown export is incomplete.')
    })

    await step('A file renamed by hand is found and fixed', async () => {
      const items = join(mine, 'requirements', 'items')
      await rename(join(items, `${id('test')}.md`), join(items, 'RENAMED-BY-HAND.md'))
      await new Promise((r) => setTimeout(r, 300)) // like a user switching back to ReqMan afterwards
      const info = await W().refresh()
      expect(info.issues.some((i) => i.fix === 'file-name' && i.itemId === id('test')), 'The renamed file was not reported.')
      expect(await W().getItem(id('test')), 'The item in the renamed file cannot be opened.')
      const f = await W().fixFileName(id('test'))
      expect(f.ok, f.ok ? '' : f.message)
      expect(!(await W().refresh()).issues.some((i) => i.fix === 'file-name'), 'The file name was not fixed.')
    })

    await step('Delete an item and the links to it', async () => {
      const d = await W().getItem(id('req'))
      if (!d) throw new StepFailed('The requirement could not be read.')
      const r = await W().deleteItem(id('req'), d.revision, { removeIncomingLinks: true })
      expect(r.ok, r.ok ? '' : r.message)
      const t = await W().getItem(id('test'))
      expect(t && t.item.links.length === 0, 'The link to the deleted item was not removed.')
    })
  } finally {
    ;(ws as WorkspaceService | null)?.close()
    // always runs, even after a failed step
    failed = false
    await step('Clean up the practice folder', async () => {
      await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    })
  }

  return {
    ok: steps.every((s) => s.ok),
    version: deps.version,
    gitVersion,
    startedAt,
    totalMs: Math.round(performance.now() - started),
    steps
  }
}
