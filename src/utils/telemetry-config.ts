/**
 * Telemetry Configuration Utilities
 *
 * Manages telemetry settings and opt-out mechanisms
 */

import type { TelemetryConfig } from '../types/telemetry'

/**
 * Safely get an environment variable
 * Works in both Node.js and Cloudflare Workers environments
 */
function safeGetEnv(key: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key]
    }
  } catch {
    // process is not defined in this runtime (e.g., Cloudflare Workers)
  }
  return undefined
}

/**
 * Get default telemetry configuration
 * Uses lazy evaluation to avoid accessing process.env at module load time
 */
export function getDefaultTelemetryConfig(): TelemetryConfig {
  // BizzCMS: no default endpoint. Usage data is never sent anywhere unless a site sets its own endpoint.
  return {
    enabled: false,
    host: safeGetEnv('BIZZCMS_TELEMETRY_ENDPOINT') || '',
    debug: safeGetEnv('NODE_ENV') === 'development'
  }
}

/**
 * Telemetry is OFF by default (BizzCMS, opt-in): it runs only when BIZZCMS_TELEMETRY is "true" AND
 * BIZZCMS_TELEMETRY_ENDPOINT names the site's own endpoint. DO_NOT_TRACK always wins.
 */
export function isTelemetryEnabled(): boolean {
  const doNotTrack = safeGetEnv('DO_NOT_TRACK')
  if (doNotTrack === '1' || doNotTrack === 'true') return false
  const optIn = safeGetEnv('BIZZCMS_TELEMETRY')
  return (optIn === 'true' || optIn === '1') && !!safeGetEnv('BIZZCMS_TELEMETRY_ENDPOINT')
}

/**
 * Get telemetry configuration from environment
 */
export function getTelemetryConfig(): TelemetryConfig {
  return {
    ...getDefaultTelemetryConfig(),
    enabled: isTelemetryEnabled()
  }
}

/**
 * Check if telemetry should be skipped for this event
 * Used to implement sampling or rate limiting if needed
 */
export function shouldSkipEvent(eventName: string, sampleRate: number = 1.0): boolean {
  if (sampleRate >= 1.0) return false
  if (sampleRate <= 0) return true

  // Use a consistent hash of the event name for deterministic sampling
  let hash = 0
  for (let i = 0; i < eventName.length; i++) {
    hash = ((hash << 5) - hash) + eventName.charCodeAt(i)
    hash = hash & hash
  }

  return Math.abs(hash % 100) / 100 > sampleRate
}
