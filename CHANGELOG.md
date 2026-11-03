# Changelog

## 0.5.0

### Upgrade notes

- Monitor now requires Node.js 20 or later. Use Node.js 24 LTS for new installations and CI.
- Both `run` and `watch` validate configuration before launching Chromium. Use unique check names, absolute URLs, non-negative integer retry counts, and a positive integer concurrency limit.
- Intervals accept `h`, `m`, and `s`, including compound values such as `2h30m` and decimals such as `1.5h`. Replace entries such as `5mins` with `5m`. Negative intervals and duplicate units are rejected.

### Dependencies and verification

- Updated Playwright to 1.64.1 and Nodemailer to 10.3.1.
- Upgraded ESLint, Jest, Commitlint, lint-staged, and tsup.
- Pull requests run lint, tests, the build, and a local Chromium smoke test on Node.js 24. Scheduled monitoring installs from the lockfile and runs the CLI built from the checkout.
