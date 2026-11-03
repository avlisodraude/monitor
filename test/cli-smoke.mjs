import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const cwd = await mkdtemp(join(tmpdir(), 'monitor-smoke-'))
const server = createServer((req, res) => {
  res.writeHead(req.url === '/down' ? 503 : 200, { 'Content-Type': 'text/html' })
  res.end('<title>Monitor smoke test</title>')
})
const configPath = join(cwd, 'monitor.config.mjs')
const reportPath = join(cwd, 'monitor-report.html')
const runCli = (command, env = process.env) =>
  promisify(execFile)(process.execPath, [cli, command], { cwd, env, timeout: 30_000 })
const writeConfig = (config) => writeFile(configPath, `export default ${JSON.stringify(config)}`)

try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}`
  const check = { name: 'Local check', url, retries: 0, screenshotOnFailure: false }

  await writeConfig({ checks: [{ ...check, assertions: [{ type: 'title', contains: 'Monitor smoke test' }] }] })
  assert.match((await runCli('run')).stdout, /Passed: 1\s+Failed: 0/)
  assert.match(await readFile(reportPath, 'utf8'), /Local check/)

  await writeConfig({ checks: [{ ...check, url: `${url}/down` }] })
  await assert.rejects(runCli('run'), { code: 1, stdout: /Passed: 0\s+Failed: 1/ })
  assert.match(await readFile(reportPath, 'utf8'), /HTTP 503/)

  await writeConfig({ checks: [check, { ...check, name: 'Invalid check', interval: '-5m' }] })
  const noBrowser = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(cwd, 'missing-browsers') }
  for (const command of ['run', 'watch']) {
    await assert.rejects(runCli(command, noBrowser), { code: 1, stderr: /checks\[1\]\.interval: Invalid interval/ })
  }
} finally {
  server.close()
  await rm(cwd, { recursive: true, force: true })
}

console.log('CLI smoke test passed')
