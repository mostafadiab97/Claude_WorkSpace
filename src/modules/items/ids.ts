import { randomInt } from 'node:crypto'

/**
 * Crockford base32 without I, L, O, U: no letters that can be confused with digits when read aloud or
 * typed from a printout. 6 characters give about one billion IDs per prefix.
 */
export const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 6
const ID_RE = new RegExp(`^[A-Z][A-Z0-9]{0,5}-[${ID_ALPHABET}]{${LENGTH}}$`)

/**
 * Random IDs (not sequential numbers) so that two people adding items on different branches at the
 * same time never produce the same ID — a merge never has to renumber anything.
 */
export function generateId(prefix: string, isTaken: (id: string) => boolean = () => false): string {
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
