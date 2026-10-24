import { describe, expect, it } from 'vitest'
import { createSystemGitAdapter } from '../src/modules/git-adapter'

describe('git-adapter', () => {
  it('reports the installed Git version', async () => {
    const git = createSystemGitAdapter(async () => 'git version 2.47.1.windows.2\n')
    expect(await git.getGitInfo()).toEqual({ installed: true, version: '2.47.1' })
  })

  it('reports Git as missing when the command fails', async () => {
    const git = createSystemGitAdapter(async () => {
      throw new Error('ENOENT')
    })
    const info = await git.getGitInfo()
    expect(info.installed).toBe(false)
    if (!info.installed) expect(info.downloadUrl).toMatch(/^https:\/\/git-scm\.com/)
  })

  it('treats unexpected output as not installed', async () => {
    const git = createSystemGitAdapter(async () => 'something else')
    expect((await git.getGitInfo()).installed).toBe(false)
  })

  it('works against the real Git on this machine', async () => {
    const info = await createSystemGitAdapter().getGitInfo()
    expect(info.installed).toBe(true)
  })
})
