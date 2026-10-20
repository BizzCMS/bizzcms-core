/**
 * Setup work runs once per deployed version (CF_VERSION_METADATA.id), remembered in the isolate and in CACHE_KV, so
 * new isolates skip the D1 writes. Without a deploy id nothing changes: the step runs every time.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { oncePerDeploy, doneThisDeploy, resetOncePerDeploy, deployIdOf } from '../utils/once-per-deploy'

function kv() {
  const store = new Map<string, string>()
  return { store, get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v) } }
}

describe('oncePerDeploy', () => {
  beforeEach(() => resetOncePerDeploy())

  it('runs once per deploy id and remembers it in KV', async () => {
    const CACHE_KV = kv()
    const env = { CACHE_KV, CF_VERSION_METADATA: { id: 'v1' } }
    let runs = 0
    await oncePerDeploy(env, 'step', async () => { runs++ })
    await oncePerDeploy(env, 'step', async () => { runs++ })
    expect(runs).toBe(1)
    expect(CACHE_KV.store.get('bizz:once:step:v1')).toBe('1')
    // A new isolate (memory cleared) reads KV and skips.
    resetOncePerDeploy()
    await oncePerDeploy(env, 'step', async () => { runs++ })
    expect(runs).toBe(1)
  })

  it('a new deploy runs it again', async () => {
    const CACHE_KV = kv()
    let runs = 0
    await oncePerDeploy({ CACHE_KV, CF_VERSION_METADATA: { id: 'v1' } }, 'step', async () => { runs++ })
    await oncePerDeploy({ CACHE_KV, CF_VERSION_METADATA: { id: 'v2' } }, 'step', async () => { runs++ })
    expect(runs).toBe(2)
  })

  it('without a deploy id it runs every time (previous behaviour)', async () => {
    const env = { CACHE_KV: kv() }
    expect(deployIdOf(env)).toBeNull()
    let runs = 0
    await oncePerDeploy(env, 'step', async () => { runs++ })
    await oncePerDeploy(env, 'step', async () => { runs++ })
    expect(runs).toBe(2)
    expect(await doneThisDeploy(env, 'step')).toBe(false)
  })

  it('a failing step is not marked and runs again', async () => {
    const env = { CACHE_KV: kv(), CF_VERSION_METADATA: { id: 'v1' } }
    let runs = 0
    await expect(oncePerDeploy(env, 'step', async () => { runs++; throw new Error('d1 busy') })).rejects.toThrow('d1 busy')
    await oncePerDeploy(env, 'step', async () => { runs++ })
    expect(runs).toBe(2)
    expect(await doneThisDeploy(env, 'step')).toBe(true)
  })
})
