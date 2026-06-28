import type { SandpackTheme } from '@codesandbox/sandpack-react'
import type { FileOp, FileTree, DeployedContract } from '../../shared/types'

/**
 * The user's generated app lives as an in-memory FileTree. Sandpack (classic
 * `react-ts` template) renders it. Tailwind is injected via the Sandpack
 * `externalResources` option (NOT an index.html <script>, which the classic
 * bundler does not execute). We do NOT override the template's index.html.
 */
export const SANDPACK_TEMPLATE = 'react-ts' as const
export const TAILWIND_CDN = 'https://cdn.tailwindcss.com'

/**
 * Dark Sandpack theme matching the platform (zinc + Geist). Safe to use now that
 * the loading overlay hides correctly (the stuck black overlay was a StrictMode
 * bug, not the theme). The generated app renders its own (usually light) UI in
 * the preview; this theme only styles the code editor + Sandpack chrome.
 */
export const sandpackTheme: SandpackTheme = {
  colors: {
    surface1: '#09090b',
    surface2: '#18181b',
    surface3: '#27272a',
    clickable: '#a1a1aa',
    base: '#e4e4e7',
    disabled: '#52525b',
    hover: '#fafafa',
    accent: '#c084fc',
    error: '#f87171',
    errorSurface: '#27272a',
  },
  syntax: {
    plain: '#e4e4e7',
    comment: { color: '#52525b', fontStyle: 'italic' },
    keyword: '#c084fc',
    tag: '#7dd3fc',
    punctuation: '#a1a1aa',
    definition: '#fafafa',
    property: '#7dd3fc',
    static: '#fca5a5',
    string: '#86efac',
  },
  font: {
    body: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", ui-monospace, monospace',
    size: '13px',
    lineHeight: '20px',
  },
}

const STARTER_APP = `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-400">
      <p className="text-sm">Your app will appear here. Describe it in the chat.</p>
    </div>
  )
}
`

// Cosmetic project files so the generated app reads like a real create-vite
// project (and is ejectable). The Sandpack classic bundler runs from /App.tsx;
// these don't change how it runs, only how the project looks in the Code tab.
const PACKAGE_JSON = `{
  "name": "stellar-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~6.0.0",
    "vite": "^8.0.0"
  }
}
`

const README = `# Stellar App

Built with Stellarable — React + TypeScript + TailwindCSS, ready to talk to
Stellar smart contracts.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`

// The HTML host page. Tailwind is loaded via its CDN here (and also injected
// into the preview by Sandpack). Keep the #root mount point.
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stellar App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

/** Files present in every project regardless of content. */
const BASE_FILES: FileTree = {
  '/package.json': PACKAGE_JSON,
  '/README.md': README,
  '/public/index.html': INDEX_HTML,
}

/** Merge the base project files under a set of app files. */
export function withBaseFiles(files: FileTree): FileTree {
  return { ...BASE_FILES, ...files }
}

/** The blank canvas every new project starts from. */
export function initialFileTree(): FileTree {
  return withBaseFiles({ '/App.tsx': STARTER_APP })
}

/** Apply the LLM's file operations to the tree (PLAN.md §5.4). Pure. */
export function applyFileOps(tree: FileTree, ops: FileOp[]): FileTree {
  const next = { ...tree }
  for (const op of ops) {
    if (op.op === 'create' || op.op === 'edit') next[op.path] = op.content
    else if (op.op === 'delete') delete next[op.path]
  }
  return next
}

// --- Example starters. A `files` example is a pre-built, working dApp (no LLM)
// wired to a SHARED pre-deployed testnet contract: it reads live on-chain state
// and connects Freighter. A `prompt` example drives the LLM from the blank
// template. ---

/** Browser polyfills so @stellar/stellar-sdk runs in the sandbox. Imported
 *  FIRST (before the SDK) so Buffer exists when the SDK module evaluates. */
const POLYFILLS = `import { Buffer } from 'buffer'
const g = globalThis as unknown as { Buffer?: unknown }
if (!g.Buffer) g.Buffer = Buffer
`

/** Shared, pre-deployed Demo fungible token on testnet. Its owner secret lives
 *  in FAUCET_SECRET so /api/faucet can mint test tokens to connected wallets. */
const DEMO_TOKEN_ID = 'CD7XBRBY2IZASZIXZYXWR33ZUSUBUTXTY5MEGDLCAMOBVGQSLU6X675M'
const DEMO_TOKEN_VIEW_SOURCE =
  'GBDFURES5STGVPMBLLPK4DAL5H2LKRETUSWC7T2YSVJO7PGFKN57DIQS'

const STELLAR_PACKAGE_JSON = `{
  "name": "stellar-dapp",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "buffer": "^6.0.3",
    "@stellar/stellar-sdk": "^13.1.0",
    "@stellar/freighter-api": "^4.1.0"
  }
}
`

/** A tiny reusable Soroban client: read-only view calls + Freighter writes. */
const STELLAR_LIB = `import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk'
import freighterApi from '@stellar/freighter-api'

export const RPC_URL = 'https://soroban-testnet.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
const server = new rpc.Server(RPC_URL)

/** Read a view method (no wallet). Uses a funded account just as a sim source. */
export async function readContract(
  contractId: string,
  method: string,
  viewSource: string,
  args: any[] = [],
) {
  const c = new Contract(contractId)
  const source = await server.getAccount(viewSource)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(c.call(method, ...args))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error)
  return scValToNative(sim.result!.retval)
}

export const addr = (a: string) => new Address(a).toScVal()
export const i128 = (n: bigint | number) => nativeToScVal(BigInt(n), { type: 'i128' })
export const u32 = (n: number) => nativeToScVal(n, { type: 'u32' })

/** Token ids of an NFT collection currently owned by \`user\` (verified via
 *  owner_of). Candidate ids are gathered from recent contract events. */
export async function getOwnedNftIds(
  contractId: string,
  user: string,
  viewSource: string,
): Promise<number[]> {
  const latest = await server.getLatestLedger()
  const res = await server.getEvents({
    startLedger: Math.max(latest.sequence - 8000, 1),
    filters: [{ type: 'contract', contractIds: [contractId] }],
    limit: 100,
  })
  const candidates = new Set<number>()
  for (const ev of res.events ?? []) {
    try {
      const val = scValToNative(ev.value as any)
      const nums: unknown[] = []
      // Mint event data is an object like { token_id: 0 }; transfers carry the id
      // in the value or topics. Gather every plausible token id.
      if (val && typeof val === 'object') {
        for (const k of ['token_id', 'tokenId', 'id'])
          if (k in (val as any)) nums.push((val as any)[k])
      } else {
        nums.push(val)
      }
      for (const t of ev.topic as any[]) {
        try { nums.push(scValToNative(t)) } catch {}
      }
      for (const x of nums) {
        const n = Number(x)
        if (Number.isInteger(n) && n >= 0 && n < 100000) candidates.add(n)
      }
    } catch {}
  }
  const owned: number[] = []
  for (const id of [...candidates].slice(0, 50)) {
    try {
      const owner = await readContract(contractId, 'owner_of', viewSource, [u32(id)])
      if (String(owner) === user) owned.push(id)
    } catch {}
  }
  return owned.sort((a, b) => a - b)
}

export type Movement = {
  kind: 'in' | 'out' | 'mint'
  counterparty: string
  amount: string
  time: string
  txHash: string
}

/** Recent token movements (transfer/mint events) involving \`user\`, newest first. */
export async function getTokenActivity(
  contractId: string,
  user: string,
  decimals: number,
): Promise<Movement[]> {
  const latest = await server.getLatestLedger()
  const startLedger = Math.max(latest.sequence - 8000, 1) // ~11h of history
  const res = await server.getEvents({
    startLedger,
    filters: [{ type: 'contract', contractIds: [contractId] }],
    limit: 100,
  })
  const out: Movement[] = []
  for (const ev of res.events ?? []) {
    try {
      const topic = (ev.topic as any[]).map((t) => scValToNative(t))
      const name = String(topic[0])
      // Event data is a scalar i128 for transfer, but an object { amount } for mint.
      const raw = scValToNative(ev.value as any)
      const amountVal =
        raw && typeof raw === 'object' && 'amount' in raw ? (raw as any).amount : raw
      const amount = fromUnits(BigInt(amountVal), decimals)
      const time = (ev as any).ledgerClosedAt ?? ''
      const txHash = (ev as any).txHash ?? ''
      if (name === 'transfer') {
        const from = String(topic[1]); const to = String(topic[2])
        if (from === user) out.push({ kind: 'out', counterparty: to, amount, time, txHash })
        else if (to === user) out.push({ kind: 'in', counterparty: from, amount, time, txHash })
      } else if (name === 'mint') {
        const to = String(topic[1])
        if (to === user) out.push({ kind: 'mint', counterparty: '', amount, time, txHash })
      }
    } catch {
      // skip events we can't decode
    }
  }
  return out.reverse()
}

/** Human amount -> base units (scaled by the token's decimals). */
export function toUnits(human: string | number, decimals: number): bigint {
  const s = String(human).trim()
  const [whole, frac = ''] = s.split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')
}

/** Base units -> human string (trims trailing zeros; thousands separators). */
export function fromUnits(raw: bigint | string, decimals: number): string {
  const v = BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const whole = v / base
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  const wholeStr = whole.toLocaleString('en-US')
  return frac ? wholeStr + '.' + frac : wholeStr
}

// Browser extensions inject only into the top frame, never the cross-origin
// Sandpack preview iframe. So in the preview we delegate wallet ops to the host
// window (which DOES have Freighter) over postMessage; standalone/exported apps
// (top-level) talk to Freighter directly.
const inIframe = typeof window !== 'undefined' && window.parent !== window.self

function bridge(method: string, extra: Record<string, unknown> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (!m || m.source !== 'stellarable-host' || m.id !== id) return
      window.removeEventListener('message', onMsg)
      if (m.error) reject(new Error(m.error))
      else resolve(m.result)
    }
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ source: 'stellarable-dapp', id, method, ...extra }, '*')
    setTimeout(() => {
      window.removeEventListener('message', onMsg)
      reject(new Error('Wallet request timed out'))
    }, 120000)
  })
}

/** Connect Freighter and return the user's address. */
export async function connectWallet(): Promise<string> {
  if (inIframe) return bridge('getAddress')
  const c = await freighterApi.isConnected()
  if (!c.isConnected) throw new Error('Freighter is not installed. Get it at freighter.app')
  const access = await freighterApi.requestAccess()
  if (access.error) throw new Error(String(access.error))
  return access.address
}

export async function getConnectedAddress(): Promise<string | null> {
  if (inIframe) return null // require an explicit Connect click inside the preview
  const c = await freighterApi.isConnected()
  if (!c.isConnected) return null
  const a = await freighterApi.getAddress()
  return a.address || null
}

/** Claim test tokens from the demo faucet (owner-minted by the host backend). */
export async function claimTokens(address: string): Promise<string> {
  if (inIframe) return bridge('faucet', { address })
  const r = await fetch('/api/faucet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Faucet failed')
  return data.hash
}

/** Mint a Demo NFT to \`address\` (owner-minted by the host backend). */
export async function mintNft(
  address: string,
): Promise<{ hash: string; tokenId: number | null }> {
  if (inIframe) return JSON.parse(await bridge('mintNft', { address }))
  const r = await fetch('/api/mint-nft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Mint failed')
  return data
}

async function signXDR(xdr: string, address: string): Promise<string> {
  if (inIframe) return bridge('signXDR', { xdr, address, networkPassphrase: NETWORK_PASSPHRASE })
  const s = await freighterApi.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  })
  if (s.error) throw new Error(String(s.error))
  return s.signedTxXdr
}

/** Build, sign (Freighter, via host bridge in the preview) and submit a write. */
export async function invokeContract(
  contractId: string,
  method: string,
  caller: string,
  args: any[] = [],
): Promise<string> {
  const c = new Contract(contractId)
  const source = await server.getAccount(caller)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(c.call(method, ...args))
    .setTimeout(60)
    .build()
  const prepared = await server.prepareTransaction(tx)
  const signedXdr = await signXDR(prepared.toXDR(), caller)
  // Submit the signed XDR via the raw Soroban JSON-RPC. We deliberately do NOT
  // re-parse the signed envelope client-side (TransactionBuilder.fromXDR), which
  // can throw "Bad union switch" when the signer emits a newer XDR than this
  // SDK build understands. The RPC parses it server-side.
  const rpcCall = async (m: string, params: any) => {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: m, params }),
    })
    const j = await res.json()
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error))
    return j.result
  }
  const sent = await rpcCall('sendTransaction', { transaction: signedXdr })
  if (sent.status === 'ERROR') {
    throw new Error('Submit failed: ' + (sent.errorResultXdr || JSON.stringify(sent)))
  }
  for (let i = 0; i < 25; i++) {
    const got = await rpcCall('getTransaction', { hash: sent.hash })
    if (got.status === 'SUCCESS') return sent.hash
    if (got.status === 'FAILED') throw new Error('Transaction failed on-chain')
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Transaction timed out')
}
`

const DEMO_TOKEN_APP = `import './polyfills'
import { useCallback, useEffect, useState } from 'react'
import {
  readContract,
  connectWallet,
  getConnectedAddress,
  invokeContract,
  claimTokens,
  getTokenActivity,
  addr,
  i128,
  toUnits,
  fromUnits,
} from './stellar'

const TOKEN_ID = '${DEMO_TOKEN_ID}'
const VIEW_SOURCE = '${DEMO_TOKEN_VIEW_SOURCE}'
const EXPLORER = 'https://stellar.expert/explorer/testnet/contract/' + TOKEN_ID
const short = (a: string) => a.slice(0, 4) + '…' + a.slice(-4)
const fmt = (n: string | number) => Number(n).toLocaleString()
const ago = (iso: string) => {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

type Toast = { kind: 'ok' | 'err'; text: string } | null

export default function App() {
  const [meta, setMeta] = useState<{ name: string; symbol: string; supply: string } | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('100')
  const [decimals, setDecimals] = useState(18)
  const [busy, setBusy] = useState<'' | 'connect' | 'claim' | 'send'>('')
  const [toast, setToast] = useState<Toast>(null)

  const sym = meta?.symbol ?? 'DEMO'
  const flash = (t: Toast) => { setToast(t); if (t) setTimeout(() => setToast(null), 4000) }

  const loadMeta = useCallback(async () => {
    try {
      const [name, symbol, supply, dec] = await Promise.all([
        readContract(TOKEN_ID, 'name', VIEW_SOURCE),
        readContract(TOKEN_ID, 'symbol', VIEW_SOURCE),
        readContract(TOKEN_ID, 'total_supply', VIEW_SOURCE),
        readContract(TOKEN_ID, 'decimals', VIEW_SOURCE),
      ])
      setMeta({ name, symbol, supply: String(supply) })
      setDecimals(Number(dec))
    } catch (e: any) { flash({ kind: 'err', text: e.message }) }
  }, [])

  const loadBalance = useCallback(async (a: string) => {
    try { setBalance(String(await readContract(TOKEN_ID, 'balance', VIEW_SOURCE, [addr(a)]))) }
    catch (e: any) { flash({ kind: 'err', text: e.message }) }
  }, [])

  const loadActivity = useCallback(async (a: string) => {
    try {
      const fetched = await getTokenActivity(TOKEN_ID, a, decimals)
      // Merge: keep just-submitted (optimistic) entries whose event hasn't been
      // indexed by the RPC yet, deduped by txHash, on top.
      setActivity((prev) => {
        const seen = new Set(fetched.map((m) => m.txHash).filter(Boolean))
        const pending = prev.filter((m) => m.txHash && !seen.has(m.txHash))
        return [...pending, ...fetched]
      })
    } catch {}
  }, [decimals])

  const refresh = useCallback(async (a: string) => {
    await Promise.all([loadBalance(a), loadActivity(a), loadMeta()])
  }, [loadBalance, loadActivity, loadMeta])

  useEffect(() => {
    loadMeta()
    getConnectedAddress().then((a) => { if (a) { setAddress(a); refresh(a) } })
  }, [loadMeta, refresh])

  const connect = async () => {
    setBusy('connect')
    try { const a = await connectWallet(); setAddress(a); await refresh(a) }
    catch (e: any) { flash({ kind: 'err', text: e.message }) }
    finally { setBusy('') }
  }

  const disconnect = () => {
    setAddress(null); setBalance(null); setActivity([])
  }

  const prepend = (m: any) => setActivity((prev) => [m, ...prev])

  const claim = async () => {
    if (!address) return
    setBusy('claim')
    try {
      const hash = await claimTokens(address)
      prepend({ kind: 'mint', counterparty: '', amount: '1000', time: new Date().toISOString(), txHash: hash })
      flash({ kind: 'ok', text: 'Claimed 1,000 ' + sym + ' 🎉' })
      refresh(address)
    } catch (e: any) { flash({ kind: 'err', text: e.message }) }
    finally { setBusy('') }
  }

  const send = async () => {
    if (!address || !to) return
    const recipient = to
    setBusy('send')
    try {
      const hash = await invokeContract(TOKEN_ID, 'transfer', address, [addr(address), addr(recipient), i128(toUnits(amount, decimals))])
      prepend({ kind: 'out', counterparty: recipient, amount, time: new Date().toISOString(), txHash: hash })
      setTo('')
      flash({ kind: 'ok', text: 'Sent ' + fmt(amount) + ' ' + sym + ' · ' + short(hash) })
      refresh(address)
    } catch (e: any) { flash({ kind: 'err', text: e.message }) }
    finally { setBusy('') }
  }

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-100 px-4 py-10 font-sans text-slate-900">
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">D</div>
            <div>
              <h1 className="text-[15px] font-semibold leading-none">{meta?.name ?? 'Demo'} Wallet</h1>
              <p className="mt-0.5 text-[11px] text-slate-500">Stellar testnet</p>
            </div>
          </div>
          {address ? (
            <button onClick={disconnect} title="Disconnect"
              className="group inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:ring-red-300 hover:text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 group-hover:bg-red-500" />
              <span className="group-hover:hidden">{short(address)}</span>
              <span className="hidden group-hover:inline">Disconnect</span>
            </button>
          ) : (
            <button onClick={connect} disabled={busy === 'connect'}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
              {busy === 'connect' ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>

        {/* Balance hero */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-200">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-200">
            {address ? 'Your balance' : 'Total supply'}
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {address
              ? balance === null ? '—' : fromUnits(balance, decimals)
              : meta ? fromUnits(meta.supply, decimals) : '—'}
            <span className="ml-2 text-lg font-medium text-indigo-200">{sym}</span>
          </p>
          {address && meta && (
            <p className="mt-2 text-xs text-indigo-200">Total supply · {fromUnits(meta.supply, decimals)} {sym}</p>
          )}
        </div>

        {!address ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="text-sm text-slate-600">Connect your Freighter wallet to claim test tokens and send them.</p>
            <button onClick={connect} disabled={busy === 'connect'}
              className="mt-3 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
              {busy === 'connect' ? 'Connecting…' : 'Connect Freighter'}
            </button>
          </div>
        ) : (
          <>
            {/* Faucet */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium">Need tokens?</p>
                <p className="text-xs text-slate-500">Claim 1,000 {sym} free on testnet.</p>
              </div>
              <button onClick={claim} disabled={busy === 'claim'}
                className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60">
                {busy === 'claim' ? 'Claiming…' : 'Claim'}
              </button>
            </div>

            {/* Send */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Send {sym}</p>
              <label className="mb-1 block text-xs font-medium text-slate-500">Recipient</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="G…" className={field} />
              <label className="mb-1 mt-3 block text-xs font-medium text-slate-500">Amount</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={field} />
              <button onClick={send} disabled={!to || busy === 'send'}
                className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50">
                {busy === 'send' ? 'Signing…' : 'Sign & send'}
              </button>
            </div>

            {/* Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold">Activity</p>
              {activity.length === 0 ? (
                <p className="text-xs text-slate-400">No movements yet. Claim or send to see them here.</p>
              ) : (
                <ul className="space-y-1">
                  {activity.slice(0, 8).map((m, i) => (
                    <li key={i}>
                      <a
                        href={m.txHash ? 'https://stellar.expert/explorer/testnet/tx/' + m.txHash : undefined}
                        target="_blank" rel="noreferrer"
                        className={'-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition ' + (m.txHash ? 'hover:bg-slate-50' : '')}>
                        <div className="flex items-center gap-2.5">
                          <span className={'flex h-7 w-7 items-center justify-center rounded-full text-xs ' +
                            (m.kind === 'out' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>
                            {m.kind === 'out' ? '↑' : '↓'}
                          </span>
                          <div>
                            <p className="font-medium leading-none">
                              {m.kind === 'out' ? 'Sent' : m.kind === 'mint' ? 'Claimed' : 'Received'}
                              {m.txHash && <span className="ml-1 text-[10px] text-slate-400">↗</span>}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {m.counterparty ? short(m.counterparty) + ' · ' : ''}{ago(m.time)}
                            </p>
                          </div>
                        </div>
                        <span className={'font-semibold ' + (m.kind === 'out' ? 'text-rose-600' : 'text-emerald-600')}>
                          {m.kind === 'out' ? '-' : '+'}{m.amount} {sym}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <a href={EXPLORER} target="_blank" rel="noreferrer"
          className="block text-center text-xs text-slate-400 transition hover:text-slate-600">
          Live on Stellar testnet · contract {short(TOKEN_ID)} ↗
        </a>
      </div>

      {toast && (
        <div className={'fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ' +
          (toast.kind === 'ok' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white')}>
          {toast.text}
        </div>
      )}
    </div>
  )
}
`

/** Shared, pre-deployed Demo NFT collection on testnet (same owner as the token,
 *  so /api/mint-nft signs mints with FAUCET_SECRET). */
const DEMO_NFT_ID = 'CD4HFX54Y3WIUYZUYRYK5LMNIYSX27CNDFYSZLEVE66MJCVVPSCYA3CU'
const DEMO_NFT_VIEW_SOURCE =
  'GBDFURES5STGVPMBLLPK4DAL5H2LKRETUSWC7T2YSVJO7PGFKN57DIQS'

const DEMO_NFT_APP = `import './polyfills'
import { useCallback, useEffect, useState } from 'react'
import {
  readContract,
  connectWallet,
  getConnectedAddress,
  mintNft,
  getOwnedNftIds,
  addr,
} from './stellar'

const NFT_ID = '${DEMO_NFT_ID}'
const VIEW_SOURCE = '${DEMO_NFT_VIEW_SOURCE}'
const EXPLORER = 'https://stellar.expert/explorer/testnet/contract/' + NFT_ID
const short = (a: string) => a.slice(0, 4) + '…' + a.slice(-4)
// Deterministic neon art per token id.
const art = (id: number) => {
  const h = (id * 53) % 360
  return 'conic-gradient(from ' + (id * 40) + 'deg, hsl(' + h + ' 90% 60%), hsl(' + ((h + 90) % 360) + ' 90% 55%), hsl(' + ((h + 200) % 360) + ' 90% 60%), hsl(' + h + ' 90% 60%))'
}

type Toast = { kind: 'ok' | 'err'; text: string } | null

export default function App() {
  const [meta, setMeta] = useState<{ name: string; symbol: string } | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [owned, setOwned] = useState<number[]>([])
  const [loadingOwned, setLoadingOwned] = useState(false)
  const [busy, setBusy] = useState<'' | 'connect' | 'mint'>('')
  const [toast, setToast] = useState<Toast>(null)

  const flash = (t: Toast) => { setToast(t); if (t) setTimeout(() => setToast(null), 4000) }

  const loadMeta = useCallback(async () => {
    try {
      const [name, symbol] = await Promise.all([
        readContract(NFT_ID, 'name', VIEW_SOURCE),
        readContract(NFT_ID, 'symbol', VIEW_SOURCE),
      ])
      setMeta({ name: String(name), symbol: String(symbol) })
    } catch (e: any) { flash({ kind: 'err', text: e.message }) }
  }, [])

  const loadOwned = useCallback(async (a: string) => {
    setLoadingOwned(true)
    try {
      const ids = await getOwnedNftIds(NFT_ID, a, VIEW_SOURCE)
      // Merge (don't replace): a just-minted id stays even if events lag indexing.
      setOwned((prev) => Array.from(new Set([...prev, ...ids])).sort((x, y) => x - y))
    } catch {} finally {
      setLoadingOwned(false)
    }
  }, [])

  useEffect(() => {
    loadMeta()
    getConnectedAddress().then((a) => { if (a) { setAddress(a); loadOwned(a) } })
  }, [loadMeta, loadOwned])

  const connect = async () => {
    setBusy('connect')
    try { const a = await connectWallet(); setAddress(a); await loadOwned(a) }
    catch (e: any) { flash({ kind: 'err', text: e.message }) }
    finally { setBusy('') }
  }

  const disconnect = () => { setAddress(null); setOwned([]) }

  const mint = async () => {
    if (!address) return
    setBusy('mint')
    try {
      const { tokenId } = await mintNft(address)
      if (tokenId != null) setOwned((o) => [...new Set([...o, tokenId])].sort((x, y) => x - y))
      await loadOwned(address)
      flash({ kind: 'ok', text: tokenId != null ? 'Minted NFT #' + tokenId + ' 🎨' : 'Minted! 🎨' })
    } catch (e: any) { flash({ kind: 'err', text: e.message }) }
    finally { setBusy('') }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 font-sans text-zinc-100"
      style={{ backgroundImage: 'radial-gradient(60rem 40rem at 50% -10%, rgba(139,92,246,0.18), transparent), radial-gradient(40rem 30rem at 90% 10%, rgba(34,211,238,0.12), transparent)' }}>
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              {meta?.name ?? 'Demo NFTs'}
            </h1>
            <p className="mt-0.5 text-[11px] uppercase tracking-widest text-zinc-500">
              {meta?.symbol ?? 'DNFT'} · Stellar testnet
            </p>
          </div>
          {address ? (
            <button onClick={disconnect} title="Disconnect"
              className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur transition hover:border-rose-500/50 hover:text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 group-hover:bg-rose-400" />
              <span className="group-hover:hidden">{short(address)}</span>
              <span className="hidden group-hover:inline">Disconnect</span>
            </button>
          ) : (
            <button onClick={connect} disabled={busy === 'connect'}
              className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:opacity-90 disabled:opacity-60">
              {busy === 'connect' ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>

        {/* Mint bar */}
        <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 text-center backdrop-blur">
          <div className="h-20 w-20 rounded-2xl shadow-lg shadow-violet-500/20" style={{ background: art(owned.length + 1) }} />
          <p className="text-sm text-zinc-400">
            {address ? 'Mint a unique collectible to your wallet.' : 'Connect your wallet to mint collectibles.'}
          </p>
          <button
            onClick={address ? mint : connect}
            disabled={busy !== ''}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:opacity-60">
            {busy === 'mint' ? 'Minting…' : busy === 'connect' ? 'Connecting…' : address ? 'Mint NFT' : 'Connect Freighter'}
          </button>
          {address && (
            <>
              <p className="text-xs text-zinc-500">You own <span className="font-semibold text-zinc-300">{owned.length}</span> in this collection</p>
              <p className="text-[10px] text-zinc-600">Gasless — the collection mints it to your wallet (no signature needed)</p>
            </>
          )}
        </div>

        {/* Gallery */}
        {address && (
          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold text-zinc-300">Your collection</p>
            {loadingOwned && owned.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/50" />
                ))}
              </div>
            ) : owned.length === 0 ? (
              <p className="text-xs text-zinc-500">No NFTs yet — mint your first above.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {owned.map((id) => (
                  <div key={id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
                    <div className="aspect-square" style={{ background: art(id) }} />
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-semibold">#{id}</span>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{meta?.symbol ?? 'DNFT'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <a href={EXPLORER} target="_blank" rel="noreferrer"
          className="mt-6 block text-center text-xs text-zinc-600 transition hover:text-zinc-400">
          Live on Stellar testnet · contract {short(NFT_ID)} ↗
        </a>
      </div>

      {toast && (
        <div className={'fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ' +
          (toast.kind === 'ok' ? 'bg-gradient-to-r from-violet-500 to-cyan-400 text-zinc-950' : 'bg-rose-600 text-white')}>
          {toast.text}
        </div>
      )}
    </div>
  )
}
`

export interface ExampleApp {
  label: string
  /** Pre-built dApp files (no LLM) — a working demo on a shared contract. */
  files?: FileTree
  /** Shared pre-deployed contract(s) to seed into the project's Contracts tab. */
  contracts?: DeployedContract[]
  /** Or a starter prompt the LLM builds from the blank template. */
  prompt?: string
}

/** The shared Demo token shown in the Contracts tab for the token demo. */
const DEMO_TOKEN_CONTRACT: DeployedContract = {
  manifestId: 'oz-fungible-token',
  name: 'Demo',
  category: 'token',
  contractId: DEMO_TOKEN_ID,
  network: 'testnet',
  explorerUrl:
    'https://stellar.expert/explorer/testnet/contract/' + DEMO_TOKEN_ID,
  config: { name: 'Demo', symbol: 'DEMO', initial_supply: '1000000' },
  createdAt: 0,
}

/** The shared Demo NFT collection shown in the Contracts tab for the NFT demo. */
const DEMO_NFT_CONTRACT: DeployedContract = {
  manifestId: 'oz-nft',
  name: 'Demo NFTs',
  category: 'nft',
  contractId: DEMO_NFT_ID,
  network: 'testnet',
  explorerUrl: 'https://stellar.expert/explorer/testnet/contract/' + DEMO_NFT_ID,
  config: { name: 'Demo NFTs', symbol: 'DNFT', uri: 'https://stellar.org/nft/' },
  createdAt: 0,
}

export const EXAMPLE_APPS: ExampleApp[] = [
  {
    label: 'Fungible token dashboard',
    files: withBaseFiles({
      '/package.json': STELLAR_PACKAGE_JSON,
      '/polyfills.ts': POLYFILLS,
      '/stellar.ts': STELLAR_LIB,
      '/App.tsx': DEMO_TOKEN_APP,
    }),
    contracts: [DEMO_TOKEN_CONTRACT],
  },
  {
    label: 'NFT minting app',
    files: withBaseFiles({
      '/package.json': STELLAR_PACKAGE_JSON,
      '/polyfills.ts': POLYFILLS,
      '/stellar.ts': STELLAR_LIB,
      '/App.tsx': DEMO_NFT_APP,
    }),
    contracts: [DEMO_NFT_CONTRACT],
  },
]
