/**
 * Runs operations one after another (review D-03). Every operation that writes files, changes the index or
 * runs Git goes through it, so a save can never interleave with a pull, and a double click runs twice in
 * order instead of at the same time. Reads (queries, Compare) do not wait.
 *
 * Like a mutex in C: `run(fn)` waits until the previous holder has finished, then runs `fn`. A failing
 * operation releases the queue too.
 */
export interface SerialQueue {
  run<T>(fn: () => Promise<T>): Promise<T>
  /** Operations waiting or running. */
  readonly pending: number
}

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve()
  let pending = 0
  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      pending++
      const result = tail.then(fn, fn)
      tail = result.then(
        () => void pending--,
        () => void pending--
      )
      return result
    },
    get pending() {
      return pending
    }
  }
}
