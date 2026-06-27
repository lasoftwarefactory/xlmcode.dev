import { useState } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from '@codesandbox/sandpack-react'
import { Monitor, Smartphone, Download, History } from 'lucide-react'
import type { FileTree } from '../../shared/types'
import type { Version } from '../projects/store'
import { SANDPACK_TEMPLATE, TAILWIND_CDN, sandpackTheme } from '../lib/project'
import { downloadProjectZip } from '../lib/export'

type Device = 'desktop' | 'mobile'

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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
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

/** Cheap content hash so the Sandpack subtree remounts only when files change. */
function hashTree(tree: FileTree): number {
  const s = Object.entries(tree)
    .map(([k, v]) => `${k}\0${v}`)
    .join('\0')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h
}

/**
 * Right column: live preview + code in one Sandpack instance.
 *
 * - Tailwind is injected via `externalResources` (the only thing that works in
 *   the classic bundler).
 * - The provider remounts (via `key`) when file content changes, so updates are
 *   always reflected.
 * - Default (light) theme — the generated apps are light, so we don't want a
 *   dark Sandpack chrome showing through.
 * - The `absolute inset-0` wrapper gives the iframe a concrete pixel box.
 */
export function WorkspacePanel({
  fileTree,
  projectName = 'stellar-app',
  versions = [],
  onRestore,
}: {
  fileTree: FileTree
  projectName?: string
  versions?: Version[]
  onRestore?: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>('preview')
  const [device, setDevice] = useState<Device>('desktop')

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
          {tab === 'preview' && (
            <div className="flex items-center rounded-md border border-zinc-800 p-0.5">
              <button
                onClick={() => setDevice('desktop')}
                title="Desktop"
                className={`rounded p-1.5 transition-colors ${device === 'desktop' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                title="Mobile"
                className={`rounded p-1.5 transition-colors ${device === 'mobile' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          )}
          {onRestore && (
            <VersionMenu versions={versions} onRestore={onRestore} />
          )}
          <button
            onClick={() => void downloadProjectZip(projectName, fileTree)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </nav>

      <div className="relative min-h-0 flex-1 bg-zinc-950">
        <div className="absolute inset-0">
          <SandpackProvider
            key={hashTree(fileTree)}
            template={SANDPACK_TEMPLATE}
            files={fileTree}
            theme={sandpackTheme}
            options={{ externalResources: [TAILWIND_CDN] }}
            style={{ height: '100%' }}
          >
            <div className="flex h-full flex-col">
              <div
                className={
                  tab === 'preview'
                    ? 'flex min-h-0 flex-1 justify-center bg-zinc-900/30'
                    : 'hidden'
                }
              >
                <div
                  className="h-full"
                  style={{ width: device === 'mobile' ? 390 : '100%' }}
                >
                  <SandpackPreview
                    showNavigator
                    showOpenInCodeSandbox={false}
                    showRefreshButton
                    style={{ height: '100%' }}
                  />
                </div>
              </div>
              <div className={tab === 'code' ? 'flex min-h-0 flex-1' : 'hidden'}>
                <SandpackFileExplorer style={{ height: '100%', width: 200 }} />
                <SandpackCodeEditor
                  readOnly
                  showLineNumbers
                  showTabs={false}
                  style={{ height: '100%', flex: 1 }}
                />
              </div>
            </div>
          </SandpackProvider>
        </div>

        {tab === 'contract' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-[13px] text-zinc-600">
            Deployed contracts appear here (Milestone 2).
          </div>
        )}
      </div>
    </section>
  )
}
