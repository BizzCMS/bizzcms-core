import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getDefaultTelemetryConfig,
  isTelemetryEnabled,
  getTelemetryConfig,
  shouldSkipEvent
} from './telemetry-config'

describe('telemetry-config', () => {
  // Store original process.env
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv }
    // Clear any cached values
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv
  })

  // BizzCMS: telemetry is opt-in and has no default endpoint (nothing is ever sent to a third party).
  describe('getDefaultTelemetryConfig', () => {
    it('is disabled with no endpoint by default', () => {
      delete process.env.BIZZCMS_TELEMETRY_ENDPOINT
      delete process.env.NODE_ENV
      const config = getDefaultTelemetryConfig()
      expect(config.enabled).toBe(false)
      expect(config.host).toBe('')
      expect(config.debug).toBe(false)
    })

    it('uses the endpoint from BIZZCMS_TELEMETRY_ENDPOINT', () => {
      process.env.BIZZCMS_TELEMETRY_ENDPOINT = 'https://stats.example.com'
      expect(getDefaultTelemetryConfig().host).toBe('https://stats.example.com')
    })

    it('enables debug mode in development', () => {
      process.env.NODE_ENV = 'development'
      expect(getDefaultTelemetryConfig().debug).toBe(true)
    })
  })

  describe('isTelemetryEnabled', () => {
    beforeEach(() => {
      delete process.env.BIZZCMS_TELEMETRY
      delete process.env.BIZZCMS_TELEMETRY_ENDPOINT
      delete process.env.DO_NOT_TRACK
      delete process.env.BIZZCMS_TELEMETRY
    })

    it('is false by default (opt-in)', () => {
      expect(isTelemetryEnabled()).toBe(false)
    })

    it('ignores the old BIZZCMS_TELEMETRY variable', () => {
      process.env.BIZZCMS_TELEMETRY = 'true'
      expect(isTelemetryEnabled()).toBe(false)
    })

    it('stays false when opted in without an endpoint', () => {
      process.env.BIZZCMS_TELEMETRY = 'true'
      expect(isTelemetryEnabled()).toBe(false)
    })

    it('is true only with opt-in AND an endpoint', () => {
      process.env.BIZZCMS_TELEMETRY = 'true'
      process.env.BIZZCMS_TELEMETRY_ENDPOINT = 'https://stats.example.com'
      expect(isTelemetryEnabled()).toBe(true)
    })

    it('DO_NOT_TRACK always wins', () => {
      process.env.BIZZCMS_TELEMETRY = 'true'
      process.env.BIZZCMS_TELEMETRY_ENDPOINT = 'https://stats.example.com'
      process.env.DO_NOT_TRACK = '1'
      expect(isTelemetryEnabled()).toBe(false)
    })
  })

  describe('getTelemetryConfig', () => {
    it('is disabled unless opted in', () => {
      delete process.env.BIZZCMS_TELEMETRY
      expect(getTelemetryConfig().enabled).toBe(false)
    })
  })

  describe('shouldSkipEvent', () => {
    it('should not skip event when sample rate is 1.0 (100%)', () => {
      const shouldSkip = shouldSkipEvent('test_event', 1.0)

      expect(shouldSkip).toBe(false)
    })

    it('should not skip event when sample rate is greater than 1.0', () => {
      const shouldSkip = shouldSkipEvent('test_event', 1.5)

      expect(shouldSkip).toBe(false)
    })

    it('should skip event when sample rate is 0', () => {
      const shouldSkip = shouldSkipEvent('test_event', 0)

      expect(shouldSkip).toBe(true)
    })

    it('should skip event when sample rate is negative', () => {
      const shouldSkip = shouldSkipEvent('test_event', -0.5)

      expect(shouldSkip).toBe(true)
    })

    it('should use default sample rate of 1.0 when not provided', () => {
      const shouldSkip = shouldSkipEvent('test_event')

      expect(shouldSkip).toBe(false)
    })

    it('should be deterministic for the same event name', () => {
      // Same event name should always produce the same result
      const results = new Set<boolean>()

      for (let i = 0; i < 10; i++) {
        results.add(shouldSkipEvent('consistent_event', 0.5))
      }

      // All results should be the same (deterministic)
      expect(results.size).toBe(1)
    })

    it('should produce different results for different event names at partial sample rate', () => {
      // With 50% sample rate, some events should skip and some shouldn't
      // We test with many different event names to verify the hash-based sampling
      const eventNames = [
        'event_a', 'event_b', 'event_c', 'event_d', 'event_e',
        'event_f', 'event_g', 'event_h', 'event_i', 'event_j',
        'event_k', 'event_l', 'event_m', 'event_n', 'event_o'
      ]

      const results = eventNames.map(name => shouldSkipEvent(name, 0.5))
      const skipped = results.filter(r => r === true).length
      const notSkipped = results.filter(r => r === false).length

      // With 50% sample rate, we should see some of each (not all same)
      // This test may occasionally fail with very unlucky event names, but is statistically unlikely
      expect(skipped).toBeGreaterThan(0)
      expect(notSkipped).toBeGreaterThan(0)
    })

    it('should handle empty event name', () => {
      // Empty string should still produce a deterministic result
      const result1 = shouldSkipEvent('', 0.5)
      const result2 = shouldSkipEvent('', 0.5)

      expect(result1).toBe(result2)
    })

    it('should handle special characters in event name', () => {
      const shouldSkip = shouldSkipEvent('test_event_!@#$%^&*()', 1.0)

      expect(shouldSkip).toBe(false)
    })

    it('should handle unicode characters in event name', () => {
      const shouldSkip = shouldSkipEvent('test_event_\u{1F600}\u{1F680}', 1.0)

      expect(shouldSkip).toBe(false)
    })
  })
})
