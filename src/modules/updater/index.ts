// PUBLIC ENTRY of the updater module. Other code may import only from this file.
// Responsibility: find, download and install new ReqMan versions published as GitHub Releases.
// Updates download in the background; the user chooses when to restart.
import type { UpdateStatus } from '../../shared/api'
import { createGithubUpdater } from './githubUpdater'
import type { ReleaseInfo } from './versions'

export interface UpdateService {
  /** Starts checking (now and every few hours). `onStatus` is called on every change. */
  start(onStatus: (status: UpdateStatus) => void): void
  /** Checks immediately (e.g. from a button). */
  checkNow(): Promise<void>
  /** Closes ReqMan, installs the downloaded update and reopens it. */
  installAndRestart(): void
  current(): UpdateStatus
  /** Versions one can go back to (newest first). */
  listEarlier(): Promise<ReleaseInfo[]>
  /** Downloads and installs an earlier version; pauses automatic updates first. Resolves only on failure. */
  installEarlier(version: string): Promise<{ ok: false; message: string } | { ok: true }>
  /** Ends the pause after going back. */
  resume(): Promise<void>
}

export { createGithubUpdater }
export { compareVersions, OLDEST_REVERT_TARGET, parseReleases, revertTargets, type ReleaseInfo } from './versions'
