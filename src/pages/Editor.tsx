import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ChatPanel } from '../components/ChatPanel'
import { WorkspacePanel } from '../components/WorkspacePanel'
import { useProjects } from '../projects/store'

/** Route "/projects/:slug" — resizable chat | workspace (v0-style). */
export function Editor() {
  const { slug } = useParams<{ slug: string }>()
  const { getProject, send, restoreVersion, renameProject } = useProjects()
  const project = slug ? getProject(slug) : undefined
  // While dragging the divider, kill pointer events on the preview so the
  // Sandpack iframe doesn't swallow the mouse and freeze the resize.
  const [resizing, setResizing] = useState(false)

  // No persistence yet (Milestone 5): a direct hit / refresh has no project.
  if (!project) return <Navigate to="/" replace />

  return (
    <PanelGroup direction="horizontal" className="min-h-0 flex-1">
      <Panel defaultSize={34} minSize={22} maxSize={70}>
        <ChatPanel
          projectName={project.name}
          onRename={(name) => renameProject(project.slug, name)}
          messages={project.messages}
          busy={project.busy}
          error={project.error}
          activity={project.activity}
          streamingMessage={project.streamingMessage}
          onSend={(text) => send(project.slug, text)}
        />
      </Panel>
      <PanelResizeHandle
        onDragging={setResizing}
        className="w-1 bg-zinc-800 transition-colors hover:bg-violet-500/60 data-[resize-handle-state=drag]:bg-violet-500"
      />
      <Panel defaultSize={66} minSize={30}>
        <div className={`h-full ${resizing ? 'pointer-events-none' : ''}`}>
          <WorkspacePanel
            fileTree={project.fileTree}
            projectName={project.slug}
            versions={project.versions}
            onRestore={(id) => restoreVersion(project.slug, id)}
          />
        </div>
      </Panel>
    </PanelGroup>
  )
}
