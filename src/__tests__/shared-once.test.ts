/**
 * A promise shared by all requests of an isolate must never block them forever: a pending attempt left by a
 * cancelled request (Workers cancels its I/O) is retried, and callers stop waiting after `waitMs`.
 */
import { describe, it, expect } from 'vitest'
import { sharedOnce, SharedOnceTimeout } from '../utils/shared-once'

describe('sharedOnce', () => {
  it('reuses a settled result', async () => {
    let calls = 0
    const once = sharedOnce('t', async () => { calls++; return 42 })
    expect(await once.get()).toBe(42)
    expect(await once.get()).toBe(42)
    expect(calls).toBe(1)
  })

  it('a caller waits at most waitMs for a stuck attempt', async () => {
    const once = sharedOnce('t', () => new Promise<number>(() => {}), { waitMs: 30 })
    await expect(once.get()).rejects.toBeInstanceOf(SharedOnceTimeout)
  })

  it('a stuck attempt older than staleMs is replaced by a fresh one', async () => {
    let t = 0, calls = 0
    const once = sharedOnce('t', () => { calls++; return calls === 1 ? new Promise<number>(() => {}) : Promise.resolve(7) }, { waitMs: 20, staleMs: 100, now: () => t })
    await expect(once.get()).rejects.toBeInstanceOf(SharedOnceTimeout)
    t = 50
    await expect(once.get()).rejects.toBeInstanceOf(SharedOnceTimeout) // still the first attempt
    t = 200
    expect(await once.get()).toBe(7)
    expect(calls).toBe(2)
  })

  it('a failure is forgotten so the next caller retries', async () => {
    let calls = 0
    const once = sharedOnce('t', async () => { calls++; if (calls === 1) throw new Error('boom'); return 1 })
    await expect(once.get()).rejects.toThrow('boom')
    expect(await once.get()).toBe(1)
  })
})
