// PUBLIC ENTRY of the git-adapter module. Other code may import only from this file.
// Responsibility: every interaction with Git goes through the GitAdapter interface.
// To replace the implementation (e.g. a pure-JS Git), write a new factory returning GitAdapter
// and change the single line in src/main/composition.ts.
// Paths given to and returned by these methods are relative to the repository top folder, with forward slashes.
import type { GitInfo } from '../../shared/api'
import { createSystemGitAdapter, GitError, parseOverwrittenFiles, parseStatusV2 } from './systemGit'

export interface FileChange {
  path: string
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'conflict'
  /** Renames: the old path. */
  from?: string
  /** Already in Git's index (staged). */
  staged: boolean
}

export interface GitStatus {
  /** Current branch; null when detached. */
  branch: string | null
  detached: boolean
  /** e.g. "origin/main"; null when the branch has no remote branch. */
  upstream: string | null
  /** Commits here that the remote branch does not have, and the other way round (as of the last fetch). */
  ahead: number
  behind: number
  changes: FileChange[]
}

export interface MergeCheck {
  clean: boolean
  /** Files both sides changed in ways Git cannot combine. */
  conflicts: string[]
}

export interface CommitInfo {
  hash: string
  author: string
  email: string
  /** ISO 8601 */
  date: string
  message: string
  /** The file's path in this commit (differs from today's if it was renamed). */
  path: string
}

export interface GitAdapter {
  /** Is Git installed, and which version? */
  getGitInfo(): Promise<GitInfo>
  /** The top folder of the Git repository containing `path`, or null if `path` is not inside one. */
  findRepositoryRoot(path: string): Promise<string | null>
  /** Branch, upstream, ahead/behind and the changed files under `pathspec` (e.g. "requirements"). */
  status(root: string, pathspec: string): Promise<GitStatus>
  remotes(root: string): Promise<string[]>
  /** user.name / user.email from the Git configuration (null when not set). */
  identity(root: string): Promise<{ name: string | null; email: string | null }>
  /** Commits every change under `pathspec` and nothing else. Returns the new commit's hash. */
  commit(root: string, pathspec: string, message: string): Promise<string>
  fetch(root: string): Promise<void>
  /** Would merging `upstream` into HEAD conflict? Computed without touching the working folder. */
  checkMerge(root: string, upstream: string): Promise<MergeCheck>
  merge(root: string, upstream: string, fastForwardOnly: boolean): Promise<void>
  /** Never forces. `setUpstream` publishes a branch that has no remote branch yet. */
  push(root: string, setUpstream?: { remote: string; branch: string }): Promise<void>
  /** Commits that changed this file, newest first, following renames. */
  log(root: string, path: string, limit?: number): Promise<CommitInfo[]>
  /** File content at a commit, or null if the file did not exist there. */
  show(root: string, ref: string, path: string): Promise<string | null>
  /** Back to the last committed version; files that were never committed are deleted. */
  discard(root: string, paths: string[]): Promise<void>
  /** Does this ref (e.g. "origin/main") exist? */
  refExists(root: string, ref: string): Promise<boolean>
  /** Hash of HEAD, or null before the first commit. */
  head(root: string): Promise<string | null>
  /** Files under `pathspec` that differ between two commits. */
  changedFiles(root: string, from: string, to: string, pathspec: string): Promise<string[]>
  /** Cancels a merge that stopped with conflicts, restoring the state before it. */
  abortMerge(root: string): Promise<void>
  /** Takes back the last commit; its changes become uncommitted again (nothing is lost). */
  undoLastCommit(root: string): Promise<void>
  /** Subject of the last commit. */
  lastCommitMessage(root: string): Promise<string | null>
  /** Sets user.name and user.email in the user's global Git configuration. */
  setIdentity(root: string, name: string, email: string): Promise<void>
}

export { createSystemGitAdapter, GitError, parseOverwrittenFiles, parseStatusV2 }
export type { CommandRunner, RunOptions } from './systemGit'
