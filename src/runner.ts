import { chromium, type Page } from 'playwright'
import path from 'path'
import fs from 'fs'
import type {
  CheckConfig, CheckResult, StepAction, StepResult, Assertion, AssertionResult
} from './types.js'

// ---------------------------------------------------------------------------
// Step executor
// ---------------------------------------------------------------------------

function describeStep(step: StepAction): string {
  switch (step.action) {
    case 'click': return `click "${step.selector}"`
    case 'fill': return `fill "${step.selector}" with value`
    case 'select': return `select "${step.value}" in "${step.selector}"`
    case 'hover': return `hover "${step.selector}"`
    case 'waitForSelector': return `wait for "${step.selector}"`
    case 'waitForURL': return `wait for URL "${step.value}"`
    case 'waitForLoadState': return `wait for load state "${step.value ?? 'load'}"`
    case 'screenshot': return `screenshot "${step.name ?? 'step'}"`
  }
}

async function executeStep(
  page: Page,
  step: StepAction,
  timeout: number,
  screenshotsDir: string,
  checkName: string
): Promise<StepResult> {
  const description = describeStep(step)
  const start = Date.now()

  try {
    switch (step.action) {
      case 'click':
        await page.click(step.selector, { timeout })
        break
      case 'fill':
        await page.fill(step.selector, step.value, { timeout })
        break
      case 'select':
        await page.selectOption(step.selector, step.value, { timeout })
        break
      case 'hover':
        await page.hover(step.selector, { timeout })
        break
      case 'waitForSelector':
        await page.waitForSelector(step.selector, { timeout })
        break
      case 'waitForURL':
        await page.waitForURL(step.value, { timeout })
        break
      case 'waitForLoadState':
        await page.waitForLoadState(step.value ?? 'load', { timeout })
        break
      case 'screenshot': {
        fs.mkdirSync(screenshotsDir, { recursive: true })
        const safeName = (step.name ?? checkName).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const screenshotPath = path.join(screenshotsDir, `${safeName}_step_${Date.now()}.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        return { action: step.action, description, status: 'ok', durationMs: Date.now() - start, screenshotPath }
      }
    }

    return { action: step.action, description, status: 'ok', durationMs: Date.now() - start }
  } catch (err) {
    return {
      action: step.action,
      description,
      status: 'fail',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Assertion executor
// ---------------------------------------------------------------------------

function describeAssertion(a: Assertion): string {
  switch (a.type) {
    case 'title': return `title contains "${a.contains}"`
    case 'url': return `URL contains "${a.contains}"`
    case 'visible': return `"${a.selector}" is visible`
    case 'text': return `"${a.selector}" contains "${a.contains}"`
    case 'responseTime': return `response time ≤ ${a.maxMs}ms`
  }
}

async function runAssertion(
  page: Page,
  assertion: Assertion,
  durationMs: number
): Promise<AssertionResult> {
  const description = describeAssertion(assertion)

  try {
    switch (assertion.type) {
      case 'title': {
        const title = await page.title()
        if (!title.includes(assertion.contains))
          throw new Error(`Title "${title}" does not contain "${assertion.contains}"`)
        break
      }
      case 'url': {
        const url = page.url()
        if (!url.includes(assertion.contains))
          throw new Error(`URL "${url}" does not contain "${assertion.contains}"`)
        break
      }
      case 'visible': {
        const el = page.locator(assertion.selector)
        const visible = await el.isVisible()
        if (!visible) throw new Error(`"${assertion.selector}" is not visible`)
        break
      }
      case 'text': {
        const el = page.locator(assertion.selector)
        const text = await el.innerText()
        if (!text.includes(assertion.contains))
          throw new Error(`"${assertion.selector}" text "${text}" does not contain "${assertion.contains}"`)
        break
      }
      case 'responseTime': {
        if (durationMs > assertion.maxMs)
          throw new Error(`Response time ${durationMs}ms exceeds limit of ${assertion.maxMs}ms`)
        break
      }
    }

    return { type: assertion.type, description, status: 'ok' }
  } catch (err) {
    return {
      type: assertion.type,
      description,
      status: 'fail',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Main check runner
// ---------------------------------------------------------------------------

export async function runCheck(
  check: CheckConfig,
  screenshotsDir: string
): Promise<CheckResult> {
  const retries = check.retries ?? 2
  const timeout = check.timeout ?? 10_000
  const screenshotOnFailure = check.screenshotOnFailure ?? true
  const timestamp = new Date().toISOString()

  // Merge maxResponseTimeMs shorthand into assertions array
  const assertions: Assertion[] = [
    ...(check.assertions ?? []),
    ...(check.maxResponseTimeMs ? [{ type: 'responseTime' as const, maxMs: check.maxResponseTimeMs }] : []),
  ]

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
      const ok = response?.ok() ?? false

      if (!ok) {
        lastError = `HTTP ${lastStatusCode}`
        throw new Error(lastError)
      }

      const durationMs = Date.now() - start

      // Run steps
      const stepResults: StepResult[] = []
      if (check.steps?.length) {
        for (const step of check.steps) {
          const result = await executeStep(page, step, timeout, screenshotsDir, check.name)
          stepResults.push(result)
          if (result.status === 'fail') {
            lastError = `Step failed: ${result.description} — ${result.error}`
            throw new Error(lastError)
          }
        }
      }

      // Run assertions
      const assertionResults: AssertionResult[] = []
      if (assertions.length) {
        for (const assertion of assertions) {
          const result = await runAssertion(page, assertion, durationMs)
          assertionResults.push(result)
        }
        const failedAssertion = assertionResults.find(a => a.status === 'fail')
        if (failedAssertion) {
          lastError = `Assertion failed: ${failedAssertion.description} — ${failedAssertion.error}`
          throw new Error(lastError)
        }
      }

      await browser.close()
      return {
        name: check.name,
        url: check.url,
        status: 'ok',
        statusCode: lastStatusCode,
        durationMs,
        timestamp,
        attempt,
        ...(stepResults.length ? { steps: stepResults } : {}),
        ...(assertionResults.length ? { assertions: assertionResults } : {}),
      }
    } catch (err) {
      if (!lastError) lastError = err instanceof Error ? err.message : String(err)

      // Take screenshot on last failed attempt
      let screenshotPath: string | undefined
      if (screenshotOnFailure && attempt === retries + 1) {
        fs.mkdirSync(screenshotsDir, { recursive: true })
        const safeName = check.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        screenshotPath = path.join(screenshotsDir, `${safeName}_${Date.now()}.png`)
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
  }

  throw new Error('Unexpected end of runCheck')
}
