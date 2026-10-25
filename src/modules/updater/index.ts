// PUBLIC ENTRY of the updater module. Other code may import only from this file.
// Responsibility: find, download and install new ReqMan versions published as GitHub Releases.
// Updates download in the background; the user chooses when to restart.
import type { UpdateStatus } from '../../shared/api'
import { createGithubUpdater } from './githubUpdater'

export interface UpdateService {
  /** Starts checking (now and every few hours). `onStatus` is called on every change. */
  start(onStatus: (status: UpdateStatus) => void): void
  /** Checks immediately (e.g. from a button). */
  checkNow(): Promise<void>
  /** Closes ReqMan, installs the downloaded update and reopens it. */
  installAndRestart(): void
  current(): UpdateStatus
}

export { createGithubUpdater }
