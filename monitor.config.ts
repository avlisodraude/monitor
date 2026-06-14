import type { MonitorConfig } from "@alosha/monitor";

export default {
  checks: [
    { name: "Alosha", url: "https://alosha.dev", interval: "5m" },
    { name: "PixSqueeze", url: "https://pixsqueeze.alosha.dev", interval: "5m" },
    { name: "Monitor", url: "https://monitor.alosha.dev", interval: "5m" },
  ],
  notify: {
    email: {
      to: "you@example.com",
      from: "monitor@yoursite.com",
      smtpHost: process.env.SMTP_HOST!,
      smtpUser: process.env.SMTP_USER!,
      smtpPass: process.env.SMTP_PASS!,
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL!,
    },
  },
  screenshotsDir: "./monitor-screenshots",
  reportsDir: ".",
} satisfies MonitorConfig;
