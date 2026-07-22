export async function reportOperationalError(
  webhookUrl: string | undefined,
  event: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ level: 'error', event, message, ...context }))
  await sendMonitoring(webhookUrl, { level: 'error', event, message, context })
}

export async function reportOperationalEvent(
  webhookUrl: string | undefined,
  event: string,
  context: Record<string, unknown> = {},
) {
  console.info(JSON.stringify({ level: 'info', event, ...context }))
  await sendMonitoring(webhookUrl, { level: 'info', event, context })
}

async function sendMonitoring(webhookUrl: string | undefined, payload: Record<string, unknown>) {
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, occurredAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    })
  } catch (monitoringError) {
    console.error('Monitoring delivery failed', monitoringError)
  }
}
