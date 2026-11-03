import { parseInterval, run, watch } from '../src/index.js'
import type { MonitorConfig } from '../src/types.js'

describe('parseInterval', () => {
  test.each([
    ['30s', 30_000],
    ['5m', 300_000],
    ['1h', 3_600_000],
    ['2h30m', 9_000_000],
    ['1h5m30s', 3_930_000],
    ['  1H  30m  ', 5_400_000],
    ['1.5h', 5_400_000],
    ['0.25s', 250],
    ['1.001s', 1001],
  ])('%j parses as %d milliseconds', (input, expected) => {
    expect(parseInterval(input)).toBe(expected)
  })

  test.each([
    '1h5x', '-5m', '5mins', '2hours', '30secs', '2hrs', '90x', 'abc', 'h', 'm5',
    '', '   ', '0', '0s', '0m', '0h', '1m2m', '9999999999999h',
  ])('rejects %j', (input) => {
    expect(() => parseInterval(input)).toThrow(/Invalid interval/)
  })
})

describe('configuration validation', () => {
  const check = { name: 'Homepage', url: 'https://example.com' }

  const cases: Array<[MonitorConfig, string]> = [
    [{ checks: [check], concurrency: 0 }, 'concurrency'],
    [{ checks: [check], concurrency: 1.5 }, 'concurrency'],
    [{ checks: [{ ...check, retries: -1 }] }, 'checks[0].retries'],
    [{ checks: [{ ...check, retries: 0.5 }] }, 'checks[0].retries'],
    [{ checks: [{ ...check, url: '/relative' }] }, 'checks[0].url'],
    [{ checks: [{ ...check, name: ' ' }] }, 'checks[0].name'],
    [{ checks: [check, check] }, 'checks[1].name duplicates'],
    [{ checks: [{ ...check, interval: '600h' }] }, 'checks[0].interval must be at most'],
    [{ checks: [{ ...check, reAlertInterval: '5minutes' }] }, 'checks[0].reAlertInterval'],
  ]

  test.each(cases)('run and watch reject invalid config %#', async (config, field) => {
    await expect(run(config)).rejects.toThrow(field)
    await expect(watch(config)).rejects.toThrow(field)
  })
})
