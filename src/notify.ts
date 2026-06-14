import nodemailer from 'nodemailer'
import type { CheckResult, NotifyConfig } from './types.js'

function buildMessage(result: CheckResult): string {
  return [
    `Monitor alert: "${result.name}" is DOWN`,
    `URL: ${result.url}`,
    `Error: ${result.error ?? 'unknown'}`,
    `Status code: ${result.statusCode ?? 'N/A'}`,
    `Time: ${result.timestamp}`,
    result.screenshotPath
      ? `Screenshot saved: ${result.screenshotPath}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function notify(
  result: CheckResult,
  config: NotifyConfig
): Promise<void> {
  const message = buildMessage(result)
  const promises: Promise<void>[] = []

  // Email
  if (config.email) {
    const { to, from, smtpHost, smtpPort = 587, smtpUser, smtpPass } = config.email
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: { user: smtpUser, pass: smtpPass },
    })
    promises.push(
      transporter
        .sendMail({
          from,
          to,
          subject: `🔴 Monitor alert: ${result.name} is DOWN`,
          text: message,
        })
        .then(() => {})
    )
  }

  // Slack
  if (config.slack) {
    promises.push(
      fetch(config.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      }).then(() => {})
    )
  }

  // Discord
  if (config.discord) {
    promises.push(
      fetch(config.discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      }).then(() => {})
    )
  }

  // Generic webhook
  if (config.webhook) {
    promises.push(
      fetch(config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.webhook.headers,
        },
        body: JSON.stringify(result),
      }).then(() => {})
    )
  }

  await Promise.allSettled(promises)
}
