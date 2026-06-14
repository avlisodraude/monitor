export interface CheckConfig {
  /** Human-readable name for this check */
  name: string
  /** Full URL to check */
  url: string
  /** Interval between checks (e.g. "5m", "1h"). Used by scheduler. */
  interval?: string
  /** Number of retry attempts before reporting failure. Default: 2 */
  retries?: number
  /** Timeout in milliseconds. Default: 10000 */
  timeout?: number
  /** Whether to take a screenshot on failure. Default: true */
  screenshotOnFailure?: boolean
}

export interface NotifyConfig {
  email?: {
    to: string
    from: string
    smtpHost: string
    smtpPort?: number
    smtpUser: string
    smtpPass: string
  }
  slack?: {
    webhookUrl: string
  }
  discord?: {
    webhookUrl: string
  }
  webhook?: {
    url: string
    headers?: Record<string, string>
  }
}

export interface MonitorConfig {
  checks: CheckConfig[]
  notify?: NotifyConfig
  /** Directory to save screenshots. Default: "./monitor-screenshots" */
  screenshotsDir?: string
  /** Directory to save HTML reports. Default: "." */
  reportsDir?: string
}

export type CheckStatus = 'ok' | 'fail'

export interface CheckResult {
  name: string
  url: string
  status: CheckStatus
  statusCode?: number
  durationMs: number
  error?: string
  screenshotPath?: string
  timestamp: string
  attempt: number
}

export interface RunReport {
  ranAt: string
  results: CheckResult[]
  passed: number
  failed: number
}
