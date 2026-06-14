// ---------------------------------------------------------------------------
// Journey steps
// ---------------------------------------------------------------------------

export type StepAction =
  | { action: 'click'; selector: string }
  | { action: 'fill'; selector: string; value: string }
  | { action: 'select'; selector: string; value: string }
  | { action: 'hover'; selector: string }
  | { action: 'waitForSelector'; selector: string }
  | { action: 'waitForURL'; value: string }
  | { action: 'waitForLoadState'; value?: 'load' | 'domcontentloaded' | 'networkidle' }
  | { action: 'screenshot'; name?: string }

export interface StepResult {
  action: string
  description: string
  status: 'ok' | 'fail'
  durationMs: number
  error?: string
  screenshotPath?: string
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export type Assertion =
  | { type: 'title'; contains: string }
  | { type: 'url'; contains: string }
  | { type: 'visible'; selector: string }
  | { type: 'text'; selector: string; contains: string }
  | { type: 'responseTime'; maxMs: number }

export interface AssertionResult {
  type: string
  description: string
  status: 'ok' | 'fail'
  error?: string
}

// ---------------------------------------------------------------------------
// Check config
// ---------------------------------------------------------------------------

export interface CheckConfig {
  /** Human-readable name for this check */
  name: string
  /** Full URL to navigate to */
  url: string
  /** Interval between checks (e.g. "5m", "1h"). Used by scheduler. */
  interval?: string
  /** Number of retry attempts before reporting failure. Default: 2 */
  retries?: number
  /** Timeout per action in milliseconds. Default: 10000 */
  timeout?: number
  /** Whether to take a screenshot on failure. Default: true */
  screenshotOnFailure?: boolean
  /** Multi-step journey actions to perform after page load */
  steps?: StepAction[]
  /** Assertions to verify after all steps complete */
  assertions?: Assertion[]
  /** Max allowed response time in ms — shorthand for { type: 'responseTime', maxMs } */
  maxResponseTimeMs?: number
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotifyConfig {
  email?: {
    to: string
    from: string
    smtpHost: string
    smtpPort?: number
    smtpUser: string
    smtpPass: string
  }
  slack?: { webhookUrl: string }
  discord?: { webhookUrl: string }
  webhook?: {
    url: string
    headers?: Record<string, string>
  }
}

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

export interface MonitorConfig {
  checks: CheckConfig[]
  notify?: NotifyConfig
  /** Directory to save screenshots. Default: "./monitor-screenshots" */
  screenshotsDir?: string
  /** Directory to save HTML reports. Default: "." */
  reportsDir?: string
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

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
  /** Step-by-step results (only present when steps were defined) */
  steps?: StepResult[]
  /** Assertion results (only present when assertions were defined) */
  assertions?: AssertionResult[]
}

export interface RunReport {
  ranAt: string
  results: CheckResult[]
  passed: number
  failed: number
}
