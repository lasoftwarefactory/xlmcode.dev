import type { VercelRequest, VercelResponse } from '@vercel/node'
import { streamChat } from './_lib/llm'
import { getSessionKey } from './_lib/session'
import { listManifests } from './_lib/contracts'
import { checkGuardrail, refusalMessage } from './_lib/guardrail'
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

    const model = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini'
    res.status(200).setHeader('content-type', 'text/plain; charset=utf-8')

    // Guardrail (defense-in-depth): block off-topic / injection / unsafe input
    // before the generation model ever sees it.
    const gate = await checkGuardrail({
      apiKey,
      model,
      userMessage,
      ongoing: (history?.length ?? 0) > 0,
    })
    if (!gate.allowed) {
      res.write(
        JSON.stringify({
          message: gate.refusal || refusalMessage(gate.category),
          versionName: 'Blocked',
          files: [],
          actions: [],
        }),
      )
      return res.end()
    }

    const catalog = await listManifests()
    const result = streamChat({ apiKey, fileTree, history, userMessage, catalog })
    for await (const chunk of result.textStream) res.write(chunk)
    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (!res.headersSent) res.status(500).json({ error: message })
    else res.end()
  }
}
