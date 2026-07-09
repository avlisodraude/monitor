import nodemailer, { type Transporter } from 'nodemailer'
import type { CheckResult, NotifyConfig } from './types.js'

export type AlertKind = 'down' | 'recovery'

type EmailConfig = NonNullable<NotifyConfig['email']>

function buildMessage(result: CheckResult, kind: AlertKind): string {
  return [
    kind === 'recovery'
      ? `Monitor alert: "${result.name}" has RECOVERED`
      : `Monitor alert: "${result.name}" is DOWN`,
    `URL: ${result.url}`,
    kind === 'down' ? `Error: ${result.error ?? 'unknown'}` : '',
    `Status code: ${result.statusCode ?? 'N/A'}`,
    `Time: ${result.timestamp}`,
    result.screenshotPath
      ? `Screenshot saved: ${result.screenshotPath}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

// Reused across alerts (keyed by config object identity) so we don't pay for
// a fresh SMTP connection on every failure — the config is loaded once and
// reused for the life of the process, so reference equality is enough.
let cachedTransporter: { config: EmailConfig; transporter: Transporter } | null = null

function getTransporter(email: EmailConfig): Transporter {
  if (cachedTransporter && cachedTransporter.config === email) {
    return cachedTransporter.transporter
  }
  const port = email.smtpPort ?? 587
  const transporter = nodemailer.createTransport({
    host: email.smtpHost,
    port,
    // Port 465 is implicit TLS; anything else (587, 25) negotiates via STARTTLS.
    secure: port === 465,
    auth: { user: email.smtpUser, pass: email.smtpPass },
  })
  cachedTransporter = { config: email, transporter }
  return transporter
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
}

export async function notify(
  result: CheckResult,
  config: NotifyConfig,
  kind: AlertKind = 'down'
): Promise<void> {
  const message = buildMessage(result, kind)
  const tasks: { channel: string; promise: Promise<void> }[] = []

  if (config.email) {
    const email = config.email
    tasks.push({
      channel: 'email',
      promise: getTransporter(email)
        .sendMail({
          from: email.from,
          to: email.to,
          subject: kind === 'recovery'
            ? `🟢 Monitor alert: ${result.name} has recovered`
            : `🔴 Monitor alert: ${result.name} is DOWN`,
          text: message,
        })
        .then(() => {}),
    })
  }

  if (config.slack) {
    tasks.push({ channel: 'slack', promise: postJson(config.slack.webhookUrl, { text: message }) })
  }

  if (config.discord) {
    tasks.push({ channel: 'discord', promise: postJson(config.discord.webhookUrl, { content: message }) })
  }

  if (config.webhook) {
    tasks.push({
      channel: 'webhook',
      promise: postJson(config.webhook.url, result, config.webhook.headers),
    })
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.promise))
  settled.forEach((outcome, i) => {
    if (outcome.status === 'rejected') {
      const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
      console.error(`  ⚠ notify(${tasks[i].channel}) for "${result.name}" failed: ${reason}`)
    }
  })
}
