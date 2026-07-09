import { runCheck } from './runner.js'
import { notify } from './notify.js'
import { generateReport } from './report.js'
import { getBrowser, closeBrowser } from './browser.js'
import { createLimiter } from './concurrency.js'
import type { MonitorConfig, CheckResult, CheckStatus } from './types.js'

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
  const concurrency = config.concurrency ?? 4

  const DEFAULT_INTERVAL = '5m'
  const results: CheckResult[] = []

  // Per-check alert state, used to notify only on ok<->fail transitions
  // (plus optional re-alerts for sustained outages) instead of every failing run.
  const alertStates = new Map<string, { previousStatus?: CheckStatus; lastAlertAt?: number }>()

  const browser = await getBrowser()
  const limit = createLimiter(concurrency)

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log('\n\n  Shutting down...')
    await closeBrowser()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  console.log('\n👁  @alosha/monitor — watch mode\n')

  // Run all checks immediately on start, then schedule each independently
  for (const check of config.checks) {
    const intervalStr = check.interval ?? DEFAULT_INTERVAL
    const intervalMs = parseInterval(intervalStr)

    console.log(`  ⏱  ${check.name} — every ${formatInterval(intervalMs)}`)

    const runAndLog = async () => {
      const result = await limit(() => runCheck(check, screenshotsDir, browser))
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

      // Notify only on ok<->fail transitions, plus optional re-alerts for
      // sustained outages. The very first result for a check counts as a
      // transition when it's a failure, so a check that starts down still alerts.
      const state = alertStates.get(check.name) ?? {}
      const isFirstRun = state.previousStatus === undefined
      const transitioned = !isFirstRun && state.previousStatus !== result.status

      let shouldNotify = false
      if (result.status === 'fail' && (isFirstRun || transitioned)) {
        shouldNotify = true
      } else if (result.status === 'fail' && check.reAlertInterval) {
        const reAlertMs = parseInterval(check.reAlertInterval)
        shouldNotify = !state.lastAlertAt || Date.now() - state.lastAlertAt >= reAlertMs
      } else if (result.status === 'ok' && transitioned) {
        shouldNotify = true
      }

      if (shouldNotify && config.notify) {
        await notify(result, config.notify, result.status === 'ok' ? 'recovery' : 'down')
        state.lastAlertAt = Date.now()
      }

      state.previousStatus = result.status
      alertStates.set(check.name, state)
    }

    // Schedule the next run only after the current one finishes, so a run
    // that outlives its interval (easy with retries) can't overlap with the next.
    const scheduleNext = () => {
      if (shuttingDown) return
      setTimeout(() => {
        runAndLog()
          .catch((err) => {
            console.error(`  ⚠ ${check.name}: unexpected error — ${err instanceof Error ? err.message : String(err)}`)
          })
          .finally(scheduleNext)
      }, intervalMs)
    }

    // Run immediately, then on interval
    await runAndLog()
    scheduleNext()
  }

  console.log('\n  Watching... (Ctrl+C to stop)\n')

  // Keep process alive
  process.stdin.resume()
}
