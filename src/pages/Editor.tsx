import { Navigate, useParams } from 'react-router-dom'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ChatPanel } from '../components/ChatPanel'
import { WorkspacePanel } from '../components/WorkspacePanel'
import { useProjects } from '../projects/store'

/** Route "/projects/:slug" — resizable chat | workspace (v0-style). */
export function Editor() {
  const { slug } = useParams<{ slug: string }>()
  const { getProject, send, restoreVersion } = useProjects()
  const project = slug ? getProject(slug) : undefined

  // No persistence yet (Milestone 5): a direct hit / refresh has no project.
  if (!project) return <Navigate to="/" replace />

  return (
    <PanelGroup direction="horizontal" className="min-h-0 flex-1">
      <Panel defaultSize={34} minSize={22} maxSize={55}>
        <ChatPanel
          messages={project.messages}
          busy={project.busy}
          error={project.error}
          activity={project.activity}
          streamingMessage={project.streamingMessage}
          onSend={(text) => send(project.slug, text)}
        />
      </Panel>
      <PanelResizeHandle className="w-px bg-zinc-800 transition-colors hover:bg-violet-500/60 data-[resize-handle-state=drag]:bg-violet-500" />
      <Panel defaultSize={66} minSize={30}>
        <WorkspacePanel
          fileTree={project.fileTree}
          projectName={project.slug}
          versions={project.versions}
          onRestore={(id) => restoreVersion(project.slug, id)}
        />
      </Panel>
    </PanelGroup>
  )
}
