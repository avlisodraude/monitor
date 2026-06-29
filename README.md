# @alosha/monitor

Playwright-based website monitoring for developers. Define checks, run multi-step journeys, assert on content, get notified on failures, and generate HTML reports — all from your terminal or CI pipeline.

[![npm version](https://img.shields.io/npm/v/@alosha/monitor)](https://www.npmjs.com/package/@alosha/monitor)
[![npm downloads](https://img.shields.io/npm/dm/@alosha/monitor)](https://www.npmjs.com/package/@alosha/monitor)
[![Types included](https://img.shields.io/badge/types-included-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

- **Real user journeys, not just pings** — click, fill, hover, and wait through multi-step flows like login or checkout.
- **Assert on what matters** — page title, URL, element visibility, text content, and response time.
- **Get told the moment something breaks** — alerts to Slack, Discord, email, or any webhook.
- **Evidence on every failure** — automatic screenshots and a self-contained HTML report, runnable locally or in CI/GitHub Actions.

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

## Production recipes

Real problems, complete solutions — copy, paste, ship.

### Fail your CI build when a critical user journey breaks

**The problem:** a deploy can pass unit tests but still break login or checkout in a real browser — and you find out from a customer.

```ts
import { run } from '@alosha/monitor'

const report = await run({
  checks: [{
    name: 'Login flow',
    url: 'https://app.example.com/login',
    steps: [
      { action: 'fill',  selector: '#email',    value: process.env.TEST_EMAIL! },
      { action: 'fill',  selector: '#password', value: process.env.TEST_PASS! },
      { action: 'click', selector: 'button[type=submit]' },
      { action: 'waitForURL', value: '**/dashboard' }
    ],
    assertions: [{ type: 'visible', selector: '[data-test=user-menu]' }]
  }]
})

// Break the build if any check failed.
if (report.failed > 0) process.exit(1)
```

**Why it works:** `run()` drives a real Chromium session through the journey and returns a structured `RunReport`, so a single exit-code check turns "does login still work?" into a CI gate that blocks the deploy before users ever see the break.

### Get a Slack alert with a screenshot the moment a page goes down

**The problem:** uptime pings tell you a URL returns 200, not that the page actually rendered — and they rarely show you what the user saw.

```ts
import { watch } from '@alosha/monitor'

// Runs continuously, firing each check on its own interval.
await watch({
  checks: [
    { name: 'Homepage', url: 'https://example.com', interval: '1m', maxResponseTimeMs: 2000 },
    { name: 'Checkout', url: 'https://example.com/checkout', interval: '5m' }
  ],
  notify: { slack: { webhookUrl: process.env.SLACK_WEBHOOK_URL! } }
})
```

**Why it works:** `watch()` schedules each check independently and, on failure, captures a full-page screenshot before posting to Slack — so your first signal of an outage is an alert with visual proof, not a support ticket.

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

## Support & custom work

`@alosha/monitor` is free and MIT-licensed, and always will be. When you need more than the open-source CLI, there's a paid path backed by the maintainer — not a ticket queue:

- **Priority support** — a direct line to the person who wrote it, with prioritised fixes.
- **Custom work** — bespoke checks, assertions or notifier integrations, and help wiring Monitor into your CI/CD.

Get in touch at [alosha.dev/support](https://alosha.dev/support).

---

Docs & live demo: [monitor.alosha.dev](https://monitor.alosha.dev) · Built by [Alosha](https://alosha.dev)
