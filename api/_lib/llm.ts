import { generateObject, streamObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { agentResponseSchema, type AgentResponse } from '../../shared/schema'
import { buildSystemPrompt } from './prompt'
import type { ChatMessage, FileTree, Manifest } from '../../shared/types'

const DEFAULT_MODEL = 'gpt-5.4-mini'

interface ChatParams {
  apiKey: string
  fileTree: FileTree
  history: ChatMessage[]
  userMessage: string
  catalog?: Manifest[]
  model?: string
}

/**
 * Streaming variant of the chat core: returns an AI SDK streamObject result.
 * The caller pipes `result.textStream` (the JSON being generated) to the client,
 * which shows live activity ("Editing /App.tsx…") and parses the final object.
 * Same Zod contract as runChat.
 */
export function streamChat(params: ChatParams) {
  const { apiKey, fileTree, history, userMessage } = params
  const model = params.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const openai = createOpenAI({ apiKey })

  return streamObject({
    model: openai(model),
    schema: agentResponseSchema,
    maxRetries: 3,
    maxOutputTokens: 16000,
    system: buildSystemPrompt({ fileTree, catalog: params.catalog ?? [] }),
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ],
  })
}

/**
 * The provider-agnostic core of /api/chat. Kept free of any Vercel/HTTP types
 * so it can be called from the serverless handler AND the local dev middleware.
 *
 * Uses the Vercel AI SDK's `generateObject`: the Zod schema is the contract, and
 * the SDK validates the model output before it reaches us (PLAN.md §5.3).
 */
export async function runChat(params: ChatParams): Promise<AgentResponse> {
  const { apiKey, fileTree, history, userMessage } = params
  const model = params.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const openai = createOpenAI({ apiKey })
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  // Retry on transient structured-output parse failures ("No object generated").
  let lastErr: unknown
  for (let i = 0; i < 3; i++) {
    try {
      const { object } = await generateObject({
        model: openai(model),
        schema: agentResponseSchema,
        maxRetries: 2,
        maxOutputTokens: 16000,
        system: buildSystemPrompt({ fileTree, catalog: params.catalog ?? [] }),
        messages,
      })
      return object
    } catch (err) {
      lastErr = err
      const transient = /No object generated|could not parse|response did not match/i.test(
        String(err),
      )
      if (!transient) throw err
    }
  }
  throw lastErr
}
