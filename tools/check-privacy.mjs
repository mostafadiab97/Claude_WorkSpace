// Privacy check (security check 3 Nov 2026, Mostafa: "make sure this never happens again"): fails when a commit author
// or committer e-mail, or an e-mail address in a tracked file, is not on the allowed list — so a work or private
// address cannot slip into these public repositories unnoticed. Runs in CI (build.yml) on this repository and the
// sandbox, with their full history.
//   node tools/check-privacy.mjs <repo folder> [<repo folder> …]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ALLOWED = [
  /^noreply@anthropic\.com$/i,
  /@users\.noreply\.github\.com$/i, // GitHub's private address (e.g. 347558874+mostafadiab97@…)
  /^noreply@github\.com$/i,
  /@example\.(com|org|net|invalid)$/i, // test data
  /\.(test|invalid|example|localhost)$/i // reserved names that can never be real addresses
]
// Words that must never appear in files or commits (personal / employer names), kept only as SHA-256 prefixes so this
// list does not itself publish them. Add one with: printf %s word | sha256sum | cut -c1-16
const FORBIDDEN = new Set(['22cf646f672fabfd', '8e3ff8e75ef5cfc9', '18f57e45e0d378a0', '623e586304e47903'])
const forbidden = (text) =>
  [...new Set(text.toLowerCase().split(/[^a-z0-9-]+/))].filter((w) => w && FORBIDDEN.has(createHash('sha256').update(w).digest('hex').slice(0, 16)))
const ok = (email) => ALLOWED.some((r) => r.test(email))
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

let problems = 0
for (const dir of process.argv.slice(2)) {
  const people = new Set(git(dir, 'log', '--all', '--format=%ae%n%ce').split('\n').filter(Boolean))
  for (const e of people) {
    if (ok(e)) continue
    problems++
    console.error(`✗ ${dir}: commit author/committer e-mail not allowed: ${e}`)
  }
  // e-mail addresses inside tracked files (package-lock and third-party schema files excluded)
  let hits
  try {
    hits = git(dir, 'grep', '-I', '-o', '-h', '-E', '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '--', '.', ':!package-lock.json', ':!tests/fixtures/**')
  } catch {
    hits = '' // git grep exits 1 when nothing is found
  }
  for (const e of new Set(hits.split('\n').filter(Boolean))) {
    if (ok(e) || /\.(png|svg|js|ts)$/i.test(e)) continue
    problems++
    console.error(`✗ ${dir}: e-mail address in a file: ${e}`)
  }
  // forbidden words in commit authors, messages and tracked files
  const words = forbidden(git(dir, 'log', '--all', '--format=%an%n%cn%n%B'))
  for (const f of git(dir, 'ls-files').split('\n').filter((x) => x && !x.endsWith('package-lock.json') && !/\.(png|jpg|ico|xlsx|zip|exe)$/i.test(x))) {
    try {
      const found = forbidden(git(dir, 'show', `HEAD:${f}`))
      if (found.length) words.push(...found.map(() => `(in ${f})`))
    } catch {
      /* not readable as text */
    }
  }
  for (const w of words) {
    problems++
    console.error(`✗ ${dir}: a forbidden personal word appears ${w.startsWith('(') ? w : 'in the commit history'}`)
  }
  console.log(`${dir}: ${people.size} commit identities checked`)
}
if (problems) {
  console.error(`\n${problems} privacy problem(s). Use the GitHub private address for commits (git config user.email <id>+<name>@users.noreply.github.com) and keep personal addresses out of files.`)
  process.exit(1)
}
console.log('Privacy check passed.')
