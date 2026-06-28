/* eslint-disable react-refresh/only-export-components --
   Context file: the provider and its hook are intentionally co-located. The
   rule is a dev-only fast-refresh hint and does not affect runtime. */
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ChatMessage, FileTree, DeployedContract } from '../../shared/types'
import {
  sendChat,
  parseActivity,
  parseStreamingMessage,
  type Activity,
} from '../lib/api'
import { applyFileOps, initialFileTree } from '../lib/project'
import { buildContractsFile, CONTRACTS_FILE } from '../lib/contracts'

/**
 * In-memory project store. Lives above the router so project state survives
 * navigation between the landing (/) and the editor (/projects/:slug).
 *
 * Not persisted — a hard refresh loses projects. Supabase persistence is
 * Milestone 5; version history is kept locally here until then.
 */
export interface Version {
  id: string
  /** Short LLM-given name for this version. */
  label: string
  /** Concise summary of the change (the assistant message). */
  summary: string
  fileTree: FileTree
  createdAt: number
}

export interface ProjectState {
  slug: string
  name: string
  messages: ChatMessage[]
  fileTree: FileTree
  busy: boolean
  error: string | null
  /** Live activity during streaming (cosmetic): files being created/edited. */
  activity: Activity[]
  /** Partial assistant message while streaming. */
  streamingMessage: string
  /** Local checkpoint history (newest last). */
  versions: Version[]
  /**
   * Bumped only on canonical changes (LLM apply, restore, discard) — it is the
   * Sandpack remount key. User edits sync into fileTree WITHOUT bumping it, so
   * the editor doesn't reset mid-typing.
   */
  generation: number
  /** The last canonical file tree (to revert manual edits to). */
  savedFileTree: FileTree
  /** True when the user has manual, unsaved edits in the editor. */
  dirty: boolean
  /** Contracts deployed (or connected) for this project. */
  contracts: DeployedContract[]
}

interface ProjectsContextValue {
  /** All projects, newest first — for the sidebar history. */
  projects: ProjectState[]
  getProject: (slug: string) => ProjectState | undefined
  createProject: (prompt: string) => string
  createFromFiles: (
    name: string,
    files: FileTree,
    contracts?: DeployedContract[],
  ) => string
  send: (slug: string, text: string, opts?: { kind?: 'system' }) => void
  /** Load a checkpoint's files non-destructively (keeps all versions). */
  openVersion: (slug: string, versionId: string) => void
  /** Restore to a checkpoint AND discard everything after it (destructive). */
  restoreVersion: (slug: string, versionId: string) => void
  /** Rename a project (display name; reflected in the sidebar). */
  renameProject: (slug: string, name: string) => void
  /** Sync user edits from the editor into the file tree (no remount). */
  syncFiles: (slug: string, files: FileTree) => void
  /** Revert manual edits back to the last canonical file tree. */
  discardEdits: (slug: string) => void
  /** Accept the current edits as the saved baseline (clears the dirty toast). */
  markSaved: (slug: string) => void
  /** Create a file (or folder via a placeholder) at an absolute path. */
  createEntry: (slug: string, path: string, content?: string) => void
  /** Delete a file or a whole folder subtree at an absolute path. */
  deleteEntry: (slug: string, path: string) => void
  /** Record a deployed/connected contract and inject src/contracts.ts. */
  addDeployedContract: (slug: string, contract: DeployedContract) => void
  /** Mark the actions on a message as resolved (hides the action cards). */
  resolveMessageActions: (slug: string, messageIndex: number) => void
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deriveName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ')
  return words.length > 48 ? words.slice(0, 48) : words
}

// Clock/id behind module-scope helpers: keeps render bodies pure (no Date.now /
// crypto.* during render) and makes time/ids trivially mockable in tests.
const now = () => Date.now()
const uid = () => crypto.randomUUID()

const newVersion = (
  label: string,
  summary: string,
  fileTree: FileTree,
): Version => ({
  id: uid().slice(0, 8),
  label,
  summary,
  fileTree,
  createdAt: now(),
})

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const sessionId = useRef(uid()).current
  const ref = useRef<Record<string, ProjectState>>({})
  // `ref` holds the latest map for synchronous async reads; `snapshot` mirrors
  // it for rendering so we never read a ref during render.
  const [snapshot, setSnapshot] = useState<Record<string, ProjectState>>({})

  const commit = (next: Record<string, ProjectState>) => {
    ref.current = next
    setSnapshot(next)
  }

  const patch = (slug: string, partial: Partial<ProjectState>) => {
    const current = ref.current[slug]
    if (!current) return
    commit({ ...ref.current, [slug]: { ...current, ...partial } })
  }

  const send = async (slug: string, text: string, opts?: { kind?: 'system' }) => {
    const p = ref.current[slug]
    if (!p || p.busy) return
    const history = p.messages
    const startedAt = now()
    const userMsg: ChatMessage = { role: 'user', content: text, createdAt: startedAt }
    if (opts?.kind) userMsg.kind = opts.kind
    patch(slug, {
      messages: [...history, userMsg],
      busy: true,
      error: null,
      activity: [],
      streamingMessage: '',
    })
    try {
      const res = await sendChat(
        { sessionId, fileTree: p.fileTree, history, userMessage: text },
        (acc) => {
          patch(slug, {
            activity: parseActivity(acc),
            streamingMessage: parseStreamingMessage(acc),
          })
        },
      )
      const latest = ref.current[slug]
      const nextTree = applyFileOps(latest.fileTree, res.files)
      const ops = res.files.map((f) => ({ op: f.op, path: f.path }))
      const name = res.versionName?.trim() || 'Update'
      // Rough +/- line diff for the "Worked for" summary.
      let added = 0
      let removed = 0
      for (const f of res.files) {
        if (f.op === 'delete') {
          removed += (latest.fileTree[f.path]?.split('\n').length ?? 0)
          continue
        }
        const oldLines = new Set((latest.fileTree[f.path] ?? '').split('\n'))
        const newLines = new Set(f.content.split('\n'))
        for (const l of f.content.split('\n')) if (!oldLines.has(l)) added++
        for (const l of (latest.fileTree[f.path] ?? '').split('\n'))
          if (!newLines.has(l)) removed++
      }
      const changedFiles = res.files.length > 0
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.message,
        files: ops,
        versionName: changedFiles ? name : undefined,
        createdAt: now(),
        stats: {
          durationMs: now() - startedAt,
          filesModified: res.files.length,
          added,
          removed,
        },
        ...(res.actions?.length ? { actions: res.actions } : {}),
      }
      patch(slug, {
        busy: false,
        activity: [],
        streamingMessage: '',
        messages: [...latest.messages, assistantMsg],
        // Only touch files / bump generation / snapshot a version when the turn
        // actually changed files. A plain Q&A leaves the preview untouched.
        ...(changedFiles
          ? {
              fileTree: nextTree,
              savedFileTree: nextTree,
              dirty: false,
              generation: latest.generation + 1,
              versions: [
                ...latest.versions,
                newVersion(name, res.message, nextTree),
              ],
            }
          : {}),
      })
    } catch (err) {
      patch(slug, {
        busy: false,
        activity: [],
        streamingMessage: '',
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }

  const resolveMessageActions = (slug: string, messageIndex: number) => {
    const p = ref.current[slug]
    if (!p) return
    const messages = p.messages.map((m, i) =>
      i === messageIndex ? { ...m, actionsDone: true } : m,
    )
    patch(slug, { messages })
  }

  const make = (
    slug: string,
    name: string,
    fileTree: FileTree,
    messages: ChatMessage[],
    versions: Version[],
    contracts: DeployedContract[] = [],
  ) => {
    commit({
      ...ref.current,
      [slug]: {
        slug,
        name,
        messages,
        fileTree,
        busy: false,
        error: null,
        activity: [],
        streamingMessage: '',
        versions,
        generation: 1,
        savedFileTree: fileTree,
        dirty: false,
        contracts,
      },
    })
  }

  const createProject = (prompt: string): string => {
    const slug = `${kebab(deriveName(prompt)) || 'project'}-${uid().slice(0, 6)}`
    make(slug, deriveName(prompt), initialFileTree(), [], [])
    void send(slug, prompt)
    return slug
  }

  const createFromFiles = (
    name: string,
    files: FileTree,
    contracts: DeployedContract[] = [],
  ): string => {
    const slug = `${kebab(name) || 'project'}-${uid().slice(0, 6)}`
    make(
      slug,
      name,
      files,
      [{ role: 'assistant', content: `Loaded "${name}".` }],
      [newVersion('Initial template', `Loaded "${name}".`, files)],
      contracts,
    )
    return slug
  }

  /** Non-destructive: load a checkpoint's files but keep every version. */
  const openVersion = (slug: string, versionId: string) => {
    const p = ref.current[slug]
    if (!p) return
    const v = p.versions.find((x) => x.id === versionId)
    if (!v) return
    patch(slug, {
      fileTree: v.fileTree,
      savedFileTree: v.fileTree,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  const restoreVersion = (slug: string, versionId: string) => {
    const p = ref.current[slug]
    if (!p) return
    const idx = p.versions.findIndex((x) => x.id === versionId)
    if (idx === -1) return
    const v = p.versions[idx]
    patch(slug, {
      fileTree: v.fileTree,
      savedFileTree: v.fileTree,
      dirty: false,
      // Destructive: drop every version after this one.
      versions: p.versions.slice(0, idx + 1),
      generation: p.generation + 1,
      messages: [
        ...p.messages,
        { role: 'assistant', content: `Restored "${v.label}".` },
      ],
    })
  }

  /** User edited files in the editor — update the tree without remounting. */
  const syncFiles = (slug: string, files: FileTree) => {
    const p = ref.current[slug]
    if (!p) return
    // dirty = differs from the saved baseline (robust against late syncs after
    // a discard, which would otherwise re-mark the project dirty).
    const dirty =
      JSON.stringify(files) !== JSON.stringify(p.savedFileTree)
    patch(slug, { fileTree: files, dirty })
  }

  /** Revert manual edits to the last canonical tree (remounts Sandpack). */
  const discardEdits = (slug: string) => {
    const p = ref.current[slug]
    if (!p) return
    patch(slug, {
      fileTree: p.savedFileTree,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  /** Accept current edits as the new saved baseline (no remount, clears dirty). */
  const markSaved = (slug: string) => {
    const p = ref.current[slug]
    if (!p) return
    patch(slug, { savedFileTree: p.fileTree, dirty: false })
  }

  /** Create a file/folder; structural change → bump generation (remount). */
  const createEntry = (slug: string, path: string, content = '') => {
    const p = ref.current[slug]
    if (!p || p.fileTree[path] !== undefined) return
    const next = { ...p.fileTree, [path]: content }
    patch(slug, {
      fileTree: next,
      savedFileTree: next,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  /** Delete a file or an entire folder subtree. */
  const deleteEntry = (slug: string, path: string) => {
    const p = ref.current[slug]
    if (!p) return
    const prefix = `${path}/`
    const next: FileTree = {}
    for (const [k, v] of Object.entries(p.fileTree)) {
      if (k === path || k.startsWith(prefix)) continue
      next[k] = v
    }
    patch(slug, {
      fileTree: next,
      savedFileTree: next,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  /** Record a deployed contract and (re)generate src/contracts.ts in the app. */
  const addDeployedContract = (slug: string, contract: DeployedContract) => {
    const p = ref.current[slug]
    if (!p) return
    const contracts = [...p.contracts, contract]
    const next = {
      ...p.fileTree,
      [CONTRACTS_FILE]: buildContractsFile(contracts),
    }
    patch(slug, {
      contracts,
      fileTree: next,
      savedFileTree: next,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  const renameProject = (slug: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed) patch(slug, { name: trimmed })
  }

  const value: ProjectsContextValue = {
    projects: Object.values(snapshot).reverse(),
    getProject: (slug) => ref.current[slug],
    createProject,
    createFromFiles,
    send: (slug, text, opts) => void send(slug, text, opts),
    openVersion,
    restoreVersion,
    renameProject,
    syncFiles,
    discardEdits,
    markSaved,
    createEntry,
    deleteEntry,
    addDeployedContract,
    resolveMessageActions,
  }

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
