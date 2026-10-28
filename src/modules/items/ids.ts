import { randomInt } from 'node:crypto'

/**
 * Crockford base32 without I, L, O, U: no letters that can be confused with digits when read aloud or
 * typed from a printout.
 */
export const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/**
 * Every item gets `REQ-` + 7 random characters (owner's decisions O-01/O-02, 27 Oct 2026): the ID does not
 * depend on the type, so the type can change; 32^7 ≈ 34 billion values make a clash between people working on
 * different branches very unlikely (a clash found at merge time is repaired automatically, M8).
 */
export const ID_PREFIX = 'REQ'
const LENGTH = 7
/** Also accepts the older `SYS-K7Q3XM` style (type prefix + 6 characters) and other tools' prefixes. */
const ID_RE = new RegExp(`^[A-Z][A-Z0-9]{0,5}-[${ID_ALPHABET}]{6,7}$`)

/**
 * Random IDs (not sequential numbers) so that two people adding items on different branches at the
 * same time practically never produce the same ID — a merge never has to renumber anything.
 */
export function generateId(isTaken: (id: string) => boolean = () => false, prefix = ID_PREFIX): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let suffix = ''
    for (let i = 0; i < LENGTH; i++) suffix += ID_ALPHABET[randomInt(ID_ALPHABET.length)]
    const id = `${prefix}-${suffix}`
    if (!isTaken(id)) return id
  }
  throw new Error(`Could not find a free ID for prefix ${prefix}`)
}

/** Format check only. Items imported from other tools may use other IDs; those are accepted with a warning. */
export function isValidId(id: string): boolean {
  return ID_RE.test(id)
}
