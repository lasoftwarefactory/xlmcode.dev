# GEMINI.md

This project's guidance for AI agents lives in **[AGENTS.md](AGENTS.md)** — read it
first (architecture, repo layout, commands, conventions). It is vendor-neutral and
applies to any assistant (Gemini, Claude, Codex, Cursor, …).

Capability specs are in **[`openspec/`](openspec/)** following the
[OpenSpec](https://openspec.dev/) convention; start at `openspec/project.md`.

Quick reminders:

- One backend (Express in `server/`); `server/_lib/*` is a shared library. The
  backend is the only thing that talks to Supabase.
- Before finishing: `pnpm typecheck && pnpm lint && pnpm build` must all pass.
- Conventional Commits; no AI attribution. Secrets only in `.env.local`.
  Generated-app demos and the Freighter bridge source strings
  (`xlmcode-host` / `xlmcode-dapp`) are off-limits to restyling/renaming.
