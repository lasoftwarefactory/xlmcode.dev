# xlmcode — Supabase + backend setup

Everything is **coded and build-clean**, but two things need YOUR login/browser
(I couldn't do them): applying the migration to your project, and configuring the
Auth providers in the dashboard. Follow these steps once.

## 0. Env vars (`.env.local`, already mostly set)
```
SUPABASE_URL=...                       # server-side
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...  # server-side (per-request RLS client)
SUPABASE_SECRET_KEY=sb_secret_...      # server only, NEVER in the browser
OPENAI_API_KEY=...                     # already set
OPENAI_MODEL=gpt-5.4-mini              # fallback if the models table is unreachable
FAUCET_SECRET=...                      # already set

# add these:
VITE_API_BASE=http://localhost:8787    # frontend → backend (dev). Prod: https://api.xlmcode.dev
PORT=8787                              # Express port (dev)
FRONTEND_ORIGIN=http://localhost:5173  # CORS origin (dev). Prod: https://app.xlmcode.dev
# COOKIE_DOMAIN=.xlmcode.dev           # prod only (first-party cookies across app./api.)
# NODE_ENV=production                  # prod only (enables Secure + SameSite=None cookies)
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  # only for `supabase start` local auth; remote uses the dashboard
```

## 1. Apply the migration (Supabase CLI)
```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase login               # opens the browser
supabase link --project-ref <YOUR_PROJECT_REF>   # the <ref> from SUPABASE_URL: https://<ref>.supabase.co
supabase db push             # applies supabase/migrations/20260628000001_init.sql
```
This creates all tables, enums, RLS policies, the RPCs (`consume_prompt`,
`restore_version`, `clone_project`), and seeds `plans` + `models`.

## 2. Dashboard config (Authentication)
- **Providers → Google**: enable, paste your Google OAuth client id + secret.
  Authorized redirect URI (in Google Cloud console) = `https://<ref>.supabase.co/auth/v1/callback`.
- **Email templates → Magic Link / OTP**: set the template body to use `{{ .Token }}`
  (so users get a **6-digit code**, not a magic link).
- **URL Configuration**:
  - Site URL: `http://localhost:5173` (dev) / `https://app.xlmcode.dev` (prod)
  - Redirect URLs: add `http://localhost:8787/auth/callback`, `https://api.xlmcode.dev/auth/callback`,
    `http://localhost:5173`, `https://app.xlmcode.dev`.
- (Optional) **Providers → Email**: disable "Enable email signups with password" / leave password unused.

## 3. Make yourself admin (unlimited prompts)
`is_admin` can't be set from the app (RLS + trigger block it). After your first login,
in the Supabase SQL editor run once:
```sql
update profiles set is_admin = true, plan = 'admin' where email = 'YOUR_EMAIL';
```
(Or add it as a new migration so it's tracked.)

## 4. Run it locally
```bash
pnpm server   # Express backend on :8787 (tsx watch)
pnpm dev      # Vite frontend on :5173
```
Log in with your email (OTP code) or Google. Projects, conversations, versions and
deployed contracts now persist in Supabase. Rate limit: 50 prompts your first day,
20/day after (admins unlimited).

## 5. Deploy

See **[DEPLOY.md](DEPLOY.md)** — backend on Dokploy → Cloudflare → Supabase → Vercel.
The frontend (Vercel) only needs `VITE_API_BASE`; all Supabase keys are server-side.
- Same parent domain (`xlmcode.dev`) for app./api. = first-party cookies → login works on all browsers.

## ⚠️ Honest status
- **Build-verified** (tsc front+api+server, eslint, vite build all green).
- **NOT runtime-tested** (I can't run your Supabase/Google). The auth flow, RLS, the
  streaming chat + server-side persistence, and rate limiting need a live test after
  `db push` + dashboard config. Test the happy path first: login → create project →
  send a prompt → refresh (project persists) → deploy a contract → share/clone.
- The frontend is **hybrid**: in-memory model stays live (snappy UI) + syncs to the
  backend; full projects hydrate from the DB on open and the list loads on login.
