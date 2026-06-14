import { runCheck } from './runner.js'
import { notify } from './notify.js'
import { generateReport } from './report.js'
import type { MonitorConfig, CheckResult } from './types.js'

/**
 * Parse a human-readable interval string into milliseconds.
 * Supports: "30s", "5m", "1h", "2h30m", etc.
 */
export function parseInterval(interval: string): number {
  const clean = interval.trim().toLowerCase()
  const hours = clean.match(/(\d+)h/)
  const minutes = clean.match(/(\d+)m/)
  const seconds = clean.match(/(\d+)s/)

  const ms =
    (hours ? parseInt(hours[1]) * 3_600_000 : 0) +
    (minutes ? parseInt(minutes[1]) * 60_000 : 0) +
    (seconds ? parseInt(seconds[1]) * 1_000 : 0)

  if (ms === 0) throw new Error(`Invalid interval: "${interval}". Use formats like "30s", "5m", "1h", "2h30m".`)
  return ms
}

function formatInterval(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join('')
}

function timestamp(): string {
  return new Date().toLocaleTimeString()
}

export async function watch(config: MonitorConfig): Promise<void> {
  const screenshotsDir = config.screenshotsDir ?? './monitor-screenshots'
  const reportsDir = config.reportsDir ?? '.'

  const DEFAULT_INTERVAL = '5m'
  const results: CheckResult[] = []

  console.log('\n👁  @alosha/monitor — watch mode\n')

  // Run all checks immediately on start, then schedule each independently
  for (const check of config.checks) {
    const intervalStr = check.interval ?? DEFAULT_INTERVAL
    const intervalMs = parseInterval(intervalStr)

    console.log(`  ⏱  ${check.name} — every ${formatInterval(intervalMs)}`)

    const runAndLog = async () => {
      const result = await runCheck(check, screenshotsDir)
      const icon = result.status === 'ok' ? '✓' : '✗'
      const label = result.status === 'ok' ? 'OK  ' : 'FAIL'
      console.log(`  ${icon} [${label}] [${timestamp()}] ${result.name} — ${result.durationMs}ms${result.error ? ` — ${result.error}` : ''}`)

      if (result.screenshotPath) {
        console.log(`       Screenshot: ${result.screenshotPath}`)
      }

      // Update shared results and re-generate report
      const idx = results.findIndex((r) => r.name === result.name)
      if (idx >= 0) results[idx] = result
      else results.push(result)

      generateReport(
        {
          ranAt: new Date().toISOString(),
          results: [...results],
          passed: results.filter((r) => r.status === 'ok').length,
          failed: results.filter((r) => r.status === 'fail').length,
        },
        reportsDir
      )

      // Notify on failure
      if (result.status === 'fail' && config.notify) {
        await notify(result, config.notify)
      }
    }

    // Run immediately, then on interval
    await runAndLog()
    setInterval(runAndLog, intervalMs)
  }

  console.log('\n  Watching... (Ctrl+C to stop)\n')

  // Keep process alive
  process.stdin.resume()
}
