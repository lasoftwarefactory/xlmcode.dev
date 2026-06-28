import { useEffect, useState } from 'react'
import {
  Plus,
  Coins,
  Shield,
  Image as ImageIcon,
  Boxes,
  ExternalLink,
  Loader2,
  Check,
  Copy,
  ArrowLeft,
  Hammer,
  AlertTriangle,
  BadgePercent,
  KeyRound,
  ShieldCheck,
  Vault,
  CirclePause,
  UserCog,
  Landmark,
  Vote,
  Clock,
  Building2,
  Fuel,
  ListTree,
  ArrowLeftRight,
  Layers,
  Radio,
  TrendingUp,
  Handshake,
  CircleDollarSign,
  Zap,
} from 'lucide-react'
import type { Manifest, DeployedContract } from '../../shared/types'
import { fetchCatalog, deployContract } from '../lib/contracts'

const CATEGORY_ICON: Record<string, typeof Coins> = {
  token: Coins,
  access: Shield,
  nft: ImageIcon,
}
function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICON[category] ?? Boxes
  return <Icon className={className} />
}

/**
 * The Contracts tab — a deploy/connect console (not a document editor).
 *   left: the project's deployed contracts + "Add contract"
 *   right: the selected contract's detail
 *   modal: a catalog with 3 modes — Configurable (live), Existing, Custom.
 */
export function ContractsPanel({
  projectId,
  contracts,
  onDeployed,
  readOnly = false,
}: {
  projectId: string
  contracts: DeployedContract[]
  onDeployed: (c: DeployedContract) => void
  /** Read-only view (template/shared): contracts are visible but not deployable. */
  readOnly?: boolean
}) {
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [selected, setSelected] = useState(0)

  const current = contracts[Math.min(selected, contracts.length - 1)]

  return (
    <div className="absolute inset-0 flex bg-zinc-950 text-zinc-200">
      {/* Left: deployed list */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800">
        <div className="flex items-center justify-between px-3 py-2.5 text-[12px] font-medium text-zinc-400">
          <span>Contracts · {contracts.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {contracts.map((c, i) => (
            <button
              key={c.contractId}
              onClick={() => setSelected(i)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12.5px] transition-colors ${
                i === selected ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900/60'
              }`}
            >
              <CategoryIcon category={c.category} className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 text-[10px] font-medium text-emerald-500/80">●</span>
            </button>
          ))}
        </div>
        {!readOnly && (
          <div className="border-t border-zinc-800 p-2">
            <button
              onClick={() => setCatalogOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-zinc-50 px-2.5 py-2 text-[12.5px] font-medium text-black transition-colors hover:bg-white"
            >
              <Plus className="h-4 w-4" /> Add contract
            </button>
          </div>
        )}
      </aside>

      {/* Right: detail / empty state */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {current ? (
          <DeployedDetail contract={current} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Boxes className="h-8 w-8 text-zinc-700" />
            <p className="max-w-xs text-[13px] leading-relaxed text-zinc-500">
              {readOnly
                ? 'This is a read-only view. Clone the project to deploy and wire your own contracts.'
                : 'Deploy an audited contract to Stellar testnet, or connect an existing protocol. Its address is wired into src/contracts.ts.'}
            </p>
            {!readOnly && (
              <button
                onClick={() => setCatalogOpen(true)}
                className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-3 py-2 text-[12.5px] font-medium text-black transition-colors hover:bg-white"
              >
                <Plus className="h-4 w-4" /> Add contract
              </button>
            )}
          </div>
        )}
      </div>

      {catalogOpen && (
        <AddContractModal
          projectId={projectId}
          onClose={() => setCatalogOpen(false)}
          onDeployed={(c) => {
            onDeployed(c)
            setSelected(contracts.length) // newest becomes selected
            setCatalogOpen(false)
          }}
        />
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[12.5px]">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className={`min-w-0 break-all text-right text-zinc-300 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function DeployedDetail({ contract: c }: { contract: DeployedContract }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
          <CategoryIcon category={c.category} className="h-5 w-5 text-zinc-300" />
        </div>
        <div>
          <h2 className="text-[16px] font-medium text-zinc-100">{c.name}</h2>
          <p className="text-[12px] text-zinc-500">
            {c.category} · {c.network}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-zinc-500">Contract ID</span>
          <div className="flex items-center gap-1">
            <CopyChip text={c.contractId} />
            <a
              href={c.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
              title="View on Stellar Expert"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <code className="mt-1 block break-all font-mono text-[12.5px] text-zinc-300">
          {c.contractId}
        </code>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 p-4">
        <h3 className="mb-1 text-[12px] font-medium uppercase tracking-wide text-zinc-500">
          Configuration
        </h3>
        {Object.entries(c.config).map(([k, v]) => (
          <Row key={k} label={k} value={String(v === '{{deployer}}' ? 'deployer' : v)} />
        ))}
        {c.deployer && <Row label="deployer" value={c.deployer} mono />}
        {c.txHash && <Row label="deploy tx" value={c.txHash} mono />}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">
        Wired into your app at <code className="text-zinc-400">src/contracts.ts</code> as{' '}
        <code className="text-zinc-400">CONTRACTS["{c.manifestId}"]</code>.
      </p>
    </div>
  )
}

type Mode = 'configurable' | 'existing' | 'custom'
const MODES: { id: Mode; label: string }[] = [
  { id: 'configurable', label: 'Configurable' },
  { id: 'existing', label: 'Existing' },
  { id: 'custom', label: 'Custom' },
]

// ---------------------------------------------------------------------------
// Reference catalog — static data for the Configurable tab
// ---------------------------------------------------------------------------

type RefEntry = {
  name: string
  blurb: string
  icon: typeof Coins
  manifestId?: string // set only when a real manifest exists
}

const CONFIGURABLE_REF: RefEntry[] = [
  {
    name: 'Fungible Token',
    blurb: 'Token with name, symbol and supply. The MVP hello-world.',
    icon: Coins,
    manifestId: 'oz-fungible-token',
  },
  {
    name: 'Non-Fungible Token (NFT)',
    blurb: 'Unique collectibles: galleries, art, items.',
    icon: ImageIcon,
    manifestId: 'oz-nft',
  },
  {
    name: 'NFT with Royalties',
    blurb: 'NFTs where the creator earns on resales.',
    icon: BadgePercent,
  },
  {
    name: 'Ownable',
    blurb: 'Simple access control: a single owner account.',
    icon: KeyRound,
    manifestId: 'oz-ownable',
  },
  {
    name: 'Role-Based Access Control',
    blurb: 'Distinct roles per privileged action.',
    icon: ShieldCheck,
  },
  {
    name: 'Vault (SEP-56)',
    blurb: 'Tokenized shares of an asset pool; yield products.',
    icon: Vault,
  },
  {
    name: 'Pausable',
    blurb: 'Pause/unpause functions for emergencies.',
    icon: CirclePause,
  },
  {
    name: 'Smart Account',
    blurb: 'Programmable auth (signers + policies).',
    icon: UserCog,
  },
  {
    name: 'Governor',
    blurb: 'On-chain governance: proposals, voting, execution.',
    icon: Landmark,
  },
  {
    name: 'Votes',
    blurb: 'Delegated voting power with history.',
    icon: Vote,
  },
  {
    name: 'Timelock Controller',
    blurb: 'Enforce delays before executing transactions.',
    icon: Clock,
  },
  {
    name: 'Real World Assets (RWA)',
    blurb: 'Tokens with regulatory features (ERC-3643).',
    icon: Building2,
  },
  {
    name: 'Fee Abstraction',
    blurb: 'Pay fees in USDC; a relayer covers XLM.',
    icon: Fuel,
  },
  {
    name: 'Merkle Distributor',
    blurb: 'Airdrops/whitelists via Merkle proofs.',
    icon: ListTree,
  },
]

// ---------------------------------------------------------------------------
// Reference catalog — static data for the Existing tab
// ---------------------------------------------------------------------------

type ProtocolEntry = {
  name: string
  blurb: string
  icon: typeof Coins
  logo?: string
  /** When set, this protocol is LIVE and can be connected (no deploy). */
  connect?: { manifestId: string; category: string; contractId: string; config: Record<string, unknown> }
}

const EXISTING_PROTOCOLS: ProtocolEntry[] = [
  {
    name: 'Soroswap',
    blurb: 'DEX + liquidity aggregator. Best-price swaps (XLM/USDC).',
    icon: ArrowLeftRight,
    logo: '/logos/soroswap.svg',
    connect: {
      manifestId: 'soroswap-router',
      category: 'dex',
      contractId: 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD',
      config: { pair: 'XLM/USDC', kind: 'existing' },
    },
  },
  {
    name: 'Blend',
    blurb: 'Lending/borrowing pools with backstop.',
    icon: Layers,
    logo: '/logos/blend.svg',
  },
  {
    name: 'Reflector',
    blurb: 'Price oracle (SEP-40). Read-only, low risk.',
    icon: Radio,
    logo: '/logos/reflector.png',
  },
  {
    name: 'DeFindex',
    blurb: 'Yield infrastructure: automated vault strategies.',
    icon: TrendingUp,
    logo: '/logos/defindex.svg',
  },
  {
    name: 'Trustless Work',
    blurb: 'Non-custodial milestone escrow in USDC.',
    icon: Handshake,
    logo: '/logos/trustless-work.png',
  },
  {
    name: 'USDC (Stellar Asset Contract)',
    blurb: 'The asset most flows touch. First-class citizen.',
    icon: CircleDollarSign,
    logo: '/logos/usdc.svg',
  },
  {
    name: 'x402',
    blurb: 'HTTP-request payments / micropayments / agent payments.',
    icon: Zap,
    logo: '/logos/x402.svg',
  },
]

function ProtocolLogo({
  logo,
  name,
  icon: Icon,
}: {
  logo?: string
  name: string
  icon: typeof Coins
}) {
  const [imgFailed, setImgFailed] = useState(false)
  if (logo && !imgFailed) {
    return (
      <img
        src={logo}
        alt={name}
        className="h-6 w-6 rounded object-contain"
        onError={() => setImgFailed(true)}
      />
    )
  }
  return <Icon className="h-5 w-5 text-zinc-300" />
}

function AddContractModal({
  projectId,
  onClose,
  onDeployed,
}: {
  projectId: string
  onClose: () => void
  onDeployed: (c: DeployedContract) => void
}) {
  const [mode, setMode] = useState<Mode>('configurable')
  const [catalog, setCatalog] = useState<Manifest[] | null>(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Manifest | null>(null)

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch((e) => setError(String(e)))
  }, [])

  // Build a set of available manifest IDs for O(1) lookup
  const availableIds = new Set((catalog ?? []).map((m) => m.id))

  // Map a manifestId to the live Manifest object
  const manifestById = new Map((catalog ?? []).map((m) => [m.id, m]))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[560px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {picked ? (
          <ConfigForm
            projectId={projectId}
            manifest={picked}
            onBack={() => setPicked(null)}
            onDeployed={onDeployed}
          />
        ) : (
          <>
            <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-2.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    mode === m.id ? 'bg-zinc-900 text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[12.5px] text-red-300">
                  <AlertTriangle className="h-4 w-4" /> {error}
                </div>
              )}

              {mode === 'configurable' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {!catalog && <Skeletons />}
                  {CONFIGURABLE_REF.map((entry) => {
                    const Icon = entry.icon
                    const isAvailable = entry.manifestId != null && availableIds.has(entry.manifestId)
                    const manifest = entry.manifestId ? manifestById.get(entry.manifestId) : undefined

                    if (isAvailable && manifest) {
                      return (
                        <button
                          key={entry.name}
                          onClick={() => setPicked(manifest)}
                          className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/60"
                        >
                          <Icon className="h-5 w-5 text-zinc-300" />
                          <span className="text-[13px] font-medium text-zinc-100">{entry.name}</span>
                          <span className="line-clamp-3 text-[11.5px] leading-relaxed text-zinc-500">
                            {entry.blurb}
                          </span>
                        </button>
                      )
                    }

                    return (
                      <div
                        key={entry.name}
                        className="relative flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3.5 opacity-60"
                      >
                        <Icon className="h-5 w-5 text-zinc-300" />
                        <span className="text-[13px] font-medium text-zinc-100">{entry.name}</span>
                        <span className="line-clamp-3 text-[11.5px] leading-relaxed text-zinc-500">
                          {entry.blurb}
                        </span>
                        <span className="absolute right-2.5 top-2.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                          Soon
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {mode === 'existing' && (
                <div className="flex flex-col gap-3">
                  <p className="text-[12px] leading-relaxed text-zinc-500">
                    Connect to a live, audited protocol by its contract ID — no deploy needed.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {EXISTING_PROTOCOLS.map((entry) => {
                      const live = entry.connect
                      return (
                        <div
                          key={entry.name}
                          onClick={
                            live
                              ? () =>
                                  onDeployed({
                                    manifestId: entry.connect!.manifestId,
                                    name: entry.name,
                                    category: entry.connect!.category,
                                    contractId: entry.connect!.contractId,
                                    network: 'testnet',
                                    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${entry.connect!.contractId}`,
                                    config: entry.connect!.config,
                                    createdAt: Date.now(),
                                  })
                              : undefined
                          }
                          className={`relative flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3.5 transition-colors ${
                            live ? 'cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/60' : 'opacity-60'
                          }`}
                        >
                          <ProtocolLogo logo={entry.logo} name={entry.name} icon={entry.icon} />
                          <span className="text-[13px] font-medium text-zinc-100">{entry.name}</span>
                          <span className="line-clamp-3 text-[11.5px] leading-relaxed text-zinc-500">
                            {entry.blurb}
                          </span>
                          <span
                            className={`absolute right-2.5 top-2.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              live ? 'bg-violet-500/15 text-violet-300' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {live ? 'Connect' : 'Soon'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {mode === 'custom' && (
                <ComingSoon
                  icon={Hammer}
                  title="Build your own contract"
                  body="Author your own Soroban contract with the LLM or the code editor (contract files only — no preview), then compile and deploy. Coming after the configurable catalog is solid."
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ConfigForm({
  projectId,
  manifest,
  onBack,
  onDeployed,
}: {
  projectId: string
  manifest: Manifest
  onBack: () => void
  onDeployed: (c: DeployedContract) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      manifest.config.map((f) => [f.key, f.default != null ? String(f.default) : '']),
    ),
  )
  const [deploying, setDeploying] = useState(false)
  const [error, setError] = useState('')

  const deploy = async () => {
    setDeploying(true)
    setError('')
    try {
      // address fields left as the {{deployer}} sentinel resolve server-side.
      const config: Record<string, unknown> = {}
      for (const f of manifest.config) {
        const raw = values[f.key]
        config[f.key] = f.type === 'number' ? Number(raw) : raw
      }
      const res = await deployContract(projectId, manifest.id, config)
      onDeployed({
        manifestId: manifest.id,
        name: manifest.name,
        category: manifest.category,
        contractId: res.contractId,
        network: 'testnet',
        txHash: res.txHash,
        explorerUrl: res.explorerUrl,
        deployer: res.deployer,
        config,
        createdAt: Date.now(),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDeploying(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5">
        <button
          onClick={onBack}
          disabled={deploying}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <CategoryIcon category={manifest.category} className="h-4 w-4 text-zinc-300" />
        <span className="text-[13px] font-medium text-zinc-100">{manifest.name}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-[12.5px] leading-relaxed text-zinc-500">{manifest.description}</p>
        <div className="space-y-3">
          {manifest.config.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[12px] font-medium text-zinc-400">
                {f.label}
                {f.type === 'address' && (
                  <span className="ml-1.5 font-normal text-zinc-600">
                    · defaults to deployer
                  </span>
                )}
              </span>
              <input
                value={values[f.key] === '{{deployer}}' ? '' : values[f.key]}
                placeholder={f.type === 'address' ? 'G… (leave blank for deployer)' : ''}
                disabled={deploying}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                inputMode={f.type === 'number' ? 'numeric' : 'text'}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-600 disabled:opacity-50"
              />
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
        <span className="text-[11.5px] text-zinc-600">
          {deploying ? 'Funding deployer · uploading WASM · invoking constructor…' : 'Deploys to Stellar testnet'}
        </span>
        <button
          onClick={deploy}
          disabled={deploying}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deploying && <Loader2 className="h-4 w-4 animate-spin" />}
          {deploying ? 'Deploying…' : 'Deploy to testnet'}
        </button>
      </div>
    </>
  )
}

function ComingSoon({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Coins
  title: string
  body: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <Icon className="h-7 w-7 text-zinc-700" />
      <p className="text-[13px] font-medium text-zinc-300">{title}</p>
      <p className="max-w-sm text-[12px] leading-relaxed text-zinc-500">{body}</p>
    </div>
  )
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/30" />
      ))}
    </>
  )
}
