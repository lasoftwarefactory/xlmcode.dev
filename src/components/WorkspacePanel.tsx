import { useState } from 'react'
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from '@codesandbox/sandpack-react'
import type { FileTree } from '../../shared/types'
import { SANDPACK_TEMPLATE, TAILWIND_CDN, sandpackTheme } from '../lib/project'
import { downloadProjectZip } from '../lib/export'

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
}: {
  fileTree: FileTree
  projectName?: string
}) {
  const [tab, setTab] = useState<Tab>('preview')

  return (
    <section className="flex min-w-0 flex-1 flex-col">
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
        <button
          onClick={() => void downloadProjectZip(projectName, fileTree)}
          className="rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
        >
          Download
        </button>
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
              <div className={tab === 'preview' ? 'min-h-0 flex-1' : 'hidden'}>
                <SandpackPreview
                  showNavigator={false}
                  showOpenInCodeSandbox={false}
                  showRefreshButton
                  style={{ height: '100%' }}
                />
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
