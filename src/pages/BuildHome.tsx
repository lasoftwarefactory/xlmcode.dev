import { useNavigate } from 'react-router-dom'
import { useProjects } from '../projects/store'
import { PromptInput } from '../components/PromptInput'
import { EXAMPLE_APPS } from '../lib/project'

/** Route "/app" — the build home inside the authed shell. */
export function BuildHome() {
  const navigate = useNavigate()
  const { createProject, createFromFiles } = useProjects()

  const startWithPrompt = (text: string) => {
    navigate(`/projects/${createProject(text)}`)
  }
  const startExample = (ex: (typeof EXAMPLE_APPS)[number]) => {
    navigate(
      ex.files
        ? `/projects/${createFromFiles(ex.label, ex.files, ex.contracts)}`
        : `/projects/${createProject(ex.prompt!)}`,
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-2xl -translate-y-8">
        <h1 className="mb-8 text-center text-3xl font-medium tracking-tight sm:text-4xl">
          What do you want to build?
        </h1>
        <PromptInput
          onSend={startWithPrompt}
          busy={false}
          autoFocus
          placeholder="Describe a Stellar app in plain language…"
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLE_APPS.map((ex) => (
            <button
              key={ex.label}
              onClick={() => startExample(ex)}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-[12.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
