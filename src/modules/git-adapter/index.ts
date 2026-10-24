// PUBLIC ENTRY of the git-adapter module. Other code may import only from this file.
// Responsibility: every interaction with Git goes through the GitAdapter interface.
// To replace the implementation (e.g. a pure-JS Git), write a new factory returning GitAdapter
// and change the single line in src/main/composition.ts.
import type { GitInfo } from '../../shared/api'
import { createSystemGitAdapter } from './systemGit'

export interface GitAdapter {
  /** Is Git installed, and which version? */
  getGitInfo(): Promise<GitInfo>
}

export { createSystemGitAdapter }
export type { CommandRunner } from './systemGit'
