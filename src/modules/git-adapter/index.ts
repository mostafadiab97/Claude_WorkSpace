// PUBLIC ENTRY of the git-adapter module. Other code may import only from this file.
// Responsibility: every interaction with Git goes through the GitAdapter interface.
// To replace the implementation (e.g. a pure-JS Git), write a new factory returning GitAdapter
// and change the single line in src/main/composition.ts.
// Paths given to and returned by these methods are relative to the repository top folder, with forward slashes.
import type { GitInfo } from '../../shared/api'
import { createSystemGitAdapter, GitError, parseOverwrittenFiles, parseStatusV2, readBlobs } from './systemGit'

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
  /** The merged tree (clashing files contain Git's conflict markers). */
  tree: string
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

export interface ReflogEntry {
  /** HEAD after this step */
  hash: string
  /** e.g. "pull: Fast-forward", "merge origin/main: Fast-forward", "commit: Add SYS-1" */
  subject: string
  date: string
}

export interface GitRef {
  /** e.g. "main", "origin/main", "v1.0" */
  name: string
  kind: 'branch' | 'remote' | 'tag'
  hash: string
}

export interface NameStatus {
  /** A added, M modified, D deleted, R renamed (T type change counts as M) */
  status: 'A' | 'M' | 'D' | 'R' | 'T'
  path: string
  /** R: the old path */
  from?: string
  /** Blob IDs of the old and new content; null when there is none (added / deleted) or the new side is the working folder. */
  oldOid: string | null
  newOid: string | null
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
  /** Commits exactly these files (paths from the repository top), nothing else that may be staged or changed. */
  commitFiles(root: string, paths: string[], message: string): Promise<string>
  fetch(root: string): Promise<void>
  /** Would merging `upstream` into `ours` (default HEAD) conflict? Computed without touching the working folder. */
  checkMerge(root: string, upstream: string, ours?: string): Promise<MergeCheck>
  /** `reflogAction` names the step in Git's reflog (e.g. "pull"), so "what the last pull brought in" finds it. */
  merge(root: string, upstream: string, fastForwardOnly: boolean, reflogAction?: string): Promise<void>
  /** The newest commit both have (null: no common history). */
  mergeBase(root: string, a: string, b: string): Promise<string | null>
  /** Is commit `a` contained in `b`'s history? */
  isAncestor(root: string, a: string, b: string): Promise<boolean>
  /**
   * Builds a commit from `tree` with these files replaced (content null = removed), without touching the working
   * folder or the user's index. Returns the new commit's hash (M8: the merge commit with the user's decisions).
   */
  commitTree(root: string, tree: string, files: { path: string; content: string | null }[], parents: string[], message: string): Promise<string>
  /** Writes these files as they are in `ref` into the working folder only (not staged, nothing committed). */
  restoreFrom(root: string, ref: string, paths: string[]): Promise<void>
  /** Deletes a local branch; without `force` Git refuses when it has commits no other branch has (GitError). */
  deleteBranch(root: string, name: string, force: boolean): Promise<void>
  /** Tree hash of a commit (null if unknown). */
  treeOf(root: string, ref: string): Promise<string | null>
  /** Is this a valid new branch name? */
  checkBranchName(root: string, name: string): Promise<boolean>
  /** Switches to a branch; `create` makes it first (from `startPoint`, following it when `track`). */
  switchBranch(root: string, name: string, create?: { startPoint: string; track: boolean }): Promise<void>
  /** Never forces. `setUpstream` publishes a branch that has no remote branch yet. */
  push(root: string, setUpstream?: { remote: string; branch: string }): Promise<void>
  /** Commits that changed this file, newest first, following renames. */
  log(root: string, path: string, limit?: number): Promise<CommitInfo[]>
  /** File content at a commit, or null if the file did not exist there. */
  show(root: string, ref: string, path: string): Promise<string | null>
  /** Back to the last committed version; files that were never committed are deleted. */
  discard(root: string, paths: string[]): Promise<void>
  /** Author, date and message of one commit (null if unknown). */
  commitInfo(root: string, ref: string): Promise<CommitInfo | null>
  /** Recent commits that changed something under `pathspec`, newest first. */
  commits(root: string, pathspec: string, limit?: number): Promise<CommitInfo[]>
  /** Where HEAD has been on this PC (commits, pulls, merges, resets), newest first. */
  reflog(root: string, limit?: number): Promise<ReflogEntry[]>
  /** Branches, remote branches and tags. */
  refs(root: string): Promise<GitRef[]>
  /** Commit hash of a ref, or null. */
  resolve(root: string, ref: string): Promise<string | null>
  /** Files under `pathspec` that differ between two commits (`to` null = the working folder, incl. new files). */
  diffNameStatus(root: string, from: string, to: string | null, pathspec: string): Promise<NameStatus[]>
  /** Contents of many blobs by ID (null = not found), through one git process. */
  readBlobs(root: string, oids: string[]): Promise<Map<string, string | null>>
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
  /** One call for the Git bar: does HEAD have a parent commit, and the subject of the last commit. */
  headSummary(root: string): Promise<{ hasParent: boolean; lastMessage: string | null }>
  /** Blob IDs of these paths in a commit (paths that do not exist there are missing from the map). */
  blobIds(root: string, ref: string, paths: string[]): Promise<Map<string, string>>
  /** Every file under `dir` in a commit, path → blob ID (one `ls-tree -r` process). */
  treeBlobs(root: string, ref: string, dir: string): Promise<Map<string, string>>
  /** Sets user.name and user.email in the user's global Git configuration. */
  setIdentity(root: string, name: string, email: string): Promise<void>
  /** Makes `root` a new Git repository with the branch `main` (M7: "New project from a file"). */
  init(root: string): Promise<void>
  /** Adds a remote, e.g. origin → https://github.com/… (M7: "Publish to GitHub"). */
  addRemote(root: string, name: string, url: string): Promise<void>
}

export { createSystemGitAdapter, GitError, parseOverwrittenFiles, parseStatusV2, readBlobs }
export type { CommandRunner, RunOptions } from './systemGit'
