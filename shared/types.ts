/**
 * Shared contracts between the platform frontend (`src/`) and the serverless
 * backend (`api/`).
 *
 * Conceptual reminder (see PLAN.md §1):
 *   - The platform is the editor. The user's generated app is the document.
 *   - The `FileTree` is the single source of truth for that document.
 *   - The LLM proposes operations; the platform applies them.
 *
 * The agent response contract (AgentResponse / FileOp / ContractOp) lives in
 * `schema.ts` because it is derived from a Zod schema. Re-exported here so
 * callers have one import surface.
 */
import type { AgentAction } from './schema'
export type { FileOp, ContractOp, AgentResponse, AgentAction } from './schema'

/** The user's generated app, in memory: path -> file contents. */
export type FileTree = Record<string, string>

/** Supported LLM providers. The MVP ships with OpenAI; the rest are stubs. */
export type LlmProvider = 'openai' | 'anthropic' | 'gemini'

/** A field the user fills in to configure a deployable contract. */
export interface ManifestConfigField {
  key: string
  label: string
  type: 'string' | 'number' | 'address'
  /** Precise Soroban scval type for the constructor arg. Derived from `type`
   *  when omitted (string→string, number→i128, address→address). */
  scType?: 'string' | 'address' | 'i128' | 'u32' | 'u64' | 'bool'
  default?: unknown
}

/** A method a contract exposes, so the LLM knows how to call it. */
export interface ManifestMethod {
  name: string
  args: string[]
  returns: string
  mutates: boolean
  /** Plain-language description of what the method does. */
  description?: string
}

/**
 * A contract manifest. Adding a new protocol to Stellarable = adding one of these
 * JSON files, without touching the engine (see PLAN.md §6).
 */
export interface Manifest {
  id: string
  name: string
  description: string
  /** Short list of what this contract is good for (guides the LLM's choice). */
  useFor?: string
  type: 'deployable' | 'deployed'
  category: 'token' | 'access' | 'nft' | 'oracle' | 'dex' | (string & {})
  wasmPath?: string
  init?: { method: string; argsFromConfig: string[] }
  contractId?: string | null
  network?: 'testnet' | 'mainnet'
  config: ManifestConfigField[]
  methods: ManifestMethod[]
}

/** Result of deploying a Type-1 contract to testnet. */
export interface DeployResult {
  contractId: string
  txHash: string
  explorerUrl: string
  /** Ephemeral account that deployed (and, by default, owns) the contract. */
  deployer?: string
  wasmHash?: string
}

/** A contract that has been deployed (or connected) within a project. */
export interface DeployedContract {
  manifestId: string
  name: string
  category: string
  contractId: string
  network: 'testnet'
  txHash?: string
  explorerUrl: string
  deployer?: string
  /** The config the user/LLM used (echoed back for display). */
  config: Record<string, unknown>
  createdAt: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** For assistant messages: the file ops applied, kept visible in the chat. */
  files?: { op: 'create' | 'edit' | 'delete'; path: string }[]
  /** For assistant messages: the version label this turn produced. */
  versionName?: string
  /** Epoch ms when the message was created (for "x ago"). */
  createdAt?: number
  /** For assistant messages: the v0-style "worked for" summary. */
  stats?: {
    durationMs: number
    filesModified: number
    added: number
    removed: number
  }
  /** For assistant messages: proposed actions for this turn. */
  actions?: AgentAction[]
  /** Set true once the user has resolved the proposed actions (hides the cards). */
  actionsDone?: boolean
  /** 'system' marks auto-continuation result messages — rendered subtly, not as a normal bubble. */
  kind?: 'system'
}

/** Request payload for the chat endpoint. */
export interface ChatRequest {
  sessionId: string
  provider: LlmProvider
  projectId: string
  fileTree: FileTree
  history: ChatMessage[]
  userMessage: string
}
