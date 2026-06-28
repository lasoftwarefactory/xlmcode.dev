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
    name: 'stellarable-dev-api',
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
            return send(200, { ok: true, service: 'stellarable-api', dev: true })
          }

          if (req.url.startsWith('/api/contracts')) {
            const { listManifests } = await server.ssrLoadModule(
              '/api/_lib/contracts.ts',
            )
            return send(200, { contracts: await listManifests() })
          }

          if (req.url.startsWith('/api/wallet/')) {
            const wallet = await server.ssrLoadModule('/api/_lib/wallet.ts')
            if (req.url.includes('/seed')) {
              if (req.method !== 'POST') return send(405, { error: 'POST only' })
              return send(200, { mnemonic: wallet.generateMnemonic() })
            }
            if (req.url.includes('/account')) {
              if (req.method !== 'POST') return send(405, { error: 'POST only' })
              const achunks: Buffer[] = []
              for await (const c of req) achunks.push(c as Buffer)
              const { mnemonic, index, fund } = JSON.parse(
                Buffer.concat(achunks).toString('utf8'),
              )
              const acct = wallet.deriveAccount(mnemonic, index)
              if (fund) await wallet.fundWallet(acct.publicKey)
              return send(200, { ...acct, balance: await wallet.getBalance(acct.publicKey) })
            }
            if (req.url.includes('/fund')) {
              const wchunks: Buffer[] = []
              for await (const c of req) wchunks.push(c as Buffer)
              const { publicKey } = JSON.parse(Buffer.concat(wchunks).toString('utf8'))
              await wallet.fundWallet(publicKey)
              return send(200, { publicKey, balance: await wallet.getBalance(publicKey) })
            }
            if (req.url.includes('/balance')) {
              const address = new URL(req.url, 'http://x').searchParams.get('address')
              if (!address) return send(400, { error: 'address required' })
              return send(200, { address, balance: await wallet.getBalance(address) })
            }
            return send(404, { error: 'Not found' })
          }

          if (req.url.startsWith('/api/faucet')) {
            if (req.method !== 'POST') return send(405, { error: 'POST only' })
            const fchunks: Buffer[] = []
            for await (const c of req) fchunks.push(c as Buffer)
            const { address, amount } = JSON.parse(
              Buffer.concat(fchunks).toString('utf8'),
            )
            if (!address) return send(400, { error: 'address required' })
            const { mintDemoTokens } = await server.ssrLoadModule(
              '/api/_lib/faucet.ts',
            )
            return send(200, {
              hash: await mintDemoTokens(address, amount ?? 1000, env.FAUCET_SECRET),
            })
          }

          if (req.url.startsWith('/api/mint-nft')) {
            if (req.method !== 'POST') return send(405, { error: 'POST only' })
            const nchunks: Buffer[] = []
            for await (const c of req) nchunks.push(c as Buffer)
            const { address } = JSON.parse(Buffer.concat(nchunks).toString('utf8'))
            if (!address) return send(400, { error: 'address required' })
            const { mintNft } = await server.ssrLoadModule('/api/_lib/nft.ts')
            return send(200, await mintNft(address, env.FAUCET_SECRET))
          }

          if (req.url.startsWith('/api/deploy')) {
            if (req.method !== 'POST') return send(405, { error: 'POST only' })
            const dchunks: Buffer[] = []
            for await (const c of req) dchunks.push(c as Buffer)
            const dbody = dchunks.length
              ? JSON.parse(Buffer.concat(dchunks).toString('utf8'))
              : {}
            const { getManifest } = await server.ssrLoadModule(
              '/api/_lib/contracts.ts',
            )
            const { deployContract } = await server.ssrLoadModule(
              '/api/_lib/deploy.ts',
            )
            const manifest = await getManifest(dbody.manifestId)
            if (!manifest)
              return send(404, { error: `Unknown contract: ${dbody.manifestId}` })
            const result = await deployContract({
              manifest,
              config: dbody.config ?? {},
              deployerSecret: dbody.deployerSecret,
            })
            return send(200, result)
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
            const { listManifests } = await server.ssrLoadModule(
              '/api/_lib/contracts.ts',
            )
            const result = streamChat({
              apiKey,
              model: env.OPENAI_MODEL,
              fileTree: body.fileTree ?? {},
              history: body.history ?? [],
              userMessage: body.userMessage ?? '',
              catalog: await listManifests(),
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
