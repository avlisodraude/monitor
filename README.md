# @alosha/monitor

Playwright-based website monitoring for developers. Define checks, run multi-step journeys, assert on content, get notified on failures, and generate HTML reports — all from your terminal or CI pipeline.

[![npm version](https://img.shields.io/npm/v/@alosha/monitor)](https://www.npmjs.com/package/@alosha/monitor)
[![npm downloads](https://img.shields.io/npm/dm/@alosha/monitor)](https://www.npmjs.com/package/@alosha/monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install -D @alosha/monitor
npx playwright install chromium
```

## Quick start

Create a `monitor.config.ts` (or `.js`) in your project root:

```ts
import type { MonitorConfig } from '@alosha/monitor'

export default {
  checks: [
    // Simple URL check
    { name: 'Homepage', url: 'https://yoursite.com', interval: '5m' },

    // Multi-step journey with assertions
    {
      name: 'Login flow',
      url: 'https://yoursite.com/login',
      interval: '10m',
      steps: [
        { action: 'fill', selector: '#email', value: 'test@example.com' },
        { action: 'fill', selector: '#password', value: process.env.TEST_PASS! },
        { action: 'click', selector: 'button[type=submit]' },
        { action: 'waitForURL', value: '/dashboard' },
      ],
      assertions: [
        { type: 'title', contains: 'Dashboard' },
        { type: 'visible', selector: '.welcome-message' },
        { type: 'responseTime', maxMs: 3000 },
      ],
    },
  ],
  notify: {
    slack: { webhookUrl: process.env.SLACK_WEBHOOK_URL! },
  },
} satisfies MonitorConfig
```

Then run once:

```bash
npx monitor run
```

Or keep it running on a schedule:

```bash
npx monitor watch
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `checks` | `CheckConfig[]` | required | List of checks to run |
| `notify` | `NotifyConfig` | — | Alert destinations |
| `screenshotsDir` | `string` | `./monitor-screenshots` | Where to save failure screenshots |
| `reportsDir` | `string` | `.` | Where to save `monitor-report.html` |

### CheckConfig

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | Human-readable label |
| `url` | `string` | required | Full URL to navigate to |
| `interval` | `string` | `"5m"` | Watch mode interval. Supports `"30s"`, `"5m"`, `"1h"`, `"2h30m"` |
| `retries` | `number` | `2` | Retry attempts before marking failed |
| `timeout` | `number` | `10000` | Timeout per action in ms |
| `screenshotOnFailure` | `boolean` | `true` | Save a screenshot on failure |
| `steps` | `StepAction[]` | — | Multi-step journey actions |
| `assertions` | `Assertion[]` | — | Assertions to verify after steps |
| `maxResponseTimeMs` | `number` | — | Shorthand for `{ type: 'responseTime', maxMs }` assertion |

### Steps

```ts
steps: [
  { action: 'click',            selector: 'button' },
  { action: 'fill',             selector: '#email', value: 'user@example.com' },
  { action: 'select',           selector: 'select#plan', value: 'pro' },
  { action: 'hover',            selector: '.dropdown' },
  { action: 'waitForSelector',  selector: '.modal' },
  { action: 'waitForURL',       value: '/dashboard' },
  { action: 'waitForLoadState', value: 'networkidle' },
  { action: 'screenshot',       name: 'after-login' },
]
```

### Assertions

```ts
assertions: [
  { type: 'title',        contains: 'Dashboard' },
  { type: 'url',          contains: '/dashboard' },
  { type: 'visible',      selector: '.welcome-message' },
  { type: 'text',         selector: 'h1', contains: 'Welcome' },
  { type: 'responseTime', maxMs: 3000 },
]
```

### Notifications

```ts
notify: {
  email:   { to, from, smtpHost, smtpPort?, smtpUser, smtpPass },
  slack:   { webhookUrl },
  discord: { webhookUrl },
  webhook: { url, headers? },
}
```

## GitHub Actions

Drop this in `.github/workflows/monitor.yml` to run your checks every 15 minutes in CI:

```yaml
name: Monitor

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx playwright install chromium --with-deps
      - run: npx monitor run
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: monitor-report
          path: |
            monitor-report.html
            monitor-screenshots/
```

## Programmatic usage

```ts
import { run, watch } from '@alosha/monitor'

// One-shot run
const report = await run({ checks: [{ name: 'Homepage', url: 'https://example.com' }] })
console.log(report.passed, report.failed)

// Continuous watch
await watch({ checks: [{ name: 'Homepage', url: 'https://example.com', interval: '5m' }] })
```

---

Want hosted monitoring, dashboards, and team alerts? → [monitor.alosha.dev](https://monitor.alosha.dev)

Built by [Alosha](https://alosha.dev)
