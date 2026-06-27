import type { SandpackTheme } from '@codesandbox/sandpack-react'
import type { FileOp, FileTree } from '../../shared/types'

/**
 * The user's generated app lives as an in-memory FileTree. Sandpack (classic
 * `react-ts` template) renders it. Tailwind is injected via the Sandpack
 * `externalResources` option (NOT an index.html <script>, which the classic
 * bundler does not execute). We do NOT override the template's index.html.
 */
export const SANDPACK_TEMPLATE = 'react-ts' as const
export const TAILWIND_CDN = 'https://cdn.tailwindcss.com'

/**
 * Dark Sandpack theme matching the platform (zinc + Geist). Safe to use now that
 * the loading overlay hides correctly (the stuck black overlay was a StrictMode
 * bug, not the theme). The generated app renders its own (usually light) UI in
 * the preview; this theme only styles the code editor + Sandpack chrome.
 */
export const sandpackTheme: SandpackTheme = {
  colors: {
    surface1: '#09090b',
    surface2: '#18181b',
    surface3: '#27272a',
    clickable: '#a1a1aa',
    base: '#e4e4e7',
    disabled: '#52525b',
    hover: '#fafafa',
    accent: '#c084fc',
    error: '#f87171',
    errorSurface: '#27272a',
  },
  syntax: {
    plain: '#e4e4e7',
    comment: { color: '#52525b', fontStyle: 'italic' },
    keyword: '#c084fc',
    tag: '#7dd3fc',
    punctuation: '#a1a1aa',
    definition: '#fafafa',
    property: '#7dd3fc',
    static: '#fca5a5',
    string: '#86efac',
  },
  font: {
    body: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", ui-monospace, monospace',
    size: '13px',
    lineHeight: '20px',
  },
}

const STARTER_APP = `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-400">
      <p className="text-sm">Your app will appear here. Describe it in the chat.</p>
    </div>
  )
}
`

// Cosmetic project files so the generated app reads like a real create-vite
// project (and is ejectable). The Sandpack classic bundler runs from /App.tsx;
// these don't change how it runs, only how the project looks in the Code tab.
const PACKAGE_JSON = `{
  "name": "stellar-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~6.0.0",
    "vite": "^8.0.0"
  }
}
`

const README = `# Stellar App

Built with Stellable — React + TypeScript + TailwindCSS, ready to talk to
Stellar smart contracts.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`

/** Files present in every project regardless of content. */
const BASE_FILES: FileTree = {
  '/package.json': PACKAGE_JSON,
  '/README.md': README,
}

/** Merge the base project files under a set of app files. */
export function withBaseFiles(files: FileTree): FileTree {
  return { ...BASE_FILES, ...files }
}

/** The blank canvas every new project starts from. */
export function initialFileTree(): FileTree {
  return withBaseFiles({ '/App.tsx': STARTER_APP })
}

/** Apply the LLM's file operations to the tree (PLAN.md §5.4). Pure. */
export function applyFileOps(tree: FileTree, ops: FileOp[]): FileTree {
  const next = { ...tree }
  for (const op of ops) {
    if (op.op === 'create' || op.op === 'edit') next[op.path] = op.content
    else if (op.op === 'delete') delete next[op.path]
  }
  return next
}

// --- Static example apps (no LLM): clicking a starter loads these instantly. ---

const HERO_LANDING = `export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">Acme</span>
        <nav className="hidden gap-6 text-sm text-slate-600 sm:flex">
          <a href="#" className="hover:text-slate-900">Features</a>
          <a href="#" className="hover:text-slate-900">Pricing</a>
          <a href="#" className="hover:text-slate-900">About</a>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Now on Stellar testnet
        </span>
        <h1 className="mt-6 text-5xl font-bold tracking-tight">
          Build something people love
        </h1>
        <p className="mt-6 text-lg text-slate-600">
          The fastest way to launch your idea on Stellar. Ship in minutes, not months.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-800">
            Get started
          </button>
          <button className="rounded-lg border border-slate-300 px-6 py-3 font-medium transition hover:bg-slate-50">
            Learn more
          </button>
        </div>
      </main>
    </div>
  )
}
`

const TODO_APP = `import { useState } from 'react'

export default function App() {
  const [items, setItems] = useState<string[]>(['Learn Stellar', 'Ship a dApp'])
  const [text, setText] = useState('')

  const add = () => {
    if (!text.trim()) return
    setItems([...items, text.trim()])
    setText('')
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Todo List</h1>
        <div className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add a task"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          <button onClick={add} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">
            Add
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{it}</span>
              <button
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-sm text-slate-400 hover:text-red-500"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
`

export interface ExampleApp {
  label: string
  files: FileTree
}

export const EXAMPLE_APPS: ExampleApp[] = [
  {
    label: 'A landing page with a hero and a call-to-action button',
    files: withBaseFiles({ '/App.tsx': HERO_LANDING }),
  },
  {
    label: 'A todo list with add and delete',
    files: withBaseFiles({ '/App.tsx': TODO_APP }),
  },
]
