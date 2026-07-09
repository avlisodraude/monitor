import { chromium, type Browser } from 'playwright'

// Shared across all checks in a `run()` or `watch()` invocation — launching a
// browser is expensive, but contexts (created per check in runner.ts) are cheap
// and give the same isolation.
let browserPromise: Promise<Browser> | null = null

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = chromium.launch()
  return browserPromise
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const promise = browserPromise
  browserPromise = null
  const browser = await promise
  await browser.close()
}
