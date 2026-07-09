import fs from 'fs'
import os from 'os'
import path from 'path'
import { generateReport } from '../src/report.js'
import type { RunReport } from '../src/types.js'

// generateReport writes straight to disk (no in-memory API), so we point it
// at a throwaway temp dir per test and read the file back. That's real fs,
// but scoped to os.tmpdir() and cleaned up after — no network, no mocking
// needed for what is fundamentally a "write this string to a file" function.

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-report-test-'))
}

function readReport(outputDir: string): string {
  return fs.readFileSync(path.join(outputDir, 'monitor-report.html'), 'utf-8')
}

const baseReport: RunReport = {
  ranAt: '2026-07-09T12:00:00.000Z',
  passed: 1,
  failed: 1,
  results: [
    {
      name: 'Homepage',
      url: 'https://example.com',
      status: 'ok',
      statusCode: 200,
      durationMs: 123,
      timestamp: '2026-07-09T12:00:00.000Z',
      attempt: 1,
    },
    {
      name: 'Checkout',
      url: 'https://example.com/checkout',
      status: 'fail',
      statusCode: 500,
      durationMs: 456,
      error: 'Timed out waiting for selector',
      screenshotPath: './monitor-screenshots/checkout.png',
      timestamp: '2026-07-09T12:00:01.000Z',
      attempt: 3,
    },
  ],
}

describe('generateReport', () => {
  let outputDir: string

  beforeEach(() => {
    outputDir = makeTmpDir()
  })

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  test('writes monitor-report.html into the given directory and returns its path', () => {
    const outPath = generateReport(baseReport, outputDir)
    expect(outPath).toBe(path.join(outputDir, 'monitor-report.html'))
    expect(fs.existsSync(outPath)).toBe(true)
  })

  test('creates the output directory if it does not exist yet', () => {
    const nested = path.join(outputDir, 'nested', 'dir')
    const outPath = generateReport(baseReport, nested)
    expect(fs.existsSync(outPath)).toBe(true)
  })

  test('summary counts reflect passed/failed/total', () => {
    generateReport(baseReport, outputDir)
    const html = readReport(outputDir)
    expect(html).toMatch(/<div class="stat ok"><span>1<\/span>Passed<\/div>/)
    expect(html).toMatch(/<div class="stat fail"><span>1<\/span>Failed<\/div>/)
    expect(html).toMatch(/<div class="stat"><span>2<\/span>Total<\/div>/)
  })

  test('renders one table row per result, with ok/fail row classes', () => {
    generateReport(baseReport, outputDir)
    const html = readReport(outputDir)
    expect(html).toMatch(/<tr class="ok">[\s\S]*Homepage/)
    expect(html).toMatch(/<tr class="fail">[\s\S]*Checkout/)
  })

  test('renders status badges, url links, duration, and error text', () => {
    generateReport(baseReport, outputDir)
    const html = readReport(outputDir)
    expect(html).toContain('<span class="badge ok">✓ OK</span>')
    expect(html).toContain('<span class="badge fail">✗ FAIL</span>')
    expect(html).toContain('<a href="https://example.com" target="_blank">https://example.com</a>')
    expect(html).toContain('123ms')
    expect(html).toContain('Timed out waiting for selector')
  })

  test('renders a screenshot link only for results that have one', () => {
    generateReport(baseReport, outputDir)
    const html = readReport(outputDir)
    expect(html).toContain('<a href="./monitor-screenshots/checkout.png">view</a>')
    // Homepage has no screenshotPath — its screenshot cell should be the placeholder, not a link
    // (it still has a link in the URL cell, so assert on the "view" screenshot link specifically).
    const homepageRow = html.slice(html.indexOf('Homepage'), html.indexOf('Checkout'))
    expect(homepageRow).not.toContain('>view<')
  })

  test('renders a sub-row per step and per assertion, under the parent result', () => {
    const withSteps: RunReport = {
      ranAt: baseReport.ranAt,
      passed: 0,
      failed: 1,
      results: [
        {
          name: 'Login flow',
          url: 'https://example.com/login',
          status: 'fail',
          durationMs: 789,
          timestamp: '2026-07-09T12:00:02.000Z',
          attempt: 1,
          steps: [
            { action: 'click', description: 'click #submit', status: 'ok', durationMs: 10 },
            { action: 'waitForSelector', description: 'wait for #dashboard', status: 'fail', durationMs: 5000, error: 'selector not found' },
          ],
          assertions: [
            { type: 'url', description: 'url contains /dashboard', status: 'fail', error: 'url was /login' },
          ],
        },
      ],
    }
    generateReport(withSteps, outputDir)
    const html = readReport(outputDir)
    expect(html).toContain('↳ step')
    expect(html).toContain('click #submit')
    expect(html).toContain('wait for #dashboard')
    expect(html).toContain('selector not found')
    expect(html).toContain('↳ assert')
    expect(html).toContain('url contains /dashboard')
    expect(html).toContain('url was /login')
  })

  test('a result with no steps or assertions renders no sub-rows', () => {
    generateReport(baseReport, outputDir)
    const html = readReport(outputDir)
    expect(html).not.toContain('↳ step')
    expect(html).not.toContain('↳ assert')
  })

  // Documents current behaviour, not a claim that it's desired: names/urls/errors
  // are interpolated into the HTML template with no escaping. A check name or
  // error message containing markup would be injected into the report as-is.
  test('current behaviour: result fields are interpolated without HTML-escaping', () => {
    const withMarkup: RunReport = {
      ranAt: baseReport.ranAt,
      passed: 0,
      failed: 1,
      results: [
        {
          name: '<b>Bold Check</b>',
          url: 'https://example.com',
          status: 'fail',
          durationMs: 1,
          timestamp: baseReport.ranAt,
          attempt: 1,
        },
      ],
    }
    generateReport(withMarkup, outputDir)
    const html = readReport(outputDir)
    expect(html).toContain('<strong><b>Bold Check</b></strong>')
  })
})
