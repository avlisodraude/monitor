// Recipe: Fail your CI build when a critical user journey breaks
//
// The problem: a deploy can pass unit tests but still break login or
// checkout in a real browser — and you find out from a customer.
//
// This points at example.com's login form as a stand-in target. Swap the
// url/selectors for a page you control to see real pass/fail behaviour —
// `run()` drives a real headless Chromium session through the journey.
import { run } from "@alosha/monitor";

const report = await run({
  checks: [
    {
      name: "Login flow",
      url: "https://app.example.com/login",
      steps: [
        { action: "fill", selector: "#email", value: process.env.TEST_EMAIL || "test@example.com" },
        { action: "fill", selector: "#password", value: process.env.TEST_PASS || "demo-password" },
        { action: "click", selector: "button[type=submit]" },
        { action: "waitForURL", value: "**/dashboard" },
      ],
      assertions: [{ type: "visible", selector: "[data-test=user-menu]" }],
    },
  ],
});

console.log(`passed: ${report.passed}, failed: ${report.failed}`);

// Break the build if any check failed.
if (report.failed > 0) process.exit(1);
