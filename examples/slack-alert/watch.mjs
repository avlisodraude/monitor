// Recipe: Get a Slack alert with a screenshot the moment a page goes down
//
// The problem: uptime pings tell you a URL returns 200, not that the page
// actually rendered — and they rarely show you what the user saw.
//
// Set SLACK_WEBHOOK_URL to see real alerts; without it, watch() still runs
// the checks on their intervals, it just has nowhere to notify.
import { watch } from "@alosha/monitor";

await watch({
  checks: [
    { name: "Homepage", url: "https://example.com", interval: "1m", maxResponseTimeMs: 2000 },
    { name: "Checkout", url: "https://example.com/checkout", interval: "5m" },
  ],
  notify: {
    slack: { webhookUrl: process.env.SLACK_WEBHOOK_URL || "" },
  },
});
