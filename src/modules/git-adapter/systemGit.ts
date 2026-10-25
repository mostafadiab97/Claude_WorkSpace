// Implementation: uses the Git installed on the user's PC (Git for Windows), so ReqMan works
// with exactly the credentials, SSH keys and configuration the user already has.
import { execFile } from 'node:child_process'
import { normalize } from 'node:path'
import type { GitInfo } from '../../shared/api'
import type { GitAdapter } from './index'

export const GIT_DOWNLOAD_URL = 'https://git-scm.com/downloads/win'

/** Runs a program and returns its stdout. Injected so tests can fake it. */
export type CommandRunner = (file: string, args: string[]) => Promise<string>

const defaultRunner: CommandRunner = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 10_000, windowsHide: true }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })

export function parseGitVersion(output: string): string | null {
  // e.g. "git version 2.47.1.windows.2"
  const match = /git version (\d+\.\d+\.\d+)/.exec(output)
  return match?.[1] ?? null
}

export function createSystemGitAdapter(run: CommandRunner = defaultRunner): GitAdapter {
  return {
    async getGitInfo(): Promise<GitInfo> {
      try {
        const out = await run('git', ['--version'])
        const version = parseGitVersion(out)
        if (!version) {
          return { installed: false, reason: `Unrecognised output from git: ${out.trim()}`, downloadUrl: GIT_DOWNLOAD_URL }
        }
        return { installed: true, version }
      } catch {
        return { installed: false, reason: 'Git was not found on this PC.', downloadUrl: GIT_DOWNLOAD_URL }
      }
    },

    async findRepositoryRoot(path: string): Promise<string | null> {
      try {
        const out = (await run('git', ['-C', path, 'rev-parse', '--show-toplevel'])).trim()
        // Git prints forward slashes on Windows; normalise to the platform's form.
        return out ? normalize(out) : null
      } catch {
        return null
      }
    }
  }
}
