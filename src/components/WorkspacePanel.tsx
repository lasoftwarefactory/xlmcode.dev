import { useEffect, useRef, useState } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
  Navigator,
  useSandpack,
  useActiveCode,
} from '@codesandbox/sandpack-react'
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
} from 'lucide-react'
import type { FileTree } from '../../shared/types'
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
  ftRef.current = fileTree

  // Sandpack normalizes line endings / trailing newline, so compare normalized
  // content — otherwise the round-trip looks "edited" on load and after discard.
  const norm = (s: string) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '')

  useEffect(() => {
    const t = setTimeout(() => {
      const ft = ftRef.current
      const next: FileTree = {}
      let changed = false
      for (const path of Object.keys(ft)) {
        const code = sandpack.files[path]?.code
        if (code !== undefined) {
          next[path] = code
          if (norm(code) !== norm(ft[path])) changed = true
        } else {
          next[path] = ft[path]
        }
      }
      if (changed) onSync(next)
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

/** Dropdown listing local checkpoints; restore sets the project back to one. */
function VersionMenu({
  versions,
  onRestore,
}: {
  versions: Version[]
  onRestore: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
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
          <div className="absolute right-0 z-50 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
            {versions
              .map((v, i) => ({ v, n: i + 1 }))
              .reverse()
              .map(({ v, n }) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 hover:bg-zinc-900"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-300">
                    <span className="text-zinc-500">v{n} · </span>
                    {v.label}
                  </span>
                  <button
                    onClick={() => {
                      onRestore(v.id)
                      setOpen(false)
                    }}
                    className="shrink-0 rounded border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  >
                    Restore
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

type Tab = 'preview' | 'code' | 'contract'
const TABS: { id: Tab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
  { id: 'contract', label: 'Contract' },
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
  onRestore,
  onDownload,
}: {
  device: Device
  setDevice: (d: Device) => void
  versions: Version[]
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
      {onRestore && <VersionMenu versions={versions} onRestore={onRestore} />}
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
  onRestore,
  generation = 0,
  dirty = false,
  onSyncFiles,
  onDiscard,
  onSave,
}: {
  fileTree: FileTree
  projectName?: string
  versions?: Version[]
  onRestore?: (id: string) => void
  generation?: number
  dirty?: boolean
  onSyncFiles?: (files: FileTree) => void
  onDiscard?: () => void
  onSave?: () => void
}) {
  const [tab, setTab] = useState<Tab>('preview')
  const [device, setDevice] = useState<Device>('desktop')
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [editable, setEditable] = useState(false)

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <nav className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2.5 text-[13px]">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? 'rounded-md bg-zinc-900 px-3 py-1.5 text-zinc-50'
                  : 'rounded-md px-3 py-1.5 text-zinc-500 transition-colors hover:text-zinc-300'
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-full border border-zinc-800 px-3.5 py-1.5 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50">
            Connect wallet
          </button>
          <button className="rounded-full bg-zinc-50 px-3.5 py-1.5 font-medium text-black transition-colors hover:bg-white">
            Deploy
          </button>
        </div>
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
                <SandpackFileExplorer style={{ height: '100%', width: 200 }} />
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
            </div>
          </SandpackProvider>
        </div>

        {tab === 'contract' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-[13px] text-zinc-600">
            Deployed contracts appear here (Milestone 2).
          </div>
        )}

        {dirty && (onDiscard || onSave) && (
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
    </section>
  )
}
