# Project Context

> Conventions for spec-driven work in this repo, following the
> [OpenSpec](https://openspec.dev/) convention. Capability specs in `specs/` are
> the source of truth for *what the system does*; in-flight proposals go in
> `changes/`.

## Purpose

XLM Code lets anyone build on Stellar from a natural-language prompt: an LLM
generates a working React dApp and deploys audited OpenZeppelin Soroban contracts
to Stellar **testnet**, wiring the frontend to them — no Rust, no toolchain.

## Tech stack

- **Frontend**: Vite, React 19, TypeScript, Tailwind v4. Live preview via Sandpack
  (classic `react-ts` bundler). Fonts: Space Grotesk + JetBrains Mono. Accent `#FDDA24`.
- **AI**: Vercel AI SDK v7 (`streamObject`/`generateObject`) + Zod. OpenAI provider.
  Brand model tiers (XLM_MINI/PRO/MAX) map to provider models via the `models` table.
- **Backend**: Express (`server/`). The only Supabase client. Imports `server/_lib/*`.
- **Auth + DB**: Supabase — email OTP + Google OAuth (no passwords), Postgres + RLS.
- **Chain**: Stellar testnet / Soroban. Deploy committed WASM via `@stellar/stellar-sdk`.
- **Email**: Resend.

## Architecture invariants

- One HTTP backend (Express). `server/_lib/*` is a shared library, never a server.
- The browser never touches Supabase directly — only the Express API does.
- RLS is enabled and deny-by-default on every table. User data is owner-scoped via
  `auth.uid()`; system/system-account writes use the secret-key admin client.
- Contract deploys are ephemeral: a fresh keypair is funded via Friendbot, uploads
  WASM, invokes the constructor; the user's Freighter wallet is set as owner.
- The generated app runs in a Sandpack iframe and reaches Freighter via a
  `postMessage` bridge (`xlmcode-host` / `xlmcode-dapp`). `useFreighterBridge()`
  must be mounted on every page that renders a preview.
- A project == a conversation (1:1). The `FileTree` (path → contents) is the single
  source of truth for the generated document; the LLM proposes ops, the app applies.

## Conventions

- **Commits**: Conventional Commits. No AI attribution / `Co-Authored-By`.
- **Language**: all code, comments, UI copy and docs in English.
- **Secrets**: `.env.local` only (gitignored). `env.example` is placeholders.
- **Agent output contract**: the Zod schema in `shared/schema.ts`. AI SDK v7 usage
  fields are `inputTokens` / `outputTokens`.
- **Contracts**: add a manifest JSON in `contracts/manifests/`; the LLM catalog is
  built from these and injected into the system prompt.
- **DB changes**: SQL migrations in `supabase/migrations/`, applied with
  `supabase db push`.
- **Quality gate**: `pnpm typecheck && pnpm lint && pnpm build` must pass before a PR.

## Domain notes

- **Soroswap** (DEX) testnet addresses: router `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`,
  XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`,
  USDC `CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F`. Swap via
  `swap_exact_tokens_for_tokens`, quote via `router_get_amounts_out`, 5% slippage.
- Public RPC can return a transient `txBadSeq` after a prior tx — retry.
- ScVal args must be wrapped (`addr()`/`i128()`/`u32()`/`u64()`/`pathVec()`); raw
  strings/numbers throw "XDR Write Error".
