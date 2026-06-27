import { useEffect, useRef } from 'react'
import { Check, FilePlus2, FilePen, Trash2 } from 'lucide-react'
import type { ChatMessage } from '../../shared/types'
import type { Activity } from '../lib/api'
import { PromptInput } from './PromptInput'

/** Left column: conversation history + live activity + prompt box. */
export function ChatPanel({
  messages,
  busy,
  error,
  activity,
  streamingMessage,
  onSend,
}: {
  messages: ChatMessage[]
  busy: boolean
  error: string | null
  activity: Activity[]
  streamingMessage: string
  onSend: (text: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, activity, streamingMessage])

  return (
    <section className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
        {busy && (
          <ThinkingTrace activity={activity} message={streamingMessage} />
        )}
        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-zinc-800 p-4">
        <PromptInput onSend={onSend} busy={busy} />
      </div>
    </section>
  )
}

function Message({ role, content }: ChatMessage) {
  const isUser = role === 'user'
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-100 px-3.5 py-2 text-[13.5px] whitespace-pre-wrap text-black'
            : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3.5 py-2 text-[13.5px] whitespace-pre-wrap text-zinc-200'
        }
      >
        {content}
      </div>
    </div>
  )
}

const VERB: Record<Activity['op'], string> = {
  create: 'Creating',
  edit: 'Editing',
  delete: 'Deleting',
}
const OP_ICON = { create: FilePlus2, edit: FilePen, delete: Trash2 }

/** v0-style live trace: streaming message + a list of files being touched. */
function ThinkingTrace({
  activity,
  message,
}: {
  activity: Activity[]
  message: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {message && (
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3.5 py-2 text-[13.5px] whitespace-pre-wrap text-zinc-200">
          {message}
        </div>
      )}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5">
        {activity.length === 0 ? (
          <div className="flex items-center gap-2 text-[12.5px] text-zinc-500">
            <Spinner />
            Thinking…
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a, i) => {
              const last = i === activity.length - 1
              const Icon = OP_ICON[a.op]
              return (
                <li key={i} className="flex items-center gap-2 text-[12.5px]">
                  {last ? (
                    <Spinner />
                  ) : (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="text-zinc-500">{VERB[a.op]}</span>
                  <code className="truncate text-zinc-300">{a.path}</code>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
  )
}
