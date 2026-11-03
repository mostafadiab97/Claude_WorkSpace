// Privacy check (security check 3 Nov 2026; narrowed on the owner's decision the same day): the files of this tool
// repository must contain no personal data — no real e-mail addresses, and none of the personal / account names below.
// Only the CURRENT files are checked: commit history is not (a public release repository will start from the files
// without history), and requirement repositories may of course hold their authors' names.
//   node tools/check-privacy.mjs [repo folder]      (default: this folder)
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? '.'
const ALLOWED_EMAILS = [
  /^noreply@anthropic\.com$/i, // the commit attribution in project instructions
  /@users\.noreply\.github\.com$/i, // GitHub's private addresses (e.g. Dependabot)
  /@example\.(com|org|net|invalid)$/i, // test data
  /\.(test|invalid|example|localhost)$/i // reserved names that can never be real addresses
]
// Personal / account words, kept only as SHA-256 prefixes so this list does not publish them itself.
// Add one with:  printf %s word | sha256sum | cut -c1-16
const FORBIDDEN = new Set([
  '22cf646f672fabfd',
  '8e3ff8e75ef5cfc9',
  '18f57e45e0d378a0',
  '623e586304e47903',
  '96a26fc3089e1e70',
  'aa4b1e5171bb8d1b',
  '0adae15547c17aad',
  '21065bb9d6812930'
])
const hash = (w) => createHash('sha256').update(w).digest('hex').slice(0, 16)
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
const BINARY = /\.(png|jpg|jpeg|gif|ico|xlsx|zip|exe|woff2?|ttf|reqifz)$/i

let problems = 0
const files = git('ls-files').split('\n').filter((f) => f && !BINARY.test(f) && !f.endsWith('package-lock.json'))
for (const f of files) {
  let text
  try {
    text = readFileSync(join(dir, f), 'utf8')
  } catch {
    continue // deleted in the working folder
  }
  for (const e of new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])) {
    if (ALLOWED_EMAILS.some((r) => r.test(e)) || /\.(png|svg|js|ts|mjs)$/i.test(e)) continue
    problems++
    console.error(`✗ ${f}: e-mail address ${e}`)
  }
  const words = new Set(text.toLowerCase().split(/[^a-z0-9-]+/).flatMap((w) => [w, ...w.split('-')]))
  for (const w of words) {
    if (!w || !FORBIDDEN.has(hash(w))) continue
    problems++
    console.error(`✗ ${f}: contains a personal or account name (word ${w.length} letters long)`)
  }
}
if (problems) {
  console.error(`\n${problems} privacy problem(s): remove personal names, account names and e-mail addresses from the files.`)
  process.exit(1)
}
console.log(`Privacy check passed (${files.length} files).`)
