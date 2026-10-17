/**
 * Version utility
 *
 * Provides the current version of bizzcms-core package
 */

import pkg from '../../package.json'

export const BIZZCMS_VERSION = pkg.version

/**
 * Get the current BizzCMS core version
 */
export function getCoreVersion(): string {
  return BIZZCMS_VERSION
}
