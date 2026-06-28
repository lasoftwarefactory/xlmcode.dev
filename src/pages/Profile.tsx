import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/store'
import { useProjects } from '../projects/store'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Route "/profile" — fake user profile. */
export function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { projects } = useProjects()
  if (!user) return null

  return (
    <main className="flex flex-1 justify-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15 text-lg font-semibold text-violet-300">
            {initials(user.name)}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{user.name}</h1>
            <p className="text-[13.5px] text-zinc-500">{user.email}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-2xl font-semibold">{projects.length}</p>
            <p className="text-[12.5px] text-zinc-500">Projects</p>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-2xl font-semibold">testnet</p>
            <p className="text-[12.5px] text-zinc-500">Network</p>
          </div>
        </div>

        <button
          onClick={() => {
            logout()
            navigate('/')
          }}
          className="mt-8 rounded-lg border border-zinc-800 px-4 py-2 text-[13.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
        >
          Sign out
        </button>
      </div>
    </main>
  )
}
