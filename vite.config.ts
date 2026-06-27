import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Local dev API: in production Vercel serves the `/api/*.ts` functions. Locally
 * `vite` alone doesn't, so this plugin routes /api/* to the same provider-
 * agnostic core (`api/_lib/llm.ts`) without needing the Vercel CLI.
 */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'stellable-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }

        try {
          if (req.url.startsWith('/api/health')) {
            return send(200, { ok: true, service: 'stellable-api', dev: true })
          }

          if (req.url.startsWith('/api/chat')) {
            if (req.method !== 'POST') return send(405, { error: 'POST only' })

            const chunks: Buffer[] = []
            for await (const c of req) chunks.push(c as Buffer)
            const body = chunks.length
              ? JSON.parse(Buffer.concat(chunks).toString('utf8'))
              : {}

            const apiKey = env.OPENAI_API_KEY
            if (!apiKey) return send(401, { error: 'OPENAI_API_KEY not set in .env.local' })

            // Stream the generated JSON to the client as it's produced.
            const { streamChat } = await server.ssrLoadModule('/api/_lib/llm.ts')
            const result = streamChat({
              apiKey,
              model: env.OPENAI_MODEL,
              fileTree: body.fileTree ?? {},
              history: body.history ?? [],
              userMessage: body.userMessage ?? '',
            })
            res.statusCode = 200
            res.setHeader('content-type', 'text/plain; charset=utf-8')
            for await (const chunk of result.textStream) res.write(chunk)
            res.end()
            return
          }

          return send(404, { error: 'Not found' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return send(500, { error: message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devApi(env)],
  }
})
