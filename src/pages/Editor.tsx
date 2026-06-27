import { Navigate, useParams } from 'react-router-dom'
import { ChatPanel } from '../components/ChatPanel'
import { WorkspacePanel } from '../components/WorkspacePanel'
import { useProjects } from '../projects/store'

/** Route "/projects/:slug" — the editor: chat on the left, live workspace right. */
export function Editor() {
  const { slug } = useParams<{ slug: string }>()
  const { getProject, send } = useProjects()
  const project = slug ? getProject(slug) : undefined

  // No persistence yet (Milestone 5): a direct hit / refresh has no project.
  if (!project) return <Navigate to="/" replace />

  return (
    <main className="flex min-h-0 flex-1">
      <ChatPanel
        messages={project.messages}
        busy={project.busy}
        error={project.error}
        onSend={(text) => send(project.slug, text)}
      />
      <WorkspacePanel fileTree={project.fileTree} projectName={project.slug} />
    </main>
  )
}
