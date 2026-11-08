// CI only: puts the Electron program into node_modules/electron without the anonymous download of its install
// script. On 8 Nov 2026 GitHub answered the Windows build machines' anonymous downloads of Electron with
// "504 Gateway Time-out" for hours (no incident on its status page), while downloads signed in with `gh` worked.
// So: `npm ci` runs with ELECTRON_SKIP_BINARY_DOWNLOAD=1, then this script downloads the same file with `gh` (the
// run's token), checks it against Electron's published SHA-256 list, and unpacks it where Electron's own install
// script would. The installer build then uses that copy (`--config.electronDist=node_modules/electron/dist`).
//
//   node tools/ci-electron.mjs            (needs GH_TOKEN; Windows x64 build machines)
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const electronDir = join(process.cwd(), 'node_modules', 'electron')
const version = JSON.parse(readFileSync(join(electronDir, 'package.json'), 'utf8')).version
const platform = process.platform === 'win32' ? 'win32' : process.platform
const file = `electron-v${version}-${platform}-${process.arch}.zip`
const exe = platform === 'win32' ? 'electron.exe' : platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron'
const dir = join(process.env.RUNNER_TEMP ?? tmpdir(), 'electron-download')
mkdirSync(dir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let attempt = 1; ; attempt++) {
  try {
    execFileSync('gh', ['release', 'download', `v${version}`, '-R', 'electron/electron', '-p', file, '-p', 'SHASUMS256.txt', '-D', dir, '--clobber'], { stdio: 'inherit' })
    break
  } catch (e) {
    if (attempt >= 4) throw new Error(`Could not download ${file} with gh (4 attempts): ${e.message}`)
    console.log(`Electron download attempt ${attempt} failed; waiting`)
    await sleep(30_000 * attempt)
  }
}

// the file must be the one Electron published
const sums = readFileSync(join(dir, 'SHASUMS256.txt'), 'utf8')
const expected = sums.split(/\r?\n/).find((l) => l.endsWith(` *${file}`) || l.endsWith(`  ${file}`))?.split(/\s+/)[0]
const actual = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex')
if (!expected || expected !== actual) throw new Error(`${file}: checksum ${actual} does not match Electron's list (${expected ?? 'not listed'})`)

// unpack as Electron's install script does: dist/ + path.txt
const dist = join(electronDir, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
execFileSync('tar', ['-xf', join(dir, file), '-C', dist], { stdio: 'inherit' }) // Windows 10+ tar reads zip files
writeFileSync(join(electronDir, 'path.txt'), exe)
console.log(`Electron ${version} installed from ${file} (checksum checked)`)
