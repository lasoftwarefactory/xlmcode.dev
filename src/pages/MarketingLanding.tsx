import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../auth/store'
import { useProjects } from '../projects/store'
import { PromptInput } from '../components/PromptInput'
import { EXAMPLE_APPS } from '../lib/project'

const NAV_LINKS = ['Templates', 'Showcase', 'Pricing', 'Docs', 'FAQ']

/** Public, sellable v0-style marketing landing. Sign in / prompting "logs in". */
export function MarketingLanding() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { createProject, createFromFiles } = useProjects()

  const enter = () => {
    login()
    navigate('/app')
  }

  const startWithPrompt = (text: string) => {
    login()
    navigate(`/projects/${createProject(text)}`)
  }
  const startExample = (ex: (typeof EXAMPLE_APPS)[number]) => {
    login()
    navigate(
      ex.files
        ? `/projects/${createFromFiles(ex.label, ex.files, ex.contracts)}`
        : `/projects/${createProject(ex.prompt!)}`,
    )
  }

  return (
    <div className="flex h-full select-none flex-col overflow-y-auto bg-black text-zinc-50">
      {/* Top nav */}
      <header className="flex h-16 shrink-0 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <span className="text-[17px] font-semibold tracking-tight">
            Stellarable
          </span>
        </div>
        <nav className="hidden items-center gap-7 text-[13.5px] text-zinc-400 md:flex">
          {NAV_LINKS.map((l) => (
            <button key={l} onClick={enter} className="hover:text-zinc-100">
              {l}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-[13.5px]">
          <button
            onClick={enter}
            className="rounded-lg px-3.5 py-1.5 text-zinc-300 hover:text-zinc-50"
          >
            Sign In
          </button>
          <button
            onClick={enter}
            className="rounded-lg bg-zinc-50 px-3.5 py-1.5 font-medium text-black transition-colors hover:bg-white"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
        <div className="w-full max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-[12.5px] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            The fastest way to build on Stellar
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            What do you want to build?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Describe a Stellar app in plain language. Stellarable generates the
            frontend, deploys audited smart contracts to testnet, and wires them
            together — no Rust, no setup.
          </p>

          <div className="mt-8 text-left">
            <PromptInput
              onSend={startWithPrompt}
              busy={false}
              autoFocus
              placeholder="Ask Stellarable to build a token, an NFT gallery, a DEX UI…"
            />
          </div>

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

          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[12.5px] text-zinc-600">
            <span>⚡ Live preview</span>
            <span>🔗 Deploy contracts to testnet</span>
            <span>📦 Export a real Vite project</span>
          </div>
        </div>
      </main>
    </div>
  )
}
