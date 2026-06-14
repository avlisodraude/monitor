# @alosha/monitor

Playwright-based website monitoring for developers. Define checks, get notified on failures, generate HTML reports — all from your terminal or CI pipeline.

[![npm version](https://img.shields.io/npm/v/@alosha/monitor)](https://www.npmjs.com/package/@alosha/monitor)
[![npm downloads](https://img.shields.io/npm/dm/@alosha/monitor)](https://www.npmjs.com/package/@alosha/monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install -D @alosha/monitor
```

> Playwright browsers are installed automatically on first run via `playwright install chromium`.

## Quick start

Create a `monitor.config.ts` (or `.js`) in your project root:

```ts
import type { MonitorConfig } from '@alosha/monitor'

export default {
  checks: [
    { name: 'Homepage',    url: 'https://yoursite.com' },
    { name: 'Login page',  url: 'https://yoursite.com/login', retries: 3 },
    { name: 'API health',  url: 'https://api.yoursite.com/health' },
  ],
  notify: {
    email: {
      to: 'you@example.com',
      from: 'monitor@yoursite.com',
      smtpHost: process.env.SMTP_HOST!,
      smtpUser: process.env.SMTP_USER!,
      smtpPass: process.env.SMTP_PASS!,
    },
  },
} satisfies MonitorConfig
```

Then run:

```bash
npx monitor run
```

You'll get a terminal summary and an `monitor-report.html` file.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `checks` | `CheckConfig[]` | required | List of URLs to monitor |
| `notify` | `NotifyConfig` | — | Alert destinations |
| `screenshotsDir` | `string` | `./monitor-screenshots` | Where to save failure screenshots |
| `reportsDir` | `string` | `.` | Where to save `monitor-report.html` |

### CheckConfig

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | Human-readable label |
| `url` | `string` | required | Full URL to check |
| `retries` | `number` | `2` | Retry attempts before marking failed |
| `timeout` | `number` | `10000` | Timeout in ms |
| `screenshotOnFailure` | `boolean` | `true` | Save a screenshot on failure |

### Notifications

```ts
notify: {
  email:   { to, from, smtpHost, smtpPort?, smtpUser, smtpPass },
  slack:   { webhookUrl },
  discord: { webhookUrl },
  webhook: { url, headers? },
}
```

## Programmatic usage

```ts
import { run } from '@alosha/monitor'

const report = await run({
  checks: [{ name: 'Homepage', url: 'https://example.com' }],
})

console.log(report.passed, report.failed)
```

## GitHub Actions

```yaml
- name: Run monitors
  run: npx monitor run
  env:
    SMTP_HOST: ${{ secrets.SMTP_HOST }}
    SMTP_USER: ${{ secrets.SMTP_USER }}
    SMTP_PASS: ${{ secrets.SMTP_PASS }}
```

---

Want hosted monitoring, dashboards, and team alerts? → [monitor.alosha.dev](https://monitor.alosha.dev)

Built by [Alosha](https://alosha.dev)
