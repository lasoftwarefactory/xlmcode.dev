/**
 * Tiny Resend mailer. Reads RESEND_API_KEY + EMAIL_FROM from the environment
 * (loaded from .env.local by server/env.ts). If no key is set, it no-ops with a
 * warning so local dev never crashes on a missing key.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'XLM Code <noreply@xlmcode.dev>'

export interface SendResult {
  ok: boolean
  id?: string
  error?: string
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping send to', to)
    return { ok: false, error: 'email not configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      return { ok: false, error: body.message ?? `Resend error ${res.status}` }
    }
    const data = (await res.json()) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' }
  }
}
