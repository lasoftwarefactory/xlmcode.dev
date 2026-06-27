import type { VercelRequest, VercelResponse } from '@vercel/node'
import { streamChat } from './_lib/llm'
import { getSessionKey } from './_lib/session'
import type { ChatRequest } from '../shared/types'

/**
 * POST /api/chat — the heart of the platform.
 *
 * Streams the generated JSON (AI SDK streamObject) so the client can show live
 * activity. BYOK key from the in-memory session, dev fallback to env.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, provider, fileTree, history, userMessage } =
      req.body as ChatRequest

    const apiKey =
      getSessionKey(sessionId, provider) ?? process.env.OPENAI_API_KEY ?? null
    if (!apiKey) {
      return res.status(401).json({ error: 'No API key for this session' })
    }

    const result = streamChat({ apiKey, fileTree, history, userMessage })
    res.status(200).setHeader('content-type', 'text/plain; charset=utf-8')
    for await (const chunk of result.textStream) res.write(chunk)
    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (!res.headersSent) res.status(500).json({ error: message })
    else res.end()
  }
}
