// 0.15.2: a GitHub outage while pushing is not "pull first" (the acceptance run was told to pull during one).
import { describe, expect, it } from 'vitest'
import { GitError } from '../src/modules/git-adapter'
import { explainGitError } from '../src/modules/workspace'

const push = (stderr: string): GitError => new GitError('git push failed', ['push'], 1, '', stderr)

describe('push messages', () => {
  it('GitHub server error → try again later, nothing lost', () => {
    expect(explainGitError(push('To https://github.com/o/r.git\n ! [remote rejected] main -> main (Internal Server Error)\nerror: failed to push some refs'))).toMatch(/GitHub had a problem/)
    expect(explainGitError(push('fatal: unable to access: The requested URL returned error: 502'))).toMatch(/GitHub had a problem/)
  })
  it('someone pushed first → pull first', () => {
    expect(explainGitError(push(' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs'))).toMatch(/Pull first/)
    expect(explainGitError(push(' ! [rejected]        main -> main (non-fast-forward)'))).toMatch(/Pull first/)
  })
  it('a hook that refuses the push is still named as a hook', () => {
    expect(explainGitError(push(' ! [remote rejected] main -> main (pre-receive hook declined)'))).toMatch(/hook/i)
  })
})
