import type { MonitorConfig } from '@alosha/monitor'

export default {
  checks: [
    {
      name: 'Homepage',
      url: 'https://yoursite.com',
    },
    {
      name: 'Login page',
      url: 'https://yoursite.com/login',
      retries: 3,
      timeout: 15000,
    },
    {
      name: 'API health',
      url: 'https://api.yoursite.com/health',
      screenshotOnFailure: false,
    },
  ],
  notify: {
    email: {
      to: 'you@example.com',
      from: 'monitor@yoursite.com',
      smtpHost: process.env.SMTP_HOST!,
      smtpUser: process.env.SMTP_USER!,
      smtpPass: process.env.SMTP_PASS!,
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL!,
    },
  },
  screenshotsDir: './monitor-screenshots',
  reportsDir: '.',
} satisfies MonitorConfig
