import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import type { CheckConfig, CheckResult } from './types.js'

export async function runCheck(
  check: CheckConfig,
  screenshotsDir: string
): Promise<CheckResult> {
  const retries = check.retries ?? 2
  const timeout = check.timeout ?? 10_000
  const screenshotOnFailure = check.screenshotOnFailure ?? true
  const timestamp = new Date().toISOString()

  let lastError: string | undefined
  let lastStatusCode: number | undefined

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const browser = await chromium.launch()
    const page = await browser.newPage()
    const start = Date.now()

    try {
      const response = await page.goto(check.url, {
        timeout,
        waitUntil: 'domcontentloaded',
      })

      lastStatusCode = response?.status()
      const durationMs = Date.now() - start
      const ok = response?.ok() ?? false

      if (ok) {
        await browser.close()
        return {
          name: check.name,
          url: check.url,
          status: 'ok',
          statusCode: lastStatusCode,
          durationMs,
          timestamp,
          attempt,
        }
      }

      lastError = `HTTP ${lastStatusCode}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }

    // Take screenshot on last failed attempt
    let screenshotPath: string | undefined
    if (screenshotOnFailure && attempt === retries + 1) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
      const safeName = check.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      screenshotPath = path.join(
        screenshotsDir,
        `${safeName}_${Date.now()}.png`
      )
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true })
      } catch {
        screenshotPath = undefined
      }
    }

    await browser.close()

    if (attempt === retries + 1) {
      return {
        name: check.name,
        url: check.url,
        status: 'fail',
        statusCode: lastStatusCode,
        durationMs: Date.now() - start,
        error: lastError,
        screenshotPath,
        timestamp,
        attempt,
      }
    }
  }

  // Unreachable but satisfies TS
  throw new Error('Unexpected end of runCheck')
}
