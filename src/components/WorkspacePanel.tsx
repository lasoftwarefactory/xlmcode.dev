import { useEffect, useRef, useState } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  Navigator,
  useSandpack,
  useActiveCode,
  useSandpackConsole,
  useErrorMessage,
} from '@codesandbox/sandpack-react'
import { FileExplorer } from './FileTree'
import { ContractsPanel } from './ContractsPanel'
import {
  Monitor,
  Smartphone,
  Download,
  History,
  Copy,
  Check,
  SquarePen,
  Eye,
  X,
  Wand2,
  AlertTriangle,
  Mail,
} from 'lucide-react'
import type { FileTree, DeployedContract } from '../../shared/types'
import type { Version } from '../projects/store'
import { SANDPACK_TEMPLATE, TAILWIND_CDN, sandpackTheme } from '../lib/project'
import { downloadProjectZip } from '../lib/export'

type Device = 'desktop' | 'mobile'

/**
 * Syncs user edits from the Sandpack editor back into our file tree (debounced),
 * for files we own — so chat/LLM/export/versions stay consistent. Does NOT touch
 * template default files. Must live inside SandpackProvider.
 */
function SandpackSync({
  fileTree,
  onSync,
}: {
  fileTree: FileTree
  onSync: (files: FileTree) => void
}) {
  const { sandpack } = useSandpack()
  const ftRef = useRef(fileTree)
  // Keep the ref pointing at the latest tree without touching it during render.
  useEffect(() => {
    ftRef.current = fileTree
  }, [fileTree])

  // Baseline = Sandpack's OWN view of the files once loaded. We only report an
  // edit (→ dirty) when the live files deviate from that baseline. This avoids
  // false "unsaved edits" on load / agent changes / restore: each of those
  // remounts SandpackProvider (key=generation), which remounts this component
  // and re-establishes the baseline. Only genuine in-editor typing deviates.
  const baselineRef = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const ft = ftRef.current
      const current: FileTree = {}
      let allLoaded = true
      for (const path of Object.keys(ft)) {
        const code = sandpack.files[path]?.code
        if (code === undefined) {
          allLoaded = false
          current[path] = ft[path]
        } else {
          current[path] = code
        }
      }
      const key = JSON.stringify(current)
      if (baselineRef.current === null) {
        // Establish the baseline once Sandpack has loaded our files.
        if (allLoaded) baselineRef.current = key
        return
      }
      if (key !== baselineRef.current) onSync(current)
    }, 600)
    return () => clearTimeout(t)
  }, [sandpack.files, onSync])

  return null
}

/** Copy + read-only/edit toggle, pinned top-right of the code editor. */
function CodeBar({
  editable,
  setEditable,
}: {
  editable: boolean
  setEditable: (v: boolean) => void
}) {
  const { code } = useActiveCode()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5 border-b border-zinc-800 px-2 py-1.5">
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        title="Copy file"
        className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={() => setEditable(!editable)}
        title={editable ? 'Switch to read-only' : 'Edit file'}
        className={`rounded-md border p-1.5 transition-colors ${
          editable
            ? 'border-violet-500/50 text-violet-300'
            : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
        }`}
      >
        {editable ? <Eye className="h-3.5 w-3.5" /> : <SquarePen className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

const logLine = (d: unknown[] | undefined) =>
  (d ?? []).map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')

/**
 * Surfaces errors: compile errors via useErrorMessage, runtime errors via the
 * console (a thrown render error lands there, not in useErrorMessage).
 */
function ErrorWatcher({ onError }: { onError: (msg: string) => void }) {
  const compileError = useErrorMessage()
  const { logs } = useSandpackConsole({ resetOnPreviewRestart: true })
  useEffect(() => {
    if (compileError) return onError(compileError)
    const errLog = [...logs].reverse().find((l) => l.method === 'error')
    onError(errLog ? logLine(errLog.data) : '')
  }, [compileError, logs, onError])
  return null
}

/** Console output (logs + errors) with copy + clear. Inside SandpackProvider. */
function ConsolePanel() {
  const { logs, reset } = useSandpackConsole({ resetOnPreviewRestart: true })
  const [copied, setCopied] = useState(false)
  const lineOf = logLine
  const copy = () => {
    void navigator.clipboard?.writeText(
      logs.map((l) => `[${l.method}] ${lineOf(l.data)}`).join('\n'),
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-500">
        <span>Console · {logs.length}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy
          </button>
          <button
            onClick={reset}
            className="rounded-md border border-zinc-800 px-2 py-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 select-text overflow-y-auto p-2 font-mono text-[12px]">
        {logs.length === 0 ? (
          <p className="px-1 text-zinc-600">No console output.</p>
        ) : (
          logs.map((l, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap px-1 py-0.5 ${
                l.method === 'error'
                  ? 'text-red-400'
                  : l.method === 'warn'
                    ? 'text-amber-400'
                    : 'text-zinc-300'
              }`}
            >
              {lineOf(l.data)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Dropdown listing local checkpoints; restore sets the project back to one. */
function VersionMenu({
  versions,
  onOpen,
  onRestore,
}: {
  versions: Version[]
  onOpen: (id: string) => void
  onRestore: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<{ id: string; n: number } | null>(null)
  if (versions.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
        title="Version history"
      >
        <History className="h-4 w-4" />
        v{versions.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
            {versions
              .map((v, i) => ({ v, n: i + 1, latest: i === versions.length - 1 }))
              .reverse()
              .map(({ v, n, latest }) => (
                <div
                  key={v.id}
                  className="group rounded-md px-2.5 py-2 hover:bg-zinc-900"
                >
                  <button
                    onClick={() => {
                      onOpen(v.id)
                      setOpen(false)
                    }}
                    className="block w-full text-left"
                    title="Open this version"
                  >
                    <div className="flex items-center gap-2 text-[12.5px] text-zinc-200">
                      <span className="text-zinc-500">v{n}</span>
                      <span className="truncate font-medium">{v.label}</span>
                      {latest && (
                        <span className="ml-auto shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          current
                        </span>
                      )}
                    </div>
                    {v.summary && (
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] text-zinc-500">
                        {v.summary}
                      </p>
                    )}
                  </button>
                  {/* Destructive restore: only for older versions, never at v1 */}
                  {!latest && versions.length > 1 && (
                    <button
                      onClick={() => setConfirm({ id: v.id, n })}
                      className="mt-1.5 rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500 hover:border-red-900 hover:text-red-400"
                    >
                      Restore (discard newer)
                    </button>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
      {confirm && (
        <RestoreConfirm
          n={confirm.n}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            onRestore(confirm.id)
            setConfirm(null)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Destructive-restore guard: user must type "restore" to proceed. */
function RestoreConfirm({
  n,
  onClose,
  onConfirm,
}: {
  n: number
  onClose: () => void
  onConfirm: () => void
}) {
  const [value, setValue] = useState('')
  const ok = value.trim().toLowerCase() === 'restore'
  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-red-300">Restore to v{n}?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
          This reverts the project to v{n} and{' '}
          <span className="text-zinc-200">permanently discards every newer
          version</span>
          . This can't be undone. Type <code className="text-zinc-300">restore</code>{' '}
          to confirm.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ok) onConfirm()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="restore"
          className="mt-4 w-full select-text rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[14px] text-zinc-100 outline-none focus:border-zinc-600"
        />
        <div className="mt-5 flex justify-end gap-2 text-[13px]">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-zinc-400 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ok}
            className="rounded-lg bg-red-500 px-3.5 py-1.5 font-medium text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}

type Tab = 'preview' | 'code' | 'contracts' | 'console'
const TABS: { id: Tab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'console', label: 'Console' },
]

/**
 * Custom preview top bar: the route navigator (back/forward/url) on the left,
 * and reload + device toggle + versions + download on the right — all in one
 * row. Must render inside SandpackProvider (uses the navigation client).
 */
function PreviewBar({
  device,
  setDevice,
  versions,
  onOpenVersion,
  onRestore,
  onDownload,
}: {
  device: Device
  setDevice: (d: Device) => void
  versions: Version[]
  onOpenVersion?: (id: string) => void
  onRestore?: (id: string) => void
  onDownload: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 px-2 py-1.5">
      <Navigator clientId="default" className="min-w-0 flex-1" />
      <div className="flex items-center rounded-md border border-zinc-800 p-0.5">
        <button
          onClick={() => setDevice('desktop')}
          title="Desktop"
          className={`rounded p-1 transition-colors ${device === 'desktop' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setDevice('mobile')}
          title="Mobile"
          className={`rounded p-1 transition-colors ${device === 'mobile' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Smartphone className="h-3.5 w-3.5" />
        </button>
      </div>
      {onRestore && onOpenVersion && (
        <VersionMenu
          versions={versions}
          onOpen={onOpenVersion}
          onRestore={onRestore}
        />
      )}
      <button
        onClick={onDownload}
        title="Download project"
        className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  )
}

/**
 * Right column: live preview + code in one Sandpack instance.
 *
 * - Tailwind is injected via `externalResources` (the only thing that works in
 *   the classic bundler).
 * - The provider remounts (via `key`) when file content changes, so updates are
 *   always reflected.
 * - The `absolute inset-0` wrapper gives the iframe a concrete pixel box.
 */
export function WorkspacePanel({
  fileTree,
  projectName = 'stellar-app',
  versions = [],
  onOpenVersion,
  onRestore,
  generation = 0,
  dirty = false,
  onSyncFiles,
  onDiscard,
  onSave,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onFixError,
  contracts = [],
  onDeployed,
}: {
  fileTree: FileTree
  projectName?: string
  versions?: Version[]
  onOpenVersion?: (id: string) => void
  onRestore?: (id: string) => void
  generation?: number
  dirty?: boolean
  onSyncFiles?: (files: FileTree) => void
  onDiscard?: () => void
  onSave?: () => void
  onCreateFile?: (path: string) => void
  onCreateFolder?: (folderPath: string) => void
  onDeleteEntry?: (path: string) => void
  onFixError?: (text: string) => void
  contracts?: DeployedContract[]
  onDeployed?: (c: DeployedContract) => void
}) {
  const [tab, setTab] = useState<Tab>('preview')
  const [device, setDevice] = useState<Device>('desktop')
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [editable, setEditable] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invited, setInvited] = useState<string[]>([])
  const [linkCopied, setLinkCopied] = useState(false)

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <nav className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2.5 text-[13px]">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                tab === t.id
                  ? 'bg-zinc-900 text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
              {t.id === 'console' && previewError && (
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShareOpen(true)}
          className="rounded-full bg-zinc-50 px-3.5 py-1.5 font-medium text-black transition-colors hover:bg-white"
        >
          Share
        </button>
      </nav>

      <div className="relative min-h-0 flex-1 bg-zinc-950">
        <div className="absolute inset-0">
          <SandpackProvider
            key={generation}
            template={SANDPACK_TEMPLATE}
            files={fileTree}
            theme={sandpackTheme}
            options={{ externalResources: [TAILWIND_CDN] }}
            style={{ height: '100%' }}
          >
            {onSyncFiles && (
              <SandpackSync fileTree={fileTree} onSync={onSyncFiles} />
            )}
            <ErrorWatcher onError={setPreviewError} />
            <div className="flex h-full flex-col">
              <div
                className={
                  tab === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'
                }
              >
                <PreviewBar
                  device={device}
                  setDevice={setDevice}
                  versions={versions}
                  onOpenVersion={onOpenVersion}
                  onRestore={onRestore}
                  onDownload={() => setDownloadOpen(true)}
                />
                <div className="flex min-h-0 flex-1 justify-center bg-zinc-900/30">
                  <div
                    className="h-full"
                    style={{ width: device === 'mobile' ? 390 : '100%' }}
                  >
                    <SandpackPreview
                      showNavigator={false}
                      showOpenInCodeSandbox={false}
                      showRefreshButton={false}
                      style={{ height: '100%' }}
                    />
                  </div>
                </div>
              </div>
              <div
                className={
                  tab === 'code' ? 'flex min-h-0 flex-1 select-text' : 'hidden'
                }
              >
                <FileExplorer
                  fileTree={fileTree}
                  onCreateFile={onCreateFile ?? (() => {})}
                  onCreateFolder={onCreateFolder ?? (() => {})}
                  onDelete={onDeleteEntry ?? (() => {})}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <CodeBar editable={editable} setEditable={setEditable} />
                  <SandpackCodeEditor
                    readOnly={!editable}
                    showLineNumbers
                    showTabs={false}
                    style={{ height: '100%', flex: 1 }}
                  />
                </div>
              </div>
              <div className={tab === 'console' ? 'min-h-0 flex-1' : 'hidden'}>
                <ConsolePanel />
              </div>
            </div>
          </SandpackProvider>
        </div>

        {tab === 'contracts' && (
          <ContractsPanel contracts={contracts} onDeployed={onDeployed ?? (() => {})} />
        )}


        {previewError && (
          <div className="absolute bottom-4 left-1/2 z-30 flex w-[min(92%,560px)] -translate-x-1/2 items-start gap-3 rounded-xl border border-red-900/70 bg-red-950/90 px-3 py-2.5 shadow-2xl">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-red-200">App error</p>
              <p className="mt-0.5 max-h-16 select-text overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] text-red-300/90">
                {previewError}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {onFixError && (
                <button
                  onClick={() => onFixError(previewError)}
                  className="flex items-center gap-1 rounded-md bg-zinc-50 px-2.5 py-1 text-[12px] font-medium text-black transition-colors hover:bg-white"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Fix with AI
                </button>
              )}
              <button
                onClick={() => void navigator.clipboard?.writeText(previewError)}
                className="rounded-md border border-red-900/60 px-2.5 py-1 text-[12px] text-red-200 transition-colors hover:text-red-100"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {!previewError && dirty && (onDiscard || onSave) && (
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-2xl">
            <span className="text-[13px] text-zinc-200">
              You have unsaved edits
            </span>
            {onDiscard && (
              <button
                onClick={onDiscard}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-zinc-400 transition-colors hover:text-zinc-100"
              >
                <X className="h-3.5 w-3.5" />
                Discard
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                className="rounded-md bg-zinc-50 px-3 py-1 text-[12.5px] font-medium text-black transition-colors hover:bg-white"
              >
                Save
              </button>
            )}
          </div>
        )}
      </div>

      {downloadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDownloadOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-medium">Download project</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
              Download <span className="text-zinc-200">{projectName}</span> as a
              complete Vite + React + TypeScript project (.zip) that runs locally
              with <code className="text-zinc-300">pnpm install &amp;&amp; pnpm dev</code>.
            </p>
            <div className="mt-5 flex justify-end gap-2 text-[13px]">
              <button
                onClick={() => setDownloadOpen(false)}
                className="rounded-lg px-3.5 py-1.5 text-zinc-400 hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void downloadProjectZip(projectName, fileTree)
                  setDownloadOpen(false)
                }}
                className="rounded-lg bg-zinc-50 px-3.5 py-1.5 font-medium text-black transition-colors hover:bg-white"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium">Share “{projectName}”</h2>
              <button
                onClick={() => setShareOpen(false)}
                className="rounded p-1 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[13px] text-zinc-400">
              Invite people to collaborate on this project.
            </p>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const v = inviteEmail.trim()
                if (!v) return
                setInvited((p) => Array.from(new Set([...p, v])))
                setInviteEmail('')
              }}
            >
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3">
                <Mail className="h-3.5 w-3.5 text-zinc-500" />
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  placeholder="name@email.com"
                  className="w-full bg-transparent py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-zinc-50 px-3.5 py-2 text-[13px] font-medium text-black transition-colors hover:bg-white"
              >
                Invite
              </button>
            </form>

            <div className="mt-4">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-zinc-600">
                People with access
              </p>
              <div className="flex items-center justify-between rounded-lg px-1 py-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-300">
                    YOU
                  </div>
                  <span className="text-[13px] text-zinc-200">You</span>
                </div>
                <span className="text-[12px] text-zinc-500">Owner</span>
              </div>
              {invited.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between rounded-lg px-1 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                      {email[0]?.toUpperCase()}
                    </div>
                    <span className="truncate text-[13px] text-zinc-200">{email}</span>
                  </div>
                  <span className="shrink-0 text-[12px] text-zinc-500">Invited</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <code className="min-w-0 truncate font-mono text-[12px] text-zinc-400">
                stellarable.app/p/{projectName}
              </code>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    'https://stellarable.app/p/' + projectName,
                  )
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 1200)
                }}
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-zinc-300 hover:text-zinc-50"
              >
                {linkCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {linkCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
