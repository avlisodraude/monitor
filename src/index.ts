import { runCheck } from './runner.js'
import { notify } from './notify.js'
import { generateReport } from './report.js'
import type { MonitorConfig, RunReport } from './types.js'

export type { MonitorConfig, CheckConfig, NotifyConfig, CheckResult, RunReport } from './types.js'

/**
 * Run all checks defined in the config.
 * Returns a report and optionally generates an HTML file.
 */
export async function run(config: MonitorConfig): Promise<RunReport> {
  const screenshotsDir = config.screenshotsDir ?? './monitor-screenshots'
  const reportsDir = config.reportsDir ?? '.'

  const results = await Promise.all(
    config.checks.map((check) => runCheck(check, screenshotsDir))
  )

  const failed = results.filter((r) => r.status === 'fail')
  const passed = results.filter((r) => r.status === 'ok')

  const report: RunReport = {
    ranAt: new Date().toISOString(),
    results,
    passed: passed.length,
    failed: failed.length,
  }

  // Send notifications for failures
  if (config.notify && failed.length > 0) {
    await Promise.all(failed.map((r) => notify(r, config.notify!)))
  }

  // Generate HTML report
  generateReport(report, reportsDir)

  return report
}
