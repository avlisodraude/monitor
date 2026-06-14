import { pathToFileURL } from 'url'
import path from 'path'
import fs from 'fs'
import { run } from './index.js'
import type { MonitorConfig } from './types.js'

const [, , command = 'run'] = process.argv

const CONFIG_FILES = [
  'monitor.config.ts',
  'monitor.config.js',
  'monitor.config.mjs',
]

async function loadConfig(): Promise<MonitorConfig> {
  for (const file of CONFIG_FILES) {
    const fullPath = path.resolve(process.cwd(), file)
    if (fs.existsSync(fullPath)) {
      const mod = await import(pathToFileURL(fullPath).href)
      return mod.default ?? mod
    }
  }
  throw new Error(
    `No config file found. Create a monitor.config.ts (or .js) in your project root.\n\nExample:\n\nexport default {\n  checks: [{ name: 'Homepage', url: 'https://example.com' }]\n}\n`
  )
}

async function main() {
  if (command === 'run') {
    console.log('🔍 @alosha/monitor — loading config...')
    const config = await loadConfig()
    console.log(`  Running ${config.checks.length} check(s)...\n`)

    const report = await run(config)

    for (const result of report.results) {
      const icon = result.status === 'ok' ? '✓' : '✗'
      const label = result.status === 'ok' ? 'OK' : 'FAIL'
      console.log(`  ${icon} [${label}] ${result.name} — ${result.durationMs}ms`)
      if (result.error) console.log(`       Error: ${result.error}`)
      if (result.screenshotPath) console.log(`       Screenshot: ${result.screenshotPath}`)
    }

    console.log(`\n  Passed: ${report.passed}  Failed: ${report.failed}`)
    console.log(`  Report: ./monitor-report.html`)

    if (report.failed > 0) process.exit(1)
  } else {
    console.log(`Unknown command: ${command}`)
    console.log('Usage: monitor run')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
