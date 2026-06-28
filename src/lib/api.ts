import type { AgentResponse, ChatMessage, FileTree } from '../../shared/types'

/**
 * Calls POST /api/chat and consumes the streamed JSON (AI SDK streamObject).
 * Invokes `onProgress` with the accumulated text on every chunk so the UI can
 * show live activity, then parses and returns the final AgentResponse.
 */
export async function sendChat(
  params: {
    sessionId: string
    fileTree: FileTree
    history: ChatMessage[]
    userMessage: string
  },
  onProgress?: (accumulatedText: string) => void,
): Promise<AgentResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', projectId: 'dev', ...params }),
  })

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    onProgress?.(text)
  }

  return parseFirstJsonObject(text) as AgentResponse
}

/**
 * Parse the first complete, balanced JSON object from `text`, ignoring anything
 * before the first `{` or after the matching `}`. The model occasionally appends
 * stray text after the JSON ("Unexpected non-whitespace character after JSON"),
 * so a plain JSON.parse(text) would throw — this is tolerant of that.
 */
function parseFirstJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  if (start < 0) throw new Error('No JSON object in response')
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      return JSON.parse(text.slice(start, i + 1))
    }
  }
  // Unbalanced (e.g. truncated) — let JSON.parse surface a clear error.
  return JSON.parse(text.slice(start))
}

/** Live activity derived from the partial JSON stream (cosmetic). */
export interface Activity {
  op: 'create' | 'edit' | 'delete'
  path: string
}

/** Extract file ops seen so far from the partial JSON text. */
export function parseActivity(text: string): Activity[] {
  const ops = [...text.matchAll(/"op"\s*:\s*"(create|edit|delete)"/g)].map(
    (m) => m[1] as Activity['op'],
  )
  const paths = [...text.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
  return paths.map((path, i) => ({ op: ops[i] ?? 'edit', path }))
}

/** Extract the (possibly partial) chat message from the streaming JSON. */
export function parseStreamingMessage(text: string): string {
  const key = text.indexOf('"message"')
  if (key < 0) return ''
  const colon = text.indexOf(':', key)
  const start = text.indexOf('"', colon + 1)
  if (start < 0) return ''
  let out = ''
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (c === '\\') {
      const next = text[i + 1]
      out += next === 'n' ? '\n' : (next ?? '')
      i++
      continue
    }
    if (c === '"') break
    out += c
  }
  return out
}
