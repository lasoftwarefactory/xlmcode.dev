# Deployment

Architecture in production:

```
xlmcode.dev          → Vercel (frontend SPA)
api.xlmcode.dev      → Cloudflare → VPS (Traefik → Dokploy → Express container)
                       └ talks to Supabase (auth + Postgres) and Stellar testnet
```

Cookies are shared across the parent domain (`COOKIE_DOMAIN=.xlmcode.dev`,
`SameSite=None; Secure`), so the Vercel frontend and the VPS API authenticate as
first parties. Deploy in this order: **backend → Cloudflare → Supabase → Vercel.**

VPS public IP: `89.116.170.218`.

---

## 1. Backend on Dokploy

The repo ships a `Dockerfile` (runs the Express server on port `8787`).

In the Dokploy dashboard:

1. **Create Application** in a project (e.g. `xlmcode`).
2. **Source** → GitHub: install the Dokploy GitHub app, pick this repo, branch `main`.
3. **Build Type** → **Dockerfile** (`./Dockerfile`).
4. **Environment** → paste (real values from your local `.env.local`):

   ```
   NODE_ENV=production
   PORT=8787
   FRONTEND_ORIGIN=https://xlmcode.dev
   API_BASE=https://api.xlmcode.dev
   COOKIE_DOMAIN=.xlmcode.dev
   OPENAI_API_KEY=...
   OPENAI_MODEL=gpt-5.4-mini
   SUPABASE_URL=...
   SUPABASE_PUBLISHABLE_KEY=...           # server-side RLS client
   SUPABASE_SECRET_KEY=...
   FAUCET_SECRET=S...
   RESEND_API_KEY=...
   EMAIL_FROM=XLM Code <noreply@xlmcode.dev>
   STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
   ```

   (`SUPABASE_DB_PASSWORD` is NOT needed at runtime — only for `supabase db push` from your machine.)
5. **Domains** → add `api.xlmcode.dev`, container port **8787**, enable HTTPS (Let's Encrypt).
6. **Auto Deploy** → enable. Dokploy adds a GitHub webhook → every push to `main`
   rebuilds and redeploys.
7. **Deploy**, then smoke-test: `https://api.xlmcode.dev/health` → `{ ok: true }`.

CORS allows a single origin (`FRONTEND_ORIGIN`). Use the apex `xlmcode.dev` as
canonical and redirect `www` → apex.

## 2. Cloudflare in front of the API

1. Add `xlmcode.dev` to Cloudflare (update registrar nameservers if needed).
2. DNS → `A` record: `api` → `89.116.170.218`, **Proxied** (orange cloud).
3. SSL/TLS mode → **Full (strict)**.
   - If Let's Encrypt issuance in Dokploy fails behind the proxy, set the `api`
     record to **DNS only** (grey) temporarily, let Dokploy issue the cert, then
     re-enable the proxy. (Alternative: install a Cloudflare Origin Certificate on
     the VPS and use Full.)
4. The API uses cookies + non-GET requests — leave caching off for `api.*`
   (Cloudflare doesn't cache those by default; add a "Bypass cache" rule if unsure).

## 3. Supabase

1. **Auth → URL Configuration**
   - Site URL: `https://xlmcode.dev`
   - Redirect URLs: add `https://api.xlmcode.dev/auth/callback` (prod) and
     `http://localhost:8787/auth/callback` (dev).
2. **Auth → Providers → Google**: enable, set the Google OAuth Client ID/Secret.
   In Google Cloud Console, the OAuth client's Authorized redirect URI is the
   Supabase callback: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Auth → Emails**: the OTP/confirmation template must send the code — include
   `{{ .Token }}`.
4. **Schema**: apply migrations once — `supabase link --project-ref <ref>` then
   `supabase db push`. Optionally `pnpm seed:templates`.

## 4. Frontend on Vercel

1. Import the GitHub repo. Framework: **Vite** (build `pnpm build`, output `dist`).
   `vercel.json` already handles SPA rewrites.
2. **Environment Variables** (the frontend only talks to the backend):

   ```
   VITE_API_BASE=https://api.xlmcode.dev
   ```
3. **Domains**: add `xlmcode.dev` (+ `www` → redirect to apex). Point DNS at
   Vercel per its instructions (in Cloudflare, add the CNAME/A records Vercel
   shows; the frontend record can be Proxied or DNS-only).
4. Deploy.

## Verify end-to-end

- `https://api.xlmcode.dev/health` returns ok.
- On `https://xlmcode.dev`: sign in (OTP + Google), create a project, generate,
  deploy a contract, share `/p/:token`, connect Freighter in the preview, clone.
- Push a commit → Dokploy auto-redeploys the backend; Vercel auto-redeploys the
  frontend.
