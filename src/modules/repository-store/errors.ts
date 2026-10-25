/** The file was changed (or created/deleted) by someone else since it was read. */
export class ConflictError extends Error {
  override name = 'ConflictError'
}
