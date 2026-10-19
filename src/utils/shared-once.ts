/**
 * A one-time async step shared by all requests of a Worker isolate (plugin wiring, schema caches), safe against
 * the Workers trap where a promise started by one request never settles because that request was cancelled
 * (the visitor closed the page, a timeout): its I/O is cancelled with it, and every later request awaiting the
 * shared promise would hang until the isolate is recycled ("the site hangs, sometimes signed in, sometimes not").
 *
 * - A settled success is reused for the isolate's lifetime.
 * - A failure is forgotten, so the next caller retries.
 * - A pending attempt older than `staleMs` is treated as dead: the next caller starts a fresh one.
 * - Each caller waits at most `waitMs`; then it gets a rejection (callers decide whether to continue without it).
 */
export class SharedOnceTimeout extends Error {
  constructor(label: string, ms: number) {
    super(`${label}: still pending after ${ms} ms`)
    this.name = 'SharedOnceTimeout'
  }
}

export function sharedOnce<T>(
  label: string,
  start: () => Promise<T>,
  opts: { waitMs?: number; staleMs?: number; now?: () => number } = {},
): { get: () => Promise<T>; reset: () => void } {
  const waitMs = opts.waitMs ?? 8_000
  const staleMs = opts.staleMs ?? 15_000
  const now = opts.now ?? Date.now
  let current: Promise<T> | undefined
  let startedAt = 0
  let settled = false

  const begin = () => {
    settled = false
    startedAt = now()
    const p = start()
    current = p
    p.then(
      () => { if (current === p) settled = true },
      () => { if (current === p) current = undefined },
    )
    return p
  }

  const get = (): Promise<T> => {
    if (!current || (!settled && now() - startedAt > staleMs)) begin()
    const p = current!
    if (settled) return p
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SharedOnceTimeout(label, waitMs)), waitMs)
    })
    return Promise.race([p, timeout]).finally(() => { if (timer) clearTimeout(timer) })
  }

  return { get, reset: () => { current = undefined; settled = false } }
}
