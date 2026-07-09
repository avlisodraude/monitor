import { jest } from '@jest/globals'
import { notify } from '../src/notify.js'
import type { CheckResult, NotifyConfig } from '../src/types.js'

// notify() talks to the network directly (global fetch for slack/discord/
// webhook, nodemailer for email) with no injectable transport. Rather than
// refactor the source to add one, we stub the one seam that already exists
// at the platform boundary — global.fetch — so no real HTTP call is ever
// made. Email is intentionally left untouched by these tests (it goes
// through nodemailer, a separate transport, and isn't in scope here); every
// config below omits `email` so getTransporter()/sendMail() is never hit.

function fakeFetch() {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return { ok: true, status: 200, statusText: 'OK' } as Response
  })
  return { fn, calls }
}

const downResult: CheckResult = {
  name: 'Homepage',
  url: 'https://example.com',
  status: 'fail',
  statusCode: 500,
  durationMs: 1234,
  error: 'Timed out waiting for selector',
  timestamp: '2026-07-09T12:00:00.000Z',
  attempt: 3,
}

const recoveredResult: CheckResult = {
  name: 'Homepage',
  url: 'https://example.com',
  status: 'ok',
  statusCode: 200,
  durationMs: 456,
  timestamp: '2026-07-09T12:05:00.000Z',
  attempt: 1,
}

describe('notify — slack payload', () => {
  const config: NotifyConfig = { slack: { webhookUrl: 'https://hooks.slack.example/T000/B000/xxx' } }

  test('down alert posts { text } containing the failure message', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(downResult, config, 'down')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(calls[0].url).toBe(config.slack!.webhookUrl)
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.headers).toMatchObject({ 'Content-Type': 'application/json' })

    const body = JSON.parse(calls[0].init.body as string)
    expect(Object.keys(body)).toEqual(['text'])
    expect(body.text).toContain('Monitor alert: "Homepage" is DOWN')
    expect(body.text).toContain('URL: https://example.com')
    expect(body.text).toContain('Error: Timed out waiting for selector')
    expect(body.text).toContain('Status code: 500')
  })

  test('recovery alert posts { text } containing the recovery message, no Error line', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(recoveredResult, config, 'recovery')

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.text).toContain('Monitor alert: "Homepage" has RECOVERED')
    expect(body.text).not.toContain('Error:')
    expect(body.text).toContain('Status code: 200')
  })
})

describe('notify — discord payload', () => {
  const config: NotifyConfig = { discord: { webhookUrl: 'https://discord.example/api/webhooks/xxx' } }

  test('down alert posts { content } (not { text })', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(downResult, config, 'down')

    const body = JSON.parse(calls[0].init.body as string)
    expect(Object.keys(body)).toEqual(['content'])
    expect(body.content).toContain('Monitor alert: "Homepage" is DOWN')
  })

  test('recovery alert posts { content } with the recovery message', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(recoveredResult, config, 'recovery')

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.content).toContain('has RECOVERED')
  })
})

describe('notify — generic webhook payload', () => {
  const config: NotifyConfig = {
    webhook: { url: 'https://example.com/hook', headers: { 'X-Api-Key': 'secret' } },
  }

  test('posts the raw CheckResult as JSON, not the formatted message', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(downResult, config, 'down')

    expect(calls[0].url).toBe(config.webhook!.url)
    const body = JSON.parse(calls[0].init.body as string)
    expect(body).toEqual(downResult)
  })

  test('merges custom headers alongside Content-Type', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(downResult, config, 'down')

    expect(calls[0].init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Api-Key': 'secret',
    })
  })

  test('recovery result is posted as-is, including its ok status', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    await notify(recoveredResult, config, 'recovery')

    const body = JSON.parse(calls[0].init.body as string)
    expect(body).toEqual(recoveredResult)
  })
})

describe('notify — multiple channels fire independently', () => {
  test('fans a single alert out to slack, discord, and webhook in one call', async () => {
    const { fn, calls } = fakeFetch()
    global.fetch = fn as unknown as typeof fetch

    const config: NotifyConfig = {
      slack: { webhookUrl: 'https://hooks.slack.example/x' },
      discord: { webhookUrl: 'https://discord.example/x' },
      webhook: { url: 'https://example.com/hook' },
    }
    await notify(downResult, config, 'down')

    expect(fn).toHaveBeenCalledTimes(3)
    const urls = calls.map((c) => c.url).sort()
    expect(urls).toEqual(['https://discord.example/x', 'https://example.com/hook', 'https://hooks.slack.example/x'].sort())
  })

  test('one channel failing does not stop the others (Promise.allSettled)', async () => {
    const calls: { url: string }[] = []
    global.fetch = jest.fn(async (url: string) => {
      calls.push({ url })
      if (url.includes('slack')) return { ok: false, status: 500, statusText: 'Internal Server Error' } as Response
      return { ok: true, status: 200, statusText: 'OK' } as Response
    }) as unknown as typeof fetch

    const config: NotifyConfig = {
      slack: { webhookUrl: 'https://hooks.slack.example/x' },
      discord: { webhookUrl: 'https://discord.example/x' },
    }

    await expect(notify(downResult, config, 'down')).resolves.toBeUndefined()
    expect(calls).toHaveLength(2)
  })
})
