import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ChatMessage, FileTree } from '../../shared/types'
import {
  sendChat,
  parseActivity,
  parseStreamingMessage,
  type Activity,
} from '../lib/api'
import { applyFileOps, initialFileTree } from '../lib/project'

/**
 * In-memory project store. Lives above the router so project state survives
 * navigation between the landing (/) and the editor (/projects/:slug).
 *
 * Not persisted — a hard refresh loses projects. Supabase persistence is
 * Milestone 5; version history is kept locally here until then.
 */
export interface Version {
  id: string
  label: string
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
}

interface ProjectsContextValue {
  /** All projects, newest first — for the sidebar history. */
  projects: ProjectState[]
  getProject: (slug: string) => ProjectState | undefined
  createProject: (prompt: string) => string
  createFromFiles: (name: string, files: FileTree) => string
  send: (slug: string, text: string) => void
  /** Restore a project's files to a previous checkpoint. */
  restoreVersion: (slug: string, versionId: string) => void
  /** Rename a project (display name; reflected in the sidebar). */
  renameProject: (slug: string, name: string) => void
  /** Sync user edits from the editor into the file tree (no remount). */
  syncFiles: (slug: string, files: FileTree) => void
  /** Revert manual edits back to the last canonical file tree. */
  discardEdits: (slug: string) => void
  /** Accept the current edits as the saved baseline (clears the dirty toast). */
  markSaved: (slug: string) => void
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

const newVersion = (label: string, fileTree: FileTree): Version => ({
  id: crypto.randomUUID().slice(0, 8),
  label,
  fileTree,
  createdAt: Date.now(),
})

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const sessionId = useRef(crypto.randomUUID()).current
  const [, force] = useState(0)
  const ref = useRef<Record<string, ProjectState>>({})

  const commit = (next: Record<string, ProjectState>) => {
    ref.current = next
    force((n) => n + 1)
  }

  const patch = (slug: string, partial: Partial<ProjectState>) => {
    const current = ref.current[slug]
    if (!current) return
    commit({ ...ref.current, [slug]: { ...current, ...partial } })
  }

  const send = async (slug: string, text: string) => {
    const p = ref.current[slug]
    if (!p || p.busy) return
    const history = p.messages
    patch(slug, {
      messages: [...history, { role: 'user', content: text }],
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
      patch(slug, {
        fileTree: nextTree,
        savedFileTree: nextTree,
        dirty: false,
        generation: latest.generation + 1,
        messages: [
          ...latest.messages,
          { role: 'assistant', content: res.message },
        ],
        busy: false,
        activity: [],
        streamingMessage: '',
        versions: [...latest.versions, newVersion(text, nextTree)],
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

  const make = (
    slug: string,
    name: string,
    fileTree: FileTree,
    messages: ChatMessage[],
    versions: Version[],
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
      },
    })
  }

  const createProject = (prompt: string): string => {
    const slug = `${kebab(deriveName(prompt)) || 'project'}-${crypto.randomUUID().slice(0, 6)}`
    make(slug, deriveName(prompt), initialFileTree(), [], [])
    void send(slug, prompt)
    return slug
  }

  const createFromFiles = (name: string, files: FileTree): string => {
    const slug = `${kebab(name) || 'project'}-${crypto.randomUUID().slice(0, 6)}`
    make(
      slug,
      name,
      files,
      [{ role: 'assistant', content: `Loaded "${name}".` }],
      [newVersion('Initial template', files)],
    )
    return slug
  }

  const restoreVersion = (slug: string, versionId: string) => {
    const p = ref.current[slug]
    if (!p) return
    const v = p.versions.find((x) => x.id === versionId)
    if (!v) return
    patch(slug, {
      fileTree: v.fileTree,
      savedFileTree: v.fileTree,
      dirty: false,
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

  const renameProject = (slug: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed) patch(slug, { name: trimmed })
  }

  const value: ProjectsContextValue = {
    projects: Object.values(ref.current).reverse(),
    getProject: (slug) => ref.current[slug],
    createProject,
    createFromFiles,
    send: (slug, text) => void send(slug, text),
    restoreVersion,
    renameProject,
    syncFiles,
    discardEdits,
    markSaved,
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
