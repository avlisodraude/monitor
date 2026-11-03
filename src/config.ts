import type { MonitorConfig } from './types.js'

const unitMilliseconds = { h: 3_600_000, m: 60_000, s: 1_000 } as const

/** Parse a positive interval such as "30s", "2h30m", or "1.5h". */
export function parseInterval(interval: string): number {
  const clean = typeof interval === 'string' ? interval.trim().toLowerCase() : ''
  const error = `Invalid interval: "${interval}". Use formats like "30s", "5m", "1h", "2h30m".`
  if (!/^(?:\d+(?:\.\d+)?[hms]\s*)+$/.test(clean)) throw new Error(error)

  const units = new Set<string>()
  let milliseconds = 0
  for (const [, amount, unit] of clean.matchAll(/(\d+(?:\.\d+)?)([hms])/g)) {
    if (units.has(unit)) throw new Error(error)
    units.add(unit)
    milliseconds += Number(amount) * unitMilliseconds[unit as keyof typeof unitMilliseconds]
  }
  milliseconds = Math.round(milliseconds)
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) throw new Error(error)
  return milliseconds
}

function validateInterval(value: string, field: string): number {
  try {
    return parseInterval(value)
  } catch (error) {
    throw new Error(`${field}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

export function validateConfig(config: MonitorConfig): void {
  if (!Array.isArray(config?.checks)) throw new Error('checks must be an array')
  if (config.concurrency !== undefined && (!Number.isSafeInteger(config.concurrency) || config.concurrency < 1)) {
    throw new Error('concurrency must be a positive integer')
  }

  const names = new Set<string>()
  for (const [index, check] of config.checks.entries()) {
    const field = `checks[${index}]`
    if (typeof check?.name !== 'string' || !check.name.trim()) {
      throw new Error(`${field}.name must be a non-empty string`)
    }
    if (names.has(check.name)) throw new Error(`${field}.name duplicates check "${check.name}"`)
    names.add(check.name)

    if (typeof check.url !== 'string' || !URL.canParse(check.url)) {
      throw new Error(`${field}.url must be an absolute URL`)
    }
    if (check.retries !== undefined && (!Number.isSafeInteger(check.retries) || check.retries < 0)) {
      throw new Error(`${field}.retries must be a non-negative integer`)
    }
    if (check.interval !== undefined && validateInterval(check.interval, `${field}.interval`) > 2_147_483_647) {
      throw new Error(`${field}.interval must be at most 2147483647 ms`)
    }
    if (check.reAlertInterval !== undefined) {
      validateInterval(check.reAlertInterval, `${field}.reAlertInterval`)
    }
  }
}
