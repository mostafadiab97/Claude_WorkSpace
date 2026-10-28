// Order keys: the position of an item among its siblings (review S-04, owner's decision 27–28 Oct 2026).
//
// A key is a short text that sorts like a number with an unlimited number of decimals: between any two keys
// there is always room for another one ("a0" < "a0V" < "a1"). Moving an item therefore rewrites exactly one
// file — its own — instead of renumbering its neighbours (which caused merge conflicts in files nobody edited).
//
// Format (the widely used "fractional indexing" scheme, written here from its published description):
//   integer part: a head letter that says how many digits follow ("a" = 1 digit, "b" = 2, … "z" = 26; "A"–"Z"
//   mirror that for values below "a0"), then that many base-62 digits;
//   fraction part: any base-62 digits, never ending in "0" (so every value has one spelling).
// Digits are 0-9, A-Z, a-z — in this order their character codes are increasing, so plain string comparison
// (JavaScript `<`, SQLite TEXT) sorts keys correctly.
//
// Older files store `order:` as a number (10, 20, 30…). They are read as the key of that whole number
// (`keyOfNumber`), which sorts the same way, so old and new files can be mixed freely.

export const ORDER_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE = ORDER_DIGITS.length
const SMALLEST_INTEGER = `A${'0'.repeat(26)}`

const digit = (c: string | undefined): number => (c === undefined ? -1 : ORDER_DIGITS.indexOf(c))

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2
  throw new Error(`Invalid order key head "${head}".`)
}

function integerPart(key: string): string {
  const len = integerLength(key[0] ?? '')
  if (len > key.length) throw new Error(`Invalid order key "${key}".`)
  return key.slice(0, len)
}

/** Is this a well-formed key? (Used when reading files: anything else is treated as "no position".) */
export function isOrderKey(key: string): boolean {
  try {
    if (key === SMALLEST_INTEGER) return false
    const int = integerPart(key)
    for (const c of key) if (digit(c) < 0) return false
    const frac = key.slice(int.length)
    return !frac.endsWith('0')
  } catch {
    return false
  }
}

function assertKey(key: string): void {
  if (!isOrderKey(key)) throw new Error(`Invalid order key "${key}".`)
}

/** A fraction strictly between a and b (b = null: no upper limit). Both without trailing zeros, a < b. */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`${a} >= ${b}`)
  if (b !== null) {
    // keep the common beginning
    let n = 0
    while ((a[n] ?? '0') === b[n]) n++
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const da = a ? digit(a[0]) : 0
  const db = b !== null ? digit(b[0]) : BASE
  if (db - da > 1) return ORDER_DIGITS[Math.round((da + db) / 2)] as string
  // adjacent digits: take a's digit and go one place further
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return (ORDER_DIGITS[da] as string) + midpoint(a.slice(1), null)
}

function incrementInteger(x: string): string | null {
  const head = x[0] as string
  const digits = x.slice(1).split('')
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = digit(digits[i]) + 1
    if (d < BASE) {
      digits[i] = ORDER_DIGITS[d] as string
      return head + digits.join('')
    }
    digits[i] = '0'
  }
  // carried past the first digit: one digit more
  if (head === 'Z') return 'a0'
  if (head === 'z') return null
  const next = String.fromCharCode(head.charCodeAt(0) + 1)
  if (next > 'a') digits.push('0')
  else digits.pop()
  return next + digits.join('')
}

function decrementInteger(x: string): string | null {
  const head = x[0] as string
  const digits = x.slice(1).split('')
  for (let i = digits.length - 1; i >= 0; i--) {
    const d = digit(digits[i]) - 1
    if (d >= 0) {
      digits[i] = ORDER_DIGITS[d] as string
      return head + digits.join('')
    }
    digits[i] = 'z'
  }
  if (head === 'a') return 'Zz'
  if (head === 'A') return null
  const prev = String.fromCharCode(head.charCodeAt(0) - 1)
  if (prev < 'Z') digits.push('z')
  else digits.pop()
  return prev + digits.join('')
}

/**
 * A key that sorts after `a` and before `b` (null = no limit on that side). The result is as short as the
 * neighbours allow; after the last sibling it is usually the next whole number ("a3" → "a4").
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) assertKey(a)
  if (b !== null) assertKey(b)
  if (a !== null && b !== null && a >= b) throw new Error(`Order key ${a} is not before ${b}.`)
  if (a === null) {
    if (b === null) return 'a0'
    const ib = integerPart(b)
    const fb = b.slice(ib.length)
    if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb)
    if (ib < b) return ib
    const dec = decrementInteger(ib)
    if (dec === null) throw new Error('No order key before the smallest one.')
    return dec
  }
  if (b === null) {
    const ia = integerPart(a)
    const fa = a.slice(ia.length)
    const inc = incrementInteger(ia)
    return inc === null ? ia + midpoint(fa, null) : inc
  }
  const ia = integerPart(a)
  const fa = a.slice(ia.length)
  const ib = integerPart(b)
  const fb = b.slice(ib.length)
  if (ia === ib) return ia + midpoint(fa, fb)
  const inc = incrementInteger(ia)
  if (inc === null) throw new Error('Order keys exhausted.')
  if (inc < b) return inc
  return ia + midpoint(fa, null)
}

/** `n` evenly spaced, short keys in increasing order, between a and b (null = no limit). */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return []
  if (n === 1) return [keyBetween(a, b)]
  if (b === null) {
    const out: string[] = []
    let k = a
    for (let i = 0; i < n; i++) out.push((k = keyBetween(k, null)))
    return out
  }
  if (a === null) {
    const out: string[] = []
    let k = b
    for (let i = 0; i < n; i++) out.unshift((k = keyBetween(null, k)))
    return out
  }
  const mid = Math.floor(n / 2)
  const c = keyBetween(a, b)
  return [...keysBetween(a, c, mid), c, ...keysBetween(c, b, n - mid - 1)]
}

/** The key of a whole number, for files written before 0.9.0 (`order: 30`). Sorts like the numbers do. */
export function keyOfNumber(value: number): string {
  let n = Math.max(0, Math.round(value))
  let digits = ''
  do {
    digits = (ORDER_DIGITS[n % BASE] as string) + digits
    n = Math.floor(n / BASE)
  } while (n > 0)
  if (digits.length > 26) throw new Error(`Order number ${value} is too large.`)
  return String.fromCharCode('a'.charCodeAt(0) + digits.length - 1) + digits
}

/** Sibling groups with a key longer than this are re-spaced at push time (owner's rule: at most 4 characters). */
export const MAX_ORDER_KEY_LENGTH = 4
